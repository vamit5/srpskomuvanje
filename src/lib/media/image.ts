// Kompresija/resize slika direktno u browseru (Canvas API), pre uploada.
// Zašto na klijentu, a ne na serveru: uploadujemo direktno u Supabase Storage
// (vidi FotoVideoManager.tsx) da bismo izbegli limite veličine requesta na
// serverless platformama — što znači da naš server nikad ne vidi sirovi
// fajl, pa mora da se kompresuje pre nego što ode na mrežu. Kao bonus,
// canvas export automatski uklanja EXIF metapodatke (uključujući GPS lokaciju
// slike) — dobro za privatnost.

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Ne mogu da obradim ovu sliku."))),
      type,
      quality
    );
  });
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Ovaj format slike nije podržan u tvom pregledaču. Probaj drugu fotografiju (JPG, PNG ili WebP)."
    );
  }
}

export async function compressImage(
  file: File,
  { maxDimension, quality = 0.82, mimeType = "image/webp" }: { maxDimension: number; quality?: number; mimeType?: string }
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await decodeImage(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Ovaj pregledač ne podržava obradu slika.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvasToBlob(canvas, mimeType, quality);
  return { blob, width, height };
}

/**
 * Bezbedan zamućen preview za zaključan Noćno muvanje sadržaj -- ne sme se
 * moći "izoštriti" nazad do detalja. Zato prvo drastično smanjimo rezoluciju
 * (uništava detalje trajno, za razliku od samog CSS/canvas blur-a koji na
 * jakim izvornim slikama ume da ostavi prepoznatljive konture), pa uveličamo
 * i dodamo blur filter preko toga za mek, "koža vidljiva ali ništa oštro"
 * izgled.
 */
export async function makeBlurredPreview(
  file: File | Blob,
  { size = 500, pixelateSteps = 24, quality = 0.7 }: { size?: number; pixelateSteps?: number; quality?: number } = {}
): Promise<Blob> {
  const bitmap = await decodeImage(file as File);
  const minSide = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - minSide) / 2;
  const sy = (bitmap.height - minSide) / 2;

  const tiny = document.createElement("canvas");
  tiny.width = pixelateSteps;
  tiny.height = pixelateSteps;
  const tinyCtx = tiny.getContext("2d");
  if (!tinyCtx) throw new Error("Ovaj pregledač ne podržava obradu slika.");
  tinyCtx.drawImage(bitmap, sx, sy, minSide, minSide, 0, 0, pixelateSteps, pixelateSteps);
  bitmap.close();

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Ovaj pregledač ne podržava obradu slika.");
  ctx.filter = "blur(14px)";
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tiny, -10, -10, size + 20, size + 20);

  return canvasToBlob(canvas, "image/webp", quality);
}

export async function makeSquareThumbnail(
  file: File,
  { size = 400, quality = 0.75, mimeType = "image/webp" }: { size?: number; quality?: number; mimeType?: string } = {}
): Promise<Blob> {
  const bitmap = await decodeImage(file);
  const minSide = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - minSide) / 2;
  const sy = (bitmap.height - minSide) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Ovaj pregledač ne podržava obradu slika.");
  ctx.drawImage(bitmap, sx, sy, minSide, minSide, 0, 0, size, size);
  bitmap.close();

  return canvasToBlob(canvas, mimeType, quality);
}
