const cardImageModules = import.meta.glob("../rendered_kaizen_cards/*.png", {
  eager: true,
  import: "default",
});

export const CARD_IMAGE_MAP = Object.fromEntries(
  Object.entries(cardImageModules).map(([path, src]) => {
    const fileName = path.split("/").pop() || "";
    const name = fileName.replace(/\.png$/i, "");
    return [name, src];
  })
);

export function getCardImageSrc(cardName) {
  return CARD_IMAGE_MAP[cardName] || null;
}
