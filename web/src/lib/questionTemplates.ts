export const QUESTION_TEMPLATES: Record<string, string[]> = {
  laptop: [
    "What stickers are on the lid?",
    "What color is the case or sleeve?",
    "Any visible scratches or dents? Where?",
    "What's the desktop wallpaper?",
    "Any unique marks or engravings?",
  ],
  phone: [
    "What case color or design?",
    "Is there a screen protector? What kind?",
    "What's the lock screen wallpaper?",
    "Any cracks or scratches? Where?",
    "Any charms or accessories attached?",
  ],
  "credit-card": [
    "What bank/issuer is the card from?",
    "What color is the card?",
    "Last 4 digits of the card number?",
    "Any stickers or customization?",
    "What type of card (debit/credit/prepaid)?",
  ],
  wallet: [
    "What color is the wallet?",
    "What brand/logo is visible?",
    "Any unique wear or damage?",
    "What's in the front pocket/slot?",
    "Any cards visible? Which ones?",
  ],
  bag: [
    "What brand/logo is on it?",
    "What color is the main material?",
    "Any keychains or tags attached?",
    "What's the zipper/closure style?",
    "Any visible damage or stains?",
  ],
  jewelry: [
    "What type of metal/material?",
    "Any gemstones? What color?",
    "Any engravings or inscriptions?",
    "What's the clasp/closure type?",
    "Any unique design features?",
  ],
  sunglasses: [
    "What brand/logo is visible?",
    "What color are the frames?",
    "What color/tint are the lenses?",
    "Any scratches or damage?",
    "Any case details?",
  ],
  other: [
    "What's the main color?",
    "Any brand or logo visible?",
    "Any unique marks or damage?",
    "What material is it made of?",
    "Any attached accessories?",
  ],
};

export const NUM_QUESTIONS = 5;
export const DEFAULT_THRESHOLD = 3;

export function getQuestionsForCategory(categoryId: string): string[] {
  return QUESTION_TEMPLATES[categoryId] || QUESTION_TEMPLATES.other;
}

export function getCategoryLabel(categoryId: string): string {
  const labels: Record<string, string> = {
    laptop: "Laptop",
    phone: "Phone",
    "credit-card": "Credit Card",
    wallet: "Wallet",
    bag: "Bag",
    jewelry: "Jewelry",
    sunglasses: "Sunglasses",
    other: "Other",
  };
  return labels[categoryId] || "Item";
}
