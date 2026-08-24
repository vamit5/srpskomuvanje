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

// Malo direktniji/vatreniji ton za 18+ Muvanje chat -- i dalje BEZ
// graficnog seksualnog sadrzaja (vidi objasnjenje u razgovoru zasto to
// namerno ne generisemo).
export const ICEBREAKERS_HOT = [
  "Šta te večeras najviše pali? 😈",
  "Da ne gubimo vreme na fore — šta tražiš večeras?",
  "Igramo se? Prvo pitanje: šta ti je najveća slabost?",
  "Delujiš opasno zanimljivo... nastavi 😏",
  "Piće kod tebe ili kod mene? 🍸",
  "Reci mi nešto što bi me iznenadilo.",
] as const;

export function pickIcebreakers(count = 3, hot = false): string[] {
  const source = hot ? ICEBREAKERS_HOT : ICEBREAKERS;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
