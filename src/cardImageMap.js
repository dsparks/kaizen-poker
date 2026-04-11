const cardIllustrationModules = import.meta.glob("../kaizen_illustrations/*.{png,jpg,jpeg,webp}", {
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
