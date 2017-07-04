export const getNext = () => decodeURIComponent((window.location.search.match(/next=(.*?)(&|$)/) || ['', ''])[1]);

export const getJson = key => (localStorage[key] ? JSON.parse(localStorage[key]) : null);
export const setJson = (key, value) => (localStorage[key] = JSON.stringify(value));
