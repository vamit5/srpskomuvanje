// Filter koji sprečava razmenu kontakt podataka (broj telefona, mejl) i
// predloge za prelazak na drugu aplikaciju (WhatsApp, Viber...) u chatu --
// standardna praksa na platformama koje zavise od toga da korisnici ostanu
// unutra (Airbnb, Upwork, dating app-ovi). Ne cuva/salje sadrzaj nigde
// spolja -- radi lokalno nad tekstom poruke pre upisa u bazu.

// NAPOMENA: sve reci ovde su vec u "normalizovanom" obliku (bez dijakritika
// -- s/c/z/dj umesto š/č,ć/ž/đ), jer se porede sa normalize(text) nizeg dole
// -- kljucna rec sa dijakritikom ovde NIKAD ne bi bila pronadjena.
const OFF_PLATFORM_KEYWORDS = [
  "whatsapp", "watsap", "vatsap", "wasap",
  "viber",
  "telegram",
  "snapchat", "snap",
  "instagram", "insta", "ig:",
  "signal app",
  "moj broj", "broj telefona", "moj telefon",
  "pozovi me", "nazovi me",
  "dodaj me na", "dodaj me na broj",
  "predjimo na", "predji na",
  "izvan aplikacije", "van aplikacije", "van app",
  "mejl adresa", "email adresa", "moj mejl", "moj email",
];

// Srpske reci za cifre 0-9 (bez dijakritika, posle normalizacije) -- za
// hvatanje brojeva ispisanih recima ("nula šezdeset jedan...").
const DIGIT_WORDS = [
  "nula", "jedan", "jedna", "dva", "dve", "tri", "cetiri", "pet",
  "sest", "sedam", "osam", "devet",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/š/g, "s")
    .replace(/č|ć/g, "c")
    .replace(/ž/g, "z")
    .replace(/đ/g, "dj");
}

/** Skida sve osim cifara -- da uhvati "061 234 5678" i "061-234-5678" isto kao "0612345678". */
function digitRunLength(text: string): number {
  let maxRun = 0;
  let current = 0;
  for (const ch of text) {
    if (/[0-9]/.test(ch)) {
      current++;
      maxRun = Math.max(maxRun, current);
    } else if (/[\s\-.()/]/.test(ch)) {
      // separator izmedju cifara -- ne prekida niz
      continue;
    } else {
      current = 0;
    }
  }
  return maxRun;
}

function hasWordSpelledNumber(normalized: string): boolean {
  const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
  let run = 0;
  for (const t of tokens) {
    if (DIGIT_WORDS.includes(t)) {
      run++;
      if (run >= 5) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export interface ContentFilterResult {
  blocked: boolean;
  reason: string | null;
}

export function checkContactInfoFilter(rawText: string): ContentFilterResult {
  const normalized = normalize(rawText);

  if (EMAIL_RE.test(rawText)) {
    return { blocked: true, reason: "Mejl adrese ne mogu da se šalju u porukama -- ostanite u chatu na aplikaciji." };
  }

  if (digitRunLength(rawText) >= 6) {
    return { blocked: true, reason: "Brojevi telefona ne mogu da se šalju u porukama -- ostanite u chatu na aplikaciji." };
  }

  if (hasWordSpelledNumber(normalized)) {
    return { blocked: true, reason: "Izgleda da si ispisao/la broj rečima -- brojevi telefona nisu dozvoljeni u porukama." };
  }

  for (const kw of OFF_PLATFORM_KEYWORDS) {
    if (normalized.includes(kw)) {
      return {
        blocked: true,
        reason: "Prelazak na drugu aplikaciju nije dozvoljen -- ćaskajte ovde, na Srpskomuvanju.",
      };
    }
  }

  return { blocked: false, reason: null };
}
