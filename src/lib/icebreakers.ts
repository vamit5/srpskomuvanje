// Kurirani (ne AI-generisani) predlozi poruka -- prikazuju se kao chip-ovi
// iznad polja za kucanje kad je razgovor prazan, korisnik klikne da
// popuni polje (ne salje automatski). Namerno BEZ eksplicitnog seksualnog
// sadrzaja -- vidi objasnjenje u razgovoru: ne generisemo grafican
// seksualni tekst za ubacivanje u tudju prepisku.
export const ICEBREAKERS = [
  "Ej, šta radiš večeras? 😏",
  "Koji je tvoj plan za vikend?",
  "Sviđa mi se tvoja slika sa... reci mi više o tome 👀",
  "Kafa ili piće — šta biraš prvo?",
  "Koja ti je omiljena kafana u gradu?",
  "Delujiš zanimljivo, moram da pitam — šta te najviše pali kod ljudi?",
  "Da probamo nešto ludo — ti pitaš, ja odgovaram, pa obrnuto?",
] as const;

export function pickIcebreakers(count = 3): string[] {
  const shuffled = [...ICEBREAKERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
