// Drop card-back images into the project's `card_back/` folder (png/jpg/webp,
// any filename) and they automatically replace the placeholder SVG emblem on
// every card back. Several images = several hand-stamped impressions: each back
// picks one (see CardBack's `variant`), so a pile or fan doesn't look cloned.
// Remove the files to fall back to the SVG.
// This imports the optimized renditions from web_art/ — run `npm run
// optimize-art` after changing the sources (predev/prebuild do it for you).
const cardBackModules = import.meta.glob("../web_art/card_back/*.webp", {
  eager: true,
  import: "default",
});

export const CARD_BACK_IMAGE_SRCS = Object.keys(cardBackModules).sort().map(k => cardBackModules[k]);
export const CARD_BACK_IMAGE_SRC = CARD_BACK_IMAGE_SRCS[0] || null;

// Stable impression for a key (card id or slot index), so a given back keeps
// the same look across re-renders.
export function cardBackSrcFor(key = 0) {
  const n = CARD_BACK_IMAGE_SRCS.length;
  if (!n) return null;
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_BACK_IMAGE_SRCS[h % n];
}
