// @ts-nocheck
import { describe, it, expect, vi, afterEach } from 'vitest';
import { shouldOfferNotifications, MIN_BHAJANS_BEFORE_ASKING } from './notifications';

const base = { uid: 'u1', bhajansOpened: MIN_BHAJANS_BEFORE_ASKING, permission: 'default', dismissedAt: 0, now: 10 ** 12 };

describe('shouldOfferNotifications', () => {
  it('asks engaged, signed-in people who have not decided yet', () => {
    expect(shouldOfferNotifications(base)).toBe(true);
  });

  it('does not ask signed-out visitors, newcomers, or people who already chose', () => {
    expect(shouldOfferNotifications({ ...base, uid: undefined })).toBe(false);
    expect(shouldOfferNotifications({ ...base, bhajansOpened: 2 })).toBe(false);
    expect(shouldOfferNotifications({ ...base, permission: 'granted' })).toBe(false);
    expect(shouldOfferNotifications({ ...base, permission: 'denied' })).toBe(false);
  });

  it('waits 30 days after "Not now"', () => {
    const day = 86400000;
    expect(shouldOfferNotifications({ ...base, dismissedAt: base.now - 10 * day })).toBe(false);
    expect(shouldOfferNotifications({ ...base, dismissedAt: base.now - 31 * day })).toBe(true);
  });
});

describe('unlinking a browser from an account', () => {
  const setup = async () => {
    vi.resetModules();
    vi.stubEnv('PROD', true);
    const messaging = {
      getMessaging: vi.fn(() => ({})),
      getToken: vi.fn(async () => 'browser-token'),
      deleteToken: vi.fn(async () => true),
      isSupported: vi.fn(async () => true),
    };
    const db = { setRefOnce: vi.fn(async () => {}), removeRefOnce: vi.fn(async () => {}), firebaseApp: {} };
    vi.doMock('firebase/messaging', () => messaging);
    vi.doMock('./firebase', () => db);
    vi.stubGlobal('Notification', { permission: 'granted' });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({}) } });
    localStorage.clear();
    return { ...(await import('./notifications')), messaging, db };
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.doUnmock('firebase/messaging');
    vi.doUnmock('./firebase');
  });

  it("removes the account's token and invalidates it on sign-out", async () => {
    const { detachNotificationToken, messaging, db } = await setup();
    localStorage.setItem('pushTokenOwner', 'admin-1');
    await detachNotificationToken('admin-1');
    expect(db.removeRefOnce).toHaveBeenCalledWith('messages/admin-1/tokens/browser-token');
    expect(messaging.deleteToken).toHaveBeenCalled();
    expect(localStorage.getItem('pushTokenOwner')).toBeNull();
  });

  it('gives a new account a fresh token when another account used this browser', async () => {
    const { refreshNotificationToken, messaging, db } = await setup();
    localStorage.setItem('pushTokenOwner', 'admin-1');
    await refreshNotificationToken('user-2');
    expect(messaging.deleteToken).toHaveBeenCalledTimes(1);
    expect(db.setRefOnce).toHaveBeenCalledWith('messages/user-2/tokens/browser-token', expect.any(Number));
    expect(localStorage.getItem('pushTokenOwner')).toBe('user-2');
  });

  it('keeps the token when the same account signs in again', async () => {
    const { refreshNotificationToken, messaging } = await setup();
    localStorage.setItem('pushTokenOwner', 'user-2');
    await refreshNotificationToken('user-2');
    expect(messaging.deleteToken).not.toHaveBeenCalled();
  });
});
