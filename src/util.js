export const getNext = () => decodeURIComponent((window.location.search.match(/next=(.*?)(&|$)/) || ['', ''])[1]);
