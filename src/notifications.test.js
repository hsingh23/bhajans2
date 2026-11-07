// @ts-nocheck
import { describe, it, expect } from 'vitest';
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
