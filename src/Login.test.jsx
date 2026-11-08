// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  sendSignInLinkToEmail,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
} from 'firebase/auth';
import { syncUserData, sendBrandedAuthEmail } from './firebase';
import { ThemeProvider } from './ThemeContext';
import MUIThemeWrapper from './MUIThemeProvider';
import Login from './Login';

const fake = vi.hoisted(() => ({
  auth: { currentUser: null },
  listeners: new Set(),
  link: null,
}));

vi.mock('./firebase', () => ({
  auth: fake.auth,
  checkRefOnce: vi.fn(() => Promise.resolve(null)),
  syncUserData: vi.fn(() =>
    Promise.resolve({ expiresOn: Date.now() + 86400000 }),
  ),
  // Unavailable by default, so the tests below also cover the Firebase fallback.
  sendBrandedAuthEmail: vi.fn(() => Promise.reject(new Error('not deployed'))),
}));

// Follows what production does: a mismatched address leaves the link usable,
// using a link twice fails, and listeners only fire when the signed-in uid changes.
vi.mock('firebase/auth', () => {
  const authError = (code) =>
    Object.assign(new Error(`Firebase: Error (${code}).`), { code });
  const setUser = (user) => {
    const changed = fake.auth.currentUser?.uid !== user.uid;
    fake.auth.currentUser = user;
    if (changed) fake.listeners.forEach((listener) => listener(user));
    return { user };
  };
  return {
    isSignInWithEmailLink: vi.fn(() => Boolean(fake.link)),
    signInWithEmailLink: vi.fn(async (_auth, email) => {
      if (email !== fake.link.email) throw authError('auth/invalid-email');
      if (fake.link.used) throw authError('auth/invalid-action-code');
      fake.link.used = true;
      return setUser({ uid: fake.link.uid, email });
    }),
    sendSignInLinkToEmail: vi.fn(() => Promise.resolve()),
    sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
    signInWithEmailAndPassword: vi.fn(() =>
      Promise.reject(authError('auth/invalid-credential')),
    ),
    onAuthStateChanged: vi.fn((_auth, listener) => {
      fake.listeners.add(listener);
      Promise.resolve().then(() => listener(fake.auth.currentUser));
      return () => fake.listeners.delete(listener);
    }),
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const PAID = { uid: 'paid-uid', email: 'paid@example.com' };
const EXPIRED = { uid: 'expired-uid', email: 'expired@example.com' };
const LINK_PARAMS = 'apiKey=key&oobCode=code123&mode=signIn&lang=en';

const openLink = (link, extraParams = '') => {
  fake.link = { used: false, ...link };
  window.history.pushState({}, '', `/login?${extraParams}${LINK_PARAMS}`);
};

const renderLogin = () =>
  render(
    <ThemeProvider>
      <MUIThemeWrapper>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </MUIThemeWrapper>
    </ThemeProvider>,
  );

const typeEmail = (value) =>
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value },
  });

const confirmEmail = async (value) => {
  await screen.findByRole('button', { name: /verify & sign in/i });
  typeEmail(value);
  fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));
};

const signedInAs = (uid) => waitFor(() => expect(localStorage.uid).toBe(uid));

describe('finishing a magic link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    fake.auth.currentUser = null;
    fake.listeners.clear();
    fake.link = null;
    window.history.pushState({}, '', '/login');
    // Failed sign-ins log the error, and jsdom logs window.location.replace.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('completes sign-in after the email is retyped on another device', async () => {
    openLink(PAID);
    renderLogin();

    await confirmEmail(PAID.email);

    await signedInAs(PAID.uid);
    expect(syncUserData).toHaveBeenCalledWith(
      expect.objectContaining({ uid: PAID.uid }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(),
    );
  });

  it('asks for the address when the saved one belongs to a different link', async () => {
    localStorage.setItem('emailForSignIn', EXPIRED.email);
    openLink(PAID);
    renderLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /different (email )?address/i,
    );

    await confirmEmail(PAID.email);

    await signedInAs(PAID.uid);
    expect(localStorage.getItem('emailForSignIn')).toBeNull();
  });

  it('keeps asking, without a raw error code, when the retyped address is wrong', async () => {
    openLink(PAID);
    renderLogin();

    await confirmEmail(EXPIRED.email);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/address/i);
    expect(alert).not.toHaveTextContent('auth/');
    expect(
      screen.getByRole('button', { name: /verify & sign in/i }),
    ).toBeEnabled();
    expect(localStorage.uid).toBeUndefined();
  });

  it('signs in to the link account instead of an expired session already in the browser', async () => {
    fake.auth.currentUser = EXPIRED;
    localStorage.setItem('emailForSignIn', PAID.email);
    openLink(PAID);
    renderLogin();

    await signedInAs(PAID.uid);
    expect(syncUserData).not.toHaveBeenCalledWith(
      expect.objectContaining({ uid: EXPIRED.uid }),
    );
  });

  it('shows the confirm step instead of redirecting an existing session', async () => {
    fake.auth.currentUser = EXPIRED;
    openLink(PAID);
    renderLogin();

    await screen.findByRole('button', { name: /verify & sign in/i });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(syncUserData).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/login');
  });

  it.each([
    ['auth/network-request-failed', /connection/i],
    ['auth/too-many-requests', /wait a few minutes/i],
    ['auth/internal-error', /try again/i],
  ])('keeps the link for a retry after %s', async (code, message) => {
    signInWithEmailLink.mockRejectedValueOnce(
      Object.assign(new Error(code), { code }),
    );
    localStorage.setItem('emailForSignIn', PAID.email);
    openLink(PAID);
    renderLogin();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(window.location.search).toContain('oobCode=code123');
    expect(screen.getByLabelText(/email address/i)).toHaveValue(PAID.email);

    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));

    await signedInAs(PAID.uid);
  });

  it('returns a used link to the request form with a plain message', async () => {
    localStorage.setItem('emailForSignIn', PAID.email);
    openLink({ ...PAID, used: true });
    renderLogin();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/new (sign-in )?link/i);
    expect(alert).not.toHaveTextContent('auth/');
    expect(
      screen.getByRole('button', { name: /send magic link/i }),
    ).toBeEnabled();
  });

  it('does not carry a used code into the next magic link', async () => {
    localStorage.setItem('emailForSignIn', PAID.email);
    openLink({ ...PAID, used: true });
    renderLogin();
    await screen.findByRole('alert');

    typeEmail(PAID.email);
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => expect(sendSignInLinkToEmail).toHaveBeenCalled());
    expect(sendSignInLinkToEmail.mock.calls[0][2].url).toBe(
      `${window.location.origin}/login`,
    );
  });

  it('keeps the destination while removing a used code from the address', async () => {
    localStorage.setItem('emailForSignIn', PAID.email);
    openLink({ ...PAID, used: true }, 'next=%2Fpdf%2F7%2Fsong&');
    renderLogin();
    await screen.findByRole('alert');

    await waitFor(() =>
      expect(window.location.search).toBe('?next=%2Fpdf%2F7%2Fsong'),
    );
  });

  it('takes someone straight in when a used link matches their session', async () => {
    fake.auth.currentUser = PAID;
    openLink({ ...PAID, used: true });
    renderLogin();

    await confirmEmail(PAID.email);

    await signedInAs(PAID.uid);
  });

  it('stays on the request form when a used link belongs to another account', async () => {
    fake.auth.currentUser = EXPIRED;
    openLink({ ...PAID, used: true });
    renderLogin();

    await confirmEmail(PAID.email);

    expect(
      await screen.findByRole('button', { name: /send magic link/i }),
    ).toBeEnabled();
    expect(syncUserData).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/login');
  });

  it('lets someone leave the confirm step to request a new link', async () => {
    openLink(PAID);
    renderLogin();

    fireEvent.click(
      await screen.findByRole('button', { name: /request a new link/i }),
    );

    expect(
      await screen.findByRole('button', { name: /send magic link/i }),
    ).toBeEnabled();
    await waitFor(() => expect(window.location.search).toBe(''));
  });
});

describe('password sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    fake.auth.currentUser = null;
    fake.listeners.clear();
    fake.link = null;
    window.history.pushState({}, '', '/login');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const usePassword = async () =>
    fireEvent.click(
      await screen.findByRole('button', { name: /use password instead/i }),
    );

  const submitPassword = (email) => {
    typeEmail(email);
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'test-value' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
  };

  it('explains a rejected password without a raw error code', async () => {
    renderLogin();
    await usePassword();

    submitPassword(PAID.email);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/same email address/i);
    expect(alert).not.toHaveTextContent('auth/');
  });

  it('continues after a password sign-in that does not change the signed-in user', async () => {
    fake.auth.currentUser = EXPIRED;
    localStorage.setItem('emailForSignIn', PAID.email);
    openLink({ ...PAID, used: true });
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: EXPIRED });
    renderLogin();
    await screen.findByRole('alert');
    await usePassword();

    submitPassword(EXPIRED.email);

    await signedInAs(EXPIRED.uid);
  });

  it('sends people back to the login page after they reset a password', async () => {
    renderLogin();
    await usePassword();

    typeEmail(PAID.email);
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

    await waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalled());
    expect(sendPasswordResetEmail.mock.calls[0][2].url).toBe(
      `${window.location.origin}/login`,
    );
  });

  it('sends the branded magic link email when the function is available', async () => {
    sendBrandedAuthEmail.mockResolvedValueOnce({ data: { sent: true } });
    sendSignInLinkToEmail.mockClear();
    renderLogin();
    typeEmail(PAID.email);
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => expect(sendBrandedAuthEmail).toHaveBeenCalledWith({
      email: PAID.email,
      type: 'signin',
      continueUrl: `${window.location.origin}/login`,
    }));
    expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    expect(localStorage.getItem('emailForSignIn')).toBe(PAID.email);
  });

  it('sends the branded reset email when the function is available', async () => {
    sendBrandedAuthEmail.mockResolvedValueOnce({ data: { sent: true } });
    sendPasswordResetEmail.mockClear();
    renderLogin();
    await usePassword();
    typeEmail(PAID.email);
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));

    await waitFor(() => expect(sendBrandedAuthEmail).toHaveBeenCalledWith({
      email: PAID.email,
      type: 'reset',
      continueUrl: `${window.location.origin}/login`,
    }));
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
