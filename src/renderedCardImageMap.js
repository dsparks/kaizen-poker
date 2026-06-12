// Imports the web-optimized renditions, NOT the full-res sources in
// rendered_kaizen_cards/. See CLAUDE.md ("Card art pipeline").
const renderedCardModules = import.meta.glob("../web_art/rendered/*.webp", {
  eager: true,
  import: "default",
});

const RENDERED_CARD_IMAGE_MAP = Object.fromEntries(
  Object.entries(renderedCardModules).map(([path, src]) => {
    const fileName = path.split("/").pop() || "";
    const name = fileName.replace(/\.(png|jpe?g|webp)$/i, "");
    return [name, src];
  })
);

export function getRenderedCardSrc(cardName) {
  return RENDERED_CARD_IMAGE_MAP[cardName] || null;
}
