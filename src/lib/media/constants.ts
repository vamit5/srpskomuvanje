// Namerno 1 -- cilj je da korisnici chatuju i tamo razmenjuju slike/snimke
// (i placeni "Nocni flert" sadrzaj), ne da gomilaju galeriju na profilu.
export const MAX_PHOTOS = 1;
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
