export const getNext = (location = window.location) => decodeURIComponent((location.search.match(/next=(.*?)(&|$)/) || ['', '/'])[1]);
