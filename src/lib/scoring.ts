// Profile Completion Score (sekcija 9) — jedina, deljena definicija.
// Koristi se i pri onboardingu (bez fotografija) i posle svakog
// dodavanja/brisanja fotografije ili videa, da bi broj UVEK odražavao
// stvarno stanje profila, nikad izmišljenu ili zastarelu vrednost.

export interface CompletionInput {
  hasCity: boolean;
  hasBio: boolean;
  interestsCount: number;
  photoCount: number;
  hasVideo: boolean;
}

export function computeProfileCompletionScore(input: CompletionInput): number {
  let score = 20; // ime + datum rođenja + pol — obavezno pri registraciji, uvek popunjeno
  if (input.hasCity) score += 10;
  if (input.hasBio) score += 10;
  if (input.interestsCount >= 3) score += 10;
  if (input.photoCount >= 1) score += 25; // profilna fotografija je najjači signal kvaliteta
  if (input.photoCount >= 3) score += 10;
  if (input.hasVideo) score += 15;
  return Math.min(100, score);
}
