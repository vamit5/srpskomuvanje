import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isRecentlyActive(lastActiveAt: string | null | undefined, windowMs: number): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < windowMs;
}

export function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export function calculateAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Srpsko brojno slaganje za "osoba te je lajkovala/lajkovalo": 1 = ženski
 * rod jednine, 2-4 (osim 12-14) = "osobe" (paucal množina), sve ostalo =
 * "osoba" (genitiv množine, isti oblik kao jednina) -- u oba slučaja sa
 * glagolom u srednjem rodu jednine, standardna konstrukcija broj+imenica.
 */
export function personCountPhrase(n: number, verb: string): string {
  if (n === 1) return `osoba te je ${verb}la`;
  const lastTwo = n % 100;
  const last = n % 10;
  const word = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "osobe" : "osoba";
  return `${word} te je ${verb}lo`;
}
