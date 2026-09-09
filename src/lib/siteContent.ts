// Tekst javne pocetne stranice (src/app/page.tsx) -- admin ga menja na
// /admin/pocetna, umesto da bude hardkodovan u kodu. Fiksni skup kljuceva
// (admin menja VREDNOST, ne dodaje/brise kljuceve) -- svaki kljuc ima
// default ovde, koji se koristi ako red iz nekog razloga fali u bazi
// (nikad "prazna" javna stranica).

export const SITE_CONTENT_DEFAULTS = {
  header_title: "Srpskomuvanje",
  header_login_label: "Prijava",
  hero_kicker: "Srpskomuvanje",
  hero_badge: "Napravljeno za Srbe, od Srba",
  hero_title_line1: "Uđi.",
  hero_title_line2: "Vidi ko je tu.",
  hero_subtitle:
    "Srpska dating aplikacija u kojoj se stvarno nešto dešava — ne još jedan beskrajan spisak profila, već real-time upoznavanje, flert i radoznalost.",
  hero_cta: "Uđi besplatno",
  hero_note: "18+ · Besplatno za početak",
  feature_1_emoji: "🔥",
  feature_1_title: "Sada",
  feature_1_text: "Ne listaš profile u prazno. Vidiš šta se dešava upravo sada — ko je nov, ko te je lajkovao, ko je blizu.",
  feature_2_emoji: "🔥",
  feature_2_title: "Muvaj",
  feature_2_text: "Swipe kartice sa fotografijama, kratkim video snimcima i personalizovanim Match Score-om.",
  feature_3_emoji: "❤️",
  feature_3_title: "Match",
  feature_3_text: "Kad se međusobno lajkujete, otvara se razgovor u trenutku. Bez čekanja, bez nagađanja.",
  feature_4_emoji: "😈",
  feature_4_title: "18+ Muvanje",
  feature_4_text:
    "Za kad si direktan/na i znaš šta hoćeš. Vidiš ko je večeras raspoložen za krevet i pišeš im odmah, potpuno diskretno — odvojeno od običnog chata.",
  feature_5_emoji: "⚔️",
  feature_5_title: "Duel",
  feature_5_text: "Dva profila, jedno pitanje — 'Ko ti je više tvoj tip?' Zabavno, anonimno za obe strane, i uči algoritam tvoj ukus.",
  feature_6_emoji: "🌙",
  feature_6_title: "Večeras",
  feature_6_text: "Noću se app menja — 'Ko je još budan?' pokazuje ko je stvarno raspoložen za upoznavanje večeras.",
  premium_title: "Premium",
  premium_text:
    "Vidi ko te je lajkovao, dobij više tajnih iskri i duela, napredne filtere i profile boost. Besplatna verzija ostaje dovoljno dobra da uđeš i uživaš.",
  bottom_cta_title: "Spreman/na?",
  bottom_cta_button: "Uđi besplatno",
  footer_age_note: "Srpskomuvanje je namenjeno isključivo punoletnim osobama (18+).",
  footer_contact_label: "Prijava zloupotrebe / kontakt:",
} as const;

export type SiteContentKey = keyof typeof SITE_CONTENT_DEFAULTS;
export type SiteContent = Record<SiteContentKey, string>;

export const SITE_CONTENT_FIELDS: { key: SiteContentKey; label: string; section: string; multiline?: boolean }[] = [
  { key: "header_title", label: "Naslov u zaglavlju", section: "Zaglavlje" },
  { key: "header_login_label", label: "Dugme „Prijava“", section: "Zaglavlje" },

  { key: "hero_kicker", label: "Mali tekst iznad značke", section: "Hero (vrh strane)" },
  { key: "hero_badge", label: "Tekst u značci", section: "Hero (vrh strane)" },
  { key: "hero_title_line1", label: "Naslov — 1. red", section: "Hero (vrh strane)" },
  { key: "hero_title_line2", label: "Naslov — 2. red (u boji)", section: "Hero (vrh strane)" },
  { key: "hero_subtitle", label: "Podnaslov", section: "Hero (vrh strane)", multiline: true },
  { key: "hero_cta", label: "Dugme (gore)", section: "Hero (vrh strane)" },
  { key: "hero_note", label: "Tekst ispod dugmeta", section: "Hero (vrh strane)" },

  { key: "feature_1_emoji", label: "Kartica 1 — emoji", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_1_title", label: "Kartica 1 — naslov", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_1_text", label: "Kartica 1 — opis", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)", multiline: true },
  { key: "feature_2_emoji", label: "Kartica 2 — emoji", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_2_title", label: "Kartica 2 — naslov", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_2_text", label: "Kartica 2 — opis", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)", multiline: true },
  { key: "feature_3_emoji", label: "Kartica 3 — emoji", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_3_title", label: "Kartica 3 — naslov", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_3_text", label: "Kartica 3 — opis", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)", multiline: true },
  { key: "feature_4_emoji", label: "Kartica 4 — emoji", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_4_title", label: "Kartica 4 — naslov", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_4_text", label: "Kartica 4 — opis", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)", multiline: true },
  { key: "feature_5_emoji", label: "Kartica 5 — emoji", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_5_title", label: "Kartica 5 — naslov", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_5_text", label: "Kartica 5 — opis", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)", multiline: true },
  { key: "feature_6_emoji", label: "Kartica 6 — emoji", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_6_title", label: "Kartica 6 — naslov", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)" },
  { key: "feature_6_text", label: "Kartica 6 — opis", section: "Kartice (Sada / Muvaj / Match / 18+ / Duel / Večeras)", multiline: true },

  { key: "premium_title", label: "Naslov", section: "Premium sekcija" },
  { key: "premium_text", label: "Opis", section: "Premium sekcija", multiline: true },

  { key: "bottom_cta_title", label: "Naslov", section: "Dno strane" },
  { key: "bottom_cta_button", label: "Dugme", section: "Dno strane" },

  { key: "footer_age_note", label: "Napomena o godinama", section: "Footer" },
  { key: "footer_contact_label", label: "Oznaka kontakta (pre email adrese)", section: "Footer" },
];

export function mergeSiteContent(rows: { key: string; value: string }[] | null | undefined): SiteContent {
  const merged = { ...SITE_CONTENT_DEFAULTS } as SiteContent;
  for (const row of rows ?? []) {
    if (row.key in merged) merged[row.key as SiteContentKey] = row.value;
  }
  return merged;
}
