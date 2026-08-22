// Vremenske pomoćne funkcije vezane za srpsku vremensku zonu (Europe/Belgrade),
// bez spoljnih biblioteka. Koristi se za Noćni mod (sekcija 14) i "Večeras"
// status koji ističe u 04:00 po lokalnom (beogradskom) vremenu (sekcija 15),
// bez obzira gde je hostovan server (Vercel je obično UTC).

function partsInTZ(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // Intl ume da vrati "24" za ponoć u nekim slučajevima -- normalizuj na 0.
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  };
}

/** Razlika (u minutima) između lokalnog vremena u Beogradu i UTC-a, za dati trenutak (DST-svesno). */
function belgradeOffsetMinutes(date: Date): number {
  const utc = partsInTZ(date, "UTC");
  const belgrade = partsInTZ(date, "Europe/Belgrade");
  const utcMs = Date.UTC(utc.year, utc.month - 1, utc.day, utc.hour, utc.minute);
  const belgradeMs = Date.UTC(belgrade.year, belgrade.month - 1, belgrade.day, belgrade.hour, belgrade.minute);
  return (belgradeMs - utcMs) / 60000;
}

/** Trenutno vreme u Beogradu kao "HH:MM" (24h). */
export function belgradeTimeHHMM(date: Date = new Date()): string {
  const { hour, minute } = partsInTZ(date, "Europe/Belgrade");
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Da li je "sada" (HH:MM) unutar dnevnog vremenskog okvira [startsAt, endsAt).
 * Podržava i opsege koji prelaze ponoć (npr. 22:00 -> 04:00).
 */
export function isWithinDailyWindow(nowHHMM: string, startsAt: string, endsAt: string): boolean {
  const now = toMinutes(nowHHMM);
  const start = toMinutes(startsAt);
  const end = toMinutes(endsAt);
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end;
}

/**
 * ISO timestamp sledećeg 04:00 po beogradskom vremenu (danas ako još nije
 * prošlo 4h ujutru, inače sutra). Koristi se za isticanje "Večeras" statusa.
 */
export function nextBelgrade4AMISO(date: Date = new Date()): string {
  const offsetMin = belgradeOffsetMinutes(date);
  // "Lažni" Date čiji UTC getteri odgovaraju beogradskim satima (standardni trik).
  const belgradeShifted = new Date(date.getTime() + offsetMin * 60000);

  const target = new Date(
    Date.UTC(belgradeShifted.getUTCFullYear(), belgradeShifted.getUTCMonth(), belgradeShifted.getUTCDate(), 4, 0, 0)
  );
  if (belgradeShifted.getUTCHours() >= 4) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  // Vrati u pravi UTC oduzimanjem offseta.
  return new Date(target.getTime() - offsetMin * 60000).toISOString();
}
