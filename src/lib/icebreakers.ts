// Kurirani (ne AI-generisani) predlozi poruka -- prikazuju se kao chip-ovi
// iznad polja za kucanje, korisnik klikne da popuni polje (ne salje
// automatski). Namerno BEZ eksplicitnog seksualnog sadrzaja (opisi
// polnih organa, eksplicitni seksualni cinovi i sl.) -- necemo da
// generisemo grafican seksualni tekst za ubacivanje u tudju prepisku,
// cak ni za 18+ sekciju. Umesto toga: flertujuce, provokativne,
// dvosmislene poruke koje prirodno vode ka postojecoj placenoj funkciji
// (slanje slika/snimaka kroz chat) -- to je legitiman nacin da predlozi
// "rade posao" bez eksplicitnog sadrzaja.
//
// Predlozi se biraju po FAZI razgovora (koliko poruka je vec razmenjeno)
// -- ranija faza je leza/znatizeljna, kasnija faza je direktnija i gura
// ka slanju slika/dogovoru za sastanak. Ovo resava "uvek iznova generisi
// tokom celog chata" zahtev bez potrebe za live AI pozivom.

const NORMAL_STAGE_1 = [
  "Ej, šta radiš večeras? 😏",
  "Koji je tvoj plan za vikend?",
  "Sviđa mi se tvoja slika sa... reci mi više o tome 👀",
  "Kafa ili piće — šta biraš prvo?",
  "Koja ti je omiljena kafana u gradu?",
  "Delujiš zanimljivo, moram da pitam — šta te najviše pali kod ljudi?",
  "Da probamo nešto ludo — ti pitaš, ja odgovaram, pa obrnuto?",
] as const;

const NORMAL_STAGE_2 = [
  "Ok, sad ozbiljno — kakav je tvoj idealan izlazak?",
  "Da li si više za kafu popodne ili piće uveče?",
  "Šta te je nasmejalo poslednje?",
  "Iskreno, koja ti je najbolja osobina?",
  "Kad bismo se sad videli, gde bi me poveo/la?",
  "Nešto mi govori da si zabavan/na — dokaži 😏",
] as const;

const NORMAL_STAGE_3 = [
  "Mislim da je vreme da se vidimo uživo — kad ti odgovara?",
  "Radije bih te upoznao/la uživo nego kroz ekran, šta kažeš?",
  "Predlažem kafu ovog vikenda — da ili ne?",
  "Osećam dobru energiju — da zakažemo nešto?",
  "Dosta pričanja, hajde da se stvarno vidimo.",
] as const;

const HOT_STAGE_1 = [
  "Šta te večeras najviše pali? 😈",
  "Da ne gubimo vreme na fore — šta tražiš večeras?",
  "Igramo se? Prvo pitanje: šta ti je najveća slabost?",
  "Delujiš opasno zanimljivo... nastavi 😏",
  "Piće kod tebe ili kod mene? 🍸",
  "Reci mi nešto što bi me iznenadilo.",
] as const;

const HOT_STAGE_2 = [
  "Sve si zanimljiviji/a iz minuta u minut... šta bi uradio/la da sam tu?",
  "Kakvo je tvoje raspoloženje večeras — divlje ili opušteno? 😏",
  "Da igramo igru — ja postavim pitanje, ti odgovoriš iskreno, bez okolišanja.",
  "Zvučiš kao neko ko zna šta hoće. Šta hoćeš od večeras?",
  "Ok, dosta uvoda — šta bi prvo uradio/la kad bismo se videli?",
] as const;

const HOT_STAGE_3 = [
  "Pošalji mi jednu sliku da vidim šta propuštam 😏📸",
  "Slika vredi hiljadu reči... pokaži mi 😈",
  "Da vidimo se uživo ili prvo malo fotki za predukus? 📸",
  "Dosta pričanja — pokaži mi nešto posebno 🔥",
  "Kad ćemo prestati da pričamo i preći na nešto zanimljivije? 😏",
  "Radoznao/la sam — imaš nešto da mi pokažeš? 👀",
] as const;

/**
 * @param count Koliko predloga vratiti.
 * @param hot 18+ Muvanje chat -- direktniji ton, i dalje bez eksplicitnog sadrzaja.
 * @param messageCount Koliko poruka je do sad razmenjeno u ovom razgovoru --
 *   bira "fazu" predloga (leza -> flertujuca -> direktna/foto-poziv).
 * @param seedOffset Menja izbor unutar iste faze bez menjanja faze -- koristi
 *   se za "🔄 Novi predlozi" dugme da korisnik uvek moze da trazi svez set.
 */
export function pickIcebreakers(count = 3, hot = false, messageCount = 0, seedOffset = 0): string[] {
  const stage = messageCount < 2 ? 1 : messageCount < 10 ? 2 : 3;
  const pool = hot
    ? stage === 1
      ? HOT_STAGE_1
      : stage === 2
        ? HOT_STAGE_2
        : HOT_STAGE_3
    : stage === 1
      ? NORMAL_STAGE_1
      : stage === 2
        ? NORMAL_STAGE_2
        : NORMAL_STAGE_3;

  // Deterministicki "shuffle" zasnovan na seedOffset (ne cist Math.random na
  // svakom renderu) -- svaki klik na "Novi predlozi" povecava seedOffset i
  // garantovano daje drugaciji redosled, bez rizika od hydration mismatch-a.
  const rotated = [...pool.slice(seedOffset % pool.length), ...pool.slice(0, seedOffset % pool.length)];
  return rotated.slice(0, count);
}

// Zadrzano za eventualnu kompatibilnost/ostale pozive.
export const ICEBREAKERS = NORMAL_STAGE_1;
export const ICEBREAKERS_HOT = HOT_STAGE_1;
