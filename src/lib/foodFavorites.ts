// Fiksni skup "srpskih" omiljenih stvari za onboarding pitanje (multi-select).
// NAMERNO bez "server-only" guarda -- koristi se i u klijentskoj komponenti
// (OnboardingWizard.tsx) i na serveru (src/lib/secretRoom.ts, chat banner).
export const FOOD_FAVORITE_OPTIONS = [
  { value: "sarma", label: "Sarma", emoji: "🥬" },
  { value: "pljeskavica", label: "Pljeskavica", emoji: "🍔" },
  { value: "cevapi", label: "Ćevapi", emoji: "🍢" },
  { value: "rakija", label: "Rakija", emoji: "🥃" },
  { value: "burek", label: "Burek", emoji: "🥐" },
] as const;

export type FoodFavorite = (typeof FOOD_FAVORITE_OPTIONS)[number]["value"];

export function foodFavoriteLabel(value: string): { label: string; emoji: string } {
  const found = FOOD_FAVORITE_OPTIONS.find((o) => o.value === value);
  return found ? { label: found.label, emoji: found.emoji } : { label: value, emoji: "🇷🇸" };
}
