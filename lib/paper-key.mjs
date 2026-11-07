// One identity per paper across atlas, catalogue and proposals.
export const paperKey = (url = "", title = "") => {
  const ax = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})/i.exec(url);
  if (ax) return `arxiv:${ax[1]}`;
  if (url) return `url:${url.replace(/^https?:\/\/(www\.)?/, "").replace(/[/#?]+$/, "").toLowerCase()}`;
  return `title:${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
};
