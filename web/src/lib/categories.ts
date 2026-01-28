export const itemCategories = [
  { value: "laptop", label: "Laptop computer" },
  { value: "phone", label: "Phone" },
  { value: "credit-card", label: "Credit card" },
  { value: "bag", label: "Bag / backpack" },
  { value: "jewelry", label: "Jewelry" },
  { value: "sunglasses", label: "Sunglasses" },
  { value: "other", label: "Other (custom)" },
] as const;

export const DEFAULT_CATEGORY = itemCategories[0].value;

export function resolveCategoryLabel(choice: string, customLabel: string) {
  return choice === "other" ? customLabel.trim() : choice;
}
