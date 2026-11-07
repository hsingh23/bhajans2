// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { userState, setUserState, track, gaClientId } from './analytics';

const DAY = 86400000;
const NOW = 1_800_000_000_000;

describe('userState', () => {
  it('marks signed-out visitors', () => {
    expect(userState({ now: NOW })).toEqual({ login_status: 'signed_out', subscription_status: 'none', user_id: undefined });
  });

  it('splits signed-in visitors by subscription', () => {
    expect(userState({ uid: 'u1', now: NOW }).subscription_status).toBe('none');
    expect(userState({ uid: 'u1', expiresOn: NOW - 1, now: NOW }).subscription_status).toBe('expired');
    expect(userState({ uid: 'u1', expiresOn: String(NOW + 3 * DAY), now: NOW }).subscription_status).toBe('expiring_soon');
    expect(userState({ uid: 'u1', expiresOn: NOW + 90 * DAY, now: NOW })).toEqual({
      login_status: 'signed_in',
      subscription_status: 'active',
      user_id: 'u1',
    });
  });
});

describe('dataLayer events', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('pushes named events with their parameters', () => {
    track('search', { search_term: 'amma' });
    expect(window.dataLayer).toEqual([{ event: 'search', search_term: 'amma' }]);
  });

  it('pushes user_state only when it changes', () => {
    setUserState({ uid: 'u9', expiresOn: Date.now() + 365 * DAY });
    setUserState({ uid: 'u9', expiresOn: Date.now() + 365 * DAY });
    setUserState({});
    expect(window.dataLayer.map((e) => e.login_status)).toEqual(['signed_in', 'signed_out']);
  });
});

describe('gaClientId', () => {
  it('reads the client id from the _ga cookie', () => {
    expect(gaClientId('foo=1; _ga=GA1.1.327633923.1794012721; bar=2')).toBe('327633923.1794012721');
    expect(gaClientId('foo=1')).toBeNull();
  });
});
