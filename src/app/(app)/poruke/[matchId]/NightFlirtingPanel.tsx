"use client";

import { useRef, useState } from "react";
import { X, Loader2, Image as ImageIcon, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, makeBlurredPreview } from "@/lib/media/image";
import { captureVideoFrames, readVideoMeta } from "@/lib/media/video";
import {
  MAX_RAW_PHOTO_PICK_BYTES,
  MAX_RAW_VIDEO_PICK_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  PHOTO_MAIN_MAX_DIMENSION,
  PHOTO_MAIN_QUALITY,
} from "@/lib/media/constants";
import { sendNightFlirtingPhoto, sendNightFlirtingVideo, logNightEvent } from "../../_night/actions";

function extForBlob(blob: Blob, fallback: string): string {
  if (blob.type === "image/png") return "png";
  if (blob.type === "image/jpeg") return "jpg";
  if (blob.type === "image/webp") return "webp";
  return fallback;
}

export function NightFlirtingPanel({
  matchId,
  sentToday,
  dailyLimit,
  onClose,
  onSent,
}: {
  matchId: string;
  sentToday: number;
  dailyLimit: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const limitReached = sentToday >= dailyLimit;

  async function uploadPhoto(file: File) {
    setBusy("Šaljem...");
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Nisi prijavljen/a.");
      setBusy(null);
      return;
    }

    let originalPath = "";
    let previewPath = "";
    try {
      await logNightEvent("night_flirting_media_selected", { kind: "photo" });
      const { blob: mainBlob } = await compressImage(file, {
        maxDimension: PHOTO_MAIN_MAX_DIMENSION,
        quality: PHOTO_MAIN_QUALITY,
      });
      const previewBlob = await makeBlurredPreview(mainBlob);

      const id = crypto.randomUUID();
      originalPath = `${user.id}/${id}/original.${extForBlob(mainBlob, "webp")}`;
      previewPath = `${user.id}/${id}/preview.${extForBlob(previewBlob, "webp")}`;

      await logNightEvent("night_flirting_upload_started", { kind: "photo" });

      const { error: err1 } = await supabase.storage
        .from("night-flirting")
        .upload(originalPath, mainBlob, { contentType: mainBlob.type || "image/webp" });
      if (err1) throw new Error(`Upload nije uspeo: ${err1.message}`);

      const { error: err2 } = await supabase.storage
        .from("night-flirting")
        .upload(previewPath, previewBlob, { contentType: previewBlob.type || "image/webp" });
      if (err2) throw new Error(`Upload preview-a nije uspeo: ${err2.message}`);

      setBusy("Proveravam sadržaj...");
      const result = await sendNightFlirtingPhoto({
        matchId,
        originalPath,
        previewPath,
        classifyPaths: [originalPath],
      });
      if (result.error) throw new Error(result.error);

      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nešto nije u redu, probaj ponovo.");
      if (originalPath) await supabase.storage.from("night-flirting").remove([originalPath, previewPath].filter(Boolean));
    } finally {
      setBusy(null);
    }
  }

  async function uploadVideo(file: File) {
    setBusy("Šaljem...");
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Nisi prijavljen/a.");
      setBusy(null);
      return;
    }

    let originalPath = "";
    let previewPath = "";
    let framePaths: string[] = [];
    try {
      await logNightEvent("night_flirting_media_selected", { kind: "video" });
      const meta = await readVideoMeta(file);
      if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
        throw new Error(`Video mora biti kraći od ${MAX_VIDEO_DURATION_SECONDS} sekundi (tvoj traje ${Math.round(meta.duration)}s).`);
      }

      const frames = await captureVideoFrames(file, [0.15, 0.5, 0.85]);
      if (!frames.length) throw new Error("Ne mogu da obradim ovaj video.");
      const previewBlob = await makeBlurredPreview(frames[Math.floor(frames.length / 2)]);

      const id = crypto.randomUUID();
      const uploadContentType = file.type || "video/mp4";
      const ext = uploadContentType === "video/webm" ? "webm" : uploadContentType === "video/quicktime" ? "mov" : "mp4";
      originalPath = `${user.id}/${id}/original.${ext}`;
      previewPath = `${user.id}/${id}/preview.${extForBlob(previewBlob, "webp")}`;
      framePaths = frames.map((_, i) => `${user.id}/${id}/frame-${i}.webp`);

      await logNightEvent("night_flirting_upload_started", { kind: "video" });

      const { error: errVideo } = await supabase.storage
        .from("night-flirting")
        .upload(originalPath, file, { contentType: uploadContentType });
      if (errVideo) throw new Error(`Upload videa nije uspeo: ${errVideo.message}`);

      const { error: errPreview } = await supabase.storage
        .from("night-flirting")
        .upload(previewPath, previewBlob, { contentType: previewBlob.type || "image/webp" });
      if (errPreview) throw new Error(`Upload preview-a nije uspeo: ${errPreview.message}`);

      for (let i = 0; i < frames.length; i++) {
        const { error: errFrame } = await supabase.storage
          .from("night-flirting")
          .upload(framePaths[i], frames[i], { contentType: frames[i].type || "image/webp" });
        if (errFrame) throw new Error(`Upload frejma nije uspeo: ${errFrame.message}`);
      }

      setBusy("Proveravam sadržaj...");
      const result = await sendNightFlirtingVideo({
        matchId,
        originalPath,
        previewPath,
        classifyPaths: framePaths,
        framePaths,
        durationSeconds: meta.duration,
      });
      if (result.error) throw new Error(result.error);

      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nešto nije u redu, probaj ponovo.");
      if (originalPath) {
        await supabase.storage.from("night-flirting").remove([originalPath, previewPath, ...framePaths].filter(Boolean));
      }
    } finally {
      setBusy(null);
    }
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    // Jedno polje prihvata i foto i video (accept="image/*,video/*") --
    // pravi izbor foto/video pravi sam OS (galerija/kamera aplikacija), mi
    // samo prepoznamo šta je korisnik zapravo poslao po stvarnom tipu fajla.
    const isVideo = file.type.startsWith("video/");
    if (isVideo) {
      if (file.size > MAX_RAW_VIDEO_PICK_BYTES) {
        setError("Video je prevelik (maksimalno 25MB).");
        return;
      }
      uploadVideo(file);
    } else {
      if (file.size > MAX_RAW_PHOTO_PICK_BYTES) {
        setError("Fotografija je prevelika (maksimalno 20MB).");
        return;
      }
      uploadPhoto(file);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-[var(--color-bg-card)] sm:rounded-3xl">
        <div className="relative overflow-hidden bg-gradient-accent px-5 pb-6 pt-5 text-white">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-3xl">🌙</span>
            <button
              type="button"
              onClick={onClose}
              className="tap-scale flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white"
              aria-label="Zatvori"
            >
              <X size={18} />
            </button>
          </div>
          {!limitReached && !busy && (
            <>
              <h2 className="text-xl font-extrabold leading-tight">😈 Pokaži svoj najjači adut</h2>
              <p className="mt-1 text-sm text-white/85">Što manje odeće, to bolje (najveće šanse bez odeće)</p>
            </>
          )}
          {(limitReached || busy) && <h2 className="text-xl font-extrabold">Noćno muvanje</h2>}
        </div>

        <div className="p-5">
          {limitReached ? (
            <div className="py-4 text-center">
              <p className="text-3xl">🌙</p>
              <p className="mt-2 font-semibold">Iskoristio/la si dnevni limit</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Vrati se sutra, ili postani Premium za veći dnevni limit.
              </p>
            </div>
          ) : busy ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin text-[var(--color-accent)]" />
              <p className="text-sm text-[var(--color-text-muted)]">{busy}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    logNightEvent("night_flirting_gallery_opened", {});
                    galleryRef.current?.click();
                  }}
                  className="tap-scale flex flex-col items-center gap-2 rounded-2xl bg-[var(--color-bg-elevated)] px-3 py-6 active:brightness-110"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-accent text-white">
                    <ImageIcon size={22} />
                  </span>
                  <span className="text-xs font-medium">Izaberi iz galerije</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logNightEvent("night_flirting_camera_opened", {});
                    cameraRef.current?.click();
                  }}
                  className="tap-scale flex flex-col items-center gap-2 rounded-2xl bg-[var(--color-bg-elevated)] px-3 py-6 active:brightness-110"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-accent text-white">
                    <Camera size={22} />
                  </span>
                  <span className="text-xs font-medium">Snimi sada</span>
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-[var(--color-text-faint)]">
                Foto ili video — bira se automatski. Preostalo danas: {Math.max(dailyLimit - sentToday, 0)}
              </p>
            </>
          )}

          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
        </div>

        <input ref={galleryRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={handlePick} />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          capture="environment"
          className="hidden"
          onChange={handlePick}
        />
      </div>
    </div>
  );
}
