// Vise slika je opet dozvoljeno (bilo ogranicено na 1 -- korisnici su
// trazili da mogu da vide vise slika tudjeg profila kao deo Credits/Premium
// paywall-a, sto zahteva da uopste POSTOJI vise slika za otkljucavanje).
// Prva (GLAVNA) je uvek besplatno vidljiva svima; ostale su zamucene dok
// gledalac ne plati -- vidi profil/[id]/page.tsx.
export const MAX_PHOTOS = 6;
export const MAX_VIDEOS = 1;

// Gornja granica za fajl KOJI KORISNIK BIRA, pre kompresije na klijentu.
export const MAX_RAW_PHOTO_PICK_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_RAW_VIDEO_PICK_BYTES = 25 * 1024 * 1024; // 25MB (mora stati i u Storage limit)

export const MAX_VIDEO_DURATION_SECONDS = 15;

export const PHOTO_MAIN_MAX_DIMENSION = 1440;
export const PHOTO_THUMB_SIZE = 400;
export const PHOTO_MAIN_QUALITY = 0.82;
export const PHOTO_THUMB_QUALITY = 0.75;

export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
