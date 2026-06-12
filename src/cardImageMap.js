// Imports the web-optimized renditions, NOT the full-res sources in
// kaizen_illustrations/. Run `npm run optimize-art` after changing source art
// (the predev/prebuild hooks also do this automatically). See CLAUDE.md.
const cardIllustrationModules = import.meta.glob("../web_art/illustrations/*.webp", {
  eager: true,
  import: "default",
});

const CARD_ILLUSTRATION_MAP = Object.fromEntries(
  Object.entries(cardIllustrationModules).map(([path, src]) => {
    const fileName = path.split("/").pop() || "";
    const name = fileName.replace(/\.(png|jpe?g|webp)$/i, "");
    return [name, src];
  })
);

export function getCardIllustrationSrc(cardName) {
  return CARD_ILLUSTRATION_MAP[cardName] || null;
}
