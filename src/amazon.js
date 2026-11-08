// @ts-nocheck
// Amazon links for bhajans: the index's `az` is the ASIN of Amma's own recording of the song
// (set by create-index/amazon/write_index.py), so the buy button opens that track directly.
export const amazonTrackUrl = (asin) => `https://www.amazon.com/dp/${encodeURIComponent(asin)}`;
