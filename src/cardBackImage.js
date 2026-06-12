// Drop a card-back image into the project's `card_back/` folder (png/jpg/webp,
// any filename) and it automatically replaces the placeholder SVG emblem on
// every card back. Remove the file to fall back to the SVG.
// This imports the optimized rendition from web_art/ — run `npm run
// optimize-art` after changing the source (predev/prebuild do it for you).
const cardBackModules = import.meta.glob("../web_art/card_back/*.webp", {
  eager: true,
  import: "default",
});

const sources = Object.keys(cardBackModules).sort();
export const CARD_BACK_IMAGE_SRC = sources.length ? cardBackModules[sources[0]] : null;
