// @ts-nocheck
// Index locations ("book-page") whose book is a lyrics PDF under public/pdfs:
// volN (Bhajanamritam volumes), YYYY / YYYYsuplN (supplements) and extra (songs
// with no printed book, see create-index/layamritam/README.md).
export const LYRICS_LOCATION = /^(\d{4}(?:supl\d?)?|vol\d|extra)-\d+$/i;

export const isLyricsLocation = (loc) => typeof loc === 'string' && LYRICS_LOCATION.test(loc);

/** "vol3-12" -> "Volume 3, page 12"; "extra-5" -> "Additional songs, page 5". */
export const locationLabel = (loc) =>
  loc
    .replace(/^extra-/, 'Additional songs-')
    .replace('voli', 'Alternate Volume ')
    .replace('vol', 'Volume ')
    .replace('-', ', page ');
