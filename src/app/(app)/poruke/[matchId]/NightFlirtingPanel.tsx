"use client";

import { useRef, useState } from "react";
import { X, Loader2, Image as ImageIcon, Camera, Video as VideoIcon, FolderOpen } from "lucide-react";
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

  const galleryPhotoRef = useRef<HTMLInputElement>(null);
  const cameraPhotoRef = useRef<HTMLInputElement>(null);
  const galleryVideoRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLInputElement>(null);

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

  function handlePick(e: React.ChangeEvent<HTMLInputElement>, kind: "photo" | "video") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (kind === "photo") {
      if (file.size > MAX_RAW_PHOTO_PICK_BYTES) {
        setError("Fotografija je prevelika (maksimalno 20MB).");
        return;
      }
      uploadPhoto(file);
    } else {
      if (file.size > MAX_RAW_VIDEO_PICK_BYTES) {
        setError("Video je prevelik (maksimalno 25MB).");
        return;
      }
      uploadVideo(file);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl bg-[var(--color-bg-card)] p-5 sm:rounded-3xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            🌙 <span className="text-gradient">Noćno muvanje</span>
          </h2>
          <button type="button" onClick={onClose} className="tap-scale text-[var(--color-text-muted)]" aria-label="Zatvori">
            <X size={20} />
          </button>
        </div>

        {limitReached ? (
          <div className="py-6 text-center">
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
            <p className="mb-1 text-sm font-semibold">😈 Pokaži svoj najjači adut</p>
            <p className="mb-4 text-xs text-[var(--color-text-muted)]">
              Što manje odeće, to bolje (najveće šanse bez odeće)
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  logNightEvent("night_flirting_gallery_opened", { kind: "photo" });
                  galleryPhotoRef.current?.click();
                }}
                className="tap-scale flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-border-strong)] px-3 py-4"
              >
                <ImageIcon size={22} />
                <span className="text-xs">Izaberi iz galerije</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  logNightEvent("night_flirting_camera_opened", { kind: "photo" });
                  cameraPhotoRef.current?.click();
                }}
                className="tap-scale flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-border-strong)] px-3 py-4"
              >
                <Camera size={22} />
                <span className="text-xs">Snimi sada</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  logNightEvent("night_flirting_gallery_opened", { kind: "video" });
                  galleryVideoRef.current?.click();
                }}
                className="tap-scale flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-border-strong)] px-3 py-4"
              >
                <FolderOpen size={22} />
                <span className="text-xs">Izaberi video</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  logNightEvent("night_flirting_camera_opened", { kind: "video" });
                  cameraVideoRef.current?.click();
                }}
                className="tap-scale flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-border-strong)] px-3 py-4"
              >
                <VideoIcon size={22} />
                <span className="text-xs">Snimi video</span>
              </button>
            </div>

            <p className="mt-3 text-center text-xs text-[var(--color-text-faint)]">
              Preostalo danas: {Math.max(dailyLimit - sentToday, 0)}
            </p>
          </>
        )}

        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <input ref={galleryPhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePick(e, "photo")} />
        <input
          ref={cameraPhotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePick(e, "photo")}
        />
        <input ref={galleryVideoRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => handlePick(e, "video")} />
        <input
          ref={cameraVideoRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePick(e, "video")}
        />
      </div>
    </div>
  );
}
