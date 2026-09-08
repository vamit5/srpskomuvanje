// Predlozi poruka (chip-ovi iznad polja za kucanje) sad zive u bazi
// (tabela chat_suggestions) -- admin ih menja/dodaje na /admin/predlozi.
// Ovaj fajl je namerno cist/klijent-bezbedan (bez baze) -- samo bira i
// rotira predloge iz vec ucitanog "bazena" po FAZI razgovora (koliko
// poruka je vec razmenjeno -- ranija faza je lezerna/znatizeljna, kasnija
// direktnija). Ucitavanje iz baze je u src/lib/chatSuggestions.ts
// (server-only), poziva se u page.tsx za /poruke/[matchId] i
// /18-plus/chat/[matchId].

export interface SuggestionPool {
  stage1: string[];
  stage2: string[];
  stage3: string[];
}

export const EMPTY_SUGGESTION_POOL: SuggestionPool = { stage1: [], stage2: [], stage3: [] };

/**
 * @param pool Predlozi za jednu kategoriju (normal/hot), vec podeljeni po fazi.
 * @param messageCount Koliko poruka je do sad razmenjeno u ovom razgovoru --
 *   bira "fazu" predloga (leza -> flertujuca -> direktna/foto-poziv).
 * @param seedOffset Menja izbor unutar iste faze bez menjanja faze -- koristi
 *   se za "🔄 Novi predlozi" dugme da korisnik uvek moze da trazi svez set.
 * @param count Koliko predloga vratiti.
 */
export function pickIcebreakers(pool: SuggestionPool, messageCount = 0, seedOffset = 0, count = 3): string[] {
  const stage = messageCount < 2 ? 1 : messageCount < 10 ? 2 : 3;
  const arr = stage === 1 ? pool.stage1 : stage === 2 ? pool.stage2 : pool.stage3;
  if (!arr.length) return [];

  // Deterministicki "shuffle" zasnovan na seedOffset (ne cist Math.random na
  // svakom renderu) -- svaki klik na "Novi predlozi" povecava seedOffset i
  // garantovano daje drugaciji redosled, bez rizika od hydration mismatch-a.
  const offset = seedOffset % arr.length;
  const rotated = [...arr.slice(offset), ...arr.slice(0, offset)];
  return rotated.slice(0, count);
}
