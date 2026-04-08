const renderedCardModules = import.meta.glob("../rendered_kaizen_cards/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
});

export const RENDERED_CARD_IMAGE_MAP = Object.fromEntries(
  Object.entries(renderedCardModules).map(([path, src]) => {
    const fileName = path.split("/").pop() || "";
    const name = fileName.replace(/\.(png|jpe?g|webp)$/i, "");
    return [name, src];
  })
);

export function getRenderedCardSrc(cardName) {
  return RENDERED_CARD_IMAGE_MAP[cardName] || null;
}
