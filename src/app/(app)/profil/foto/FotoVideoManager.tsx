"use client";

import { useRef, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Loader2, Video as VideoIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, makeSquareThumbnail } from "@/lib/media/image";
import { captureVideoThumbnail, readVideoMeta } from "@/lib/media/video";
import {
  MAX_PHOTOS,
  MAX_VIDEOS,
  MAX_RAW_PHOTO_PICK_BYTES,
  MAX_RAW_VIDEO_PICK_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  PHOTO_MAIN_MAX_DIMENSION,
  PHOTO_THUMB_SIZE,
  PHOTO_MAIN_QUALITY,
  PHOTO_THUMB_QUALITY,
} from "@/lib/media/constants";
import { addPhoto, deletePhoto, reorderPhotos, addVideo, deleteVideo } from "./actions";
import { cn } from "@/lib/utils";

type ModerationStatus = "approved" | "pending" | "rejected";

interface PhotoRow {
  id: string;
  url: string;
  thumbnail_url: string | null;
  position: number;
  is_primary: boolean;
  moderation_status: ModerationStatus;
}

interface VideoRow {
  id: string;
  url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  moderation_status: ModerationStatus;
}

// Pozicionirano vertikalno na sredini (ne gore/dole) da ne pokrije GLAVNA/X
// dugme (gore) ni strelice za pomeranje (dole, samo kod fotografija).
function ModerationBadge({ status }: { status: ModerationStatus }) {
  if (status === "approved") return null;
  if (status === "pending") {
    return (
      <span className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md bg-[var(--color-warning)] px-1.5 py-1 text-center text-[10px] font-semibold leading-tight text-black">
        ⏳ Na proveri
      </span>
    );
  }
  return (
    <span className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md bg-[var(--color-danger)] px-1.5 py-1 text-center text-[10px] font-semibold leading-tight text-white">
      🚫 Odbijeno
    </span>
  );
}

export function FotoVideoManager({
  userId,
  initialPhotos,
  initialVideos,
}: {
  userId: string;
  initialPhotos: PhotoRow[];
  initialVideos: VideoRow[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [videos, setVideos] = useState(initialVideos);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setNotice(null);
    if (file.size > MAX_RAW_PHOTO_PICK_BYTES) {
      setError("Fotografija je prevelika (maksimalno 20MB).");
      return;
    }

    setUploadingPhoto(true);
    const supabase = createClient();
    let path = "";
    let thumbPath = "";
    try {
      const [{ blob: mainBlob, width, height }, thumbBlob] = await Promise.all([
        compressImage(file, { maxDimension: PHOTO_MAIN_MAX_DIMENSION, quality: PHOTO_MAIN_QUALITY }),
        makeSquareThumbnail(file, { size: PHOTO_THUMB_SIZE, quality: PHOTO_THUMB_QUALITY }),
      ]);

      const id = crypto.randomUUID();
      path = `${userId}/${id}.webp`;
      thumbPath = `${userId}/${id}-thumb.webp`;

      const { error: err1 } = await supabase.storage
        .from("photos")
        .upload(path, mainBlob, { contentType: "image/webp" });
      if (err1) throw new Error("Upload nije uspeo. Proveri internet konekciju i probaj ponovo.");

      const { error: err2 } = await supabase.storage
        .from("photos")
        .upload(thumbPath, thumbBlob, { contentType: "image/webp" });
      if (err2) {
        await supabase.storage.from("photos").remove([path]);
        throw new Error("Upload nije uspeo. Proveri internet konekciju i probaj ponovo.");
      }

      const result = await addPhoto({ path, thumbPath, width, height });
      if (result.error || !result.photoId) {
        await supabase.storage.from("photos").remove([path, thumbPath]);
        throw new Error(result.error ?? "Ne mogu da sačuvam fotografiju.");
      }

      const photoId = result.photoId;
      const mainUrl = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
      const thumbUrl = supabase.storage.from("photos").getPublicUrl(thumbPath).data.publicUrl;
      setPhotos((prev) => [
        ...prev,
        {
          id: photoId,
          url: mainUrl,
          thumbnail_url: thumbUrl,
          position: prev.length,
          is_primary: prev.length === 0,
          moderation_status: result.moderationStatus ?? "pending",
        },
      ]);
      if (result.moderationStatus === "rejected") {
        setError("Fotografija je odbijena — sadrži neprikladan sadržaj po pravilima zajednice. Možeš je obrisati i probati sa drugom.");
      } else if (result.moderationStatus === "pending") {
        setNotice("Fotografija čeka ručnu proveru pre nego što postane vidljiva drugima — obično brzo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nešto nije u redu, probaj ponovo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(id: string) {
    setError(null);
    setBusyId(id);
    const prev = photos;
    setPhotos((p) => p.filter((ph) => ph.id !== id).map((ph, i) => ({ ...ph, position: i, is_primary: i === 0 })));
    const result = await deletePhoto(id);
    if (result.error) {
      setPhotos(prev);
      setError(result.error);
    }
    setBusyId(null);
  }

  function handleMovePhoto(id: string, direction: "left" | "right") {
    const idx = photos.findIndex((p) => p.id === id);
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= photos.length) return;

    const next = [...photos];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const withPositions = next.map((p, i) => ({ ...p, position: i, is_primary: i === 0 }));
    setPhotos(withPositions);
    reorderPhotos(withPositions.map((p) => p.id)).then((res) => {
      if (res.error) setError(res.error);
    });
  }

  async function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setNotice(null);
    if (file.size > MAX_RAW_VIDEO_PICK_BYTES) {
      setError("Video je prevelik (maksimalno 25MB) — snimi kraći ili u nižoj rezoluciji.");
      return;
    }

    setUploadingVideo(true);
    const supabase = createClient();
    let path = "";
    let thumbPath = "";
    try {
      const meta = await readVideoMeta(file);
      if (meta.duration > MAX_VIDEO_DURATION_SECONDS) {
        throw new Error(`Video mora biti kraći od ${MAX_VIDEO_DURATION_SECONDS} sekundi (tvoj traje ${Math.round(meta.duration)}s).`);
      }

      const thumbBlob = await captureVideoThumbnail(file);
      const id = crypto.randomUUID();
      const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
      path = `${userId}/${id}.${ext}`;
      thumbPath = `${userId}/${id}-thumb.webp`;

      const { error: err1 } = await supabase.storage.from("videos").upload(path, file, { contentType: file.type });
      if (err1) throw new Error("Upload nije uspeo. Proveri internet konekciju i probaj ponovo.");

      const { error: err2 } = await supabase.storage
        .from("videos")
        .upload(thumbPath, thumbBlob, { contentType: "image/webp" });
      if (err2) {
        await supabase.storage.from("videos").remove([path]);
        throw new Error("Upload nije uspeo. Proveri internet konekciju i probaj ponovo.");
      }

      const result = await addVideo({ path, thumbPath, durationSeconds: meta.duration });
      if (result.error || !result.videoId) {
        await supabase.storage.from("videos").remove([path, thumbPath]);
        throw new Error(result.error ?? "Ne mogu da sačuvam video.");
      }

      const videoId = result.videoId;
      const mainUrl = supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;
      const thumbUrl = supabase.storage.from("videos").getPublicUrl(thumbPath).data.publicUrl;
      setVideos((prev) => [
        ...prev,
        {
          id: videoId,
          url: mainUrl,
          thumbnail_url: thumbUrl,
          duration_seconds: Math.round(meta.duration),
          moderation_status: result.moderationStatus ?? "pending",
        },
      ]);
      if (result.moderationStatus === "rejected") {
        setError("Video je odbijen — sadrži neprikladan sadržaj po pravilima zajednice. Možeš ga obrisati i probati sa drugim.");
      } else if (result.moderationStatus === "pending") {
        setNotice("Video čeka ručnu proveru pre nego što postane vidljiv drugima — obično brzo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nešto nije u redu, probaj ponovo.");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleDeleteVideo(id: string) {
    setError(null);
    setBusyId(id);
    const prev = videos;
    setVideos((v) => v.filter((vid) => vid.id !== id));
    const result = await deleteVideo(id);
    if (result.error) {
      setVideos(prev);
      setError(result.error);
    }
    setBusyId(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">
          Fotografije ({photos.length}/{MAX_PHOTOS})
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, i) => (
            <div key={photo.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[var(--color-bg-elevated)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbnail_url ?? photo.url}
                alt=""
                className="h-full w-full object-cover"
              />
              <ModerationBadge status={photo.moderation_status} />
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-gradient-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                  GLAVNA
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDeletePhoto(photo.id)}
                disabled={busyId === photo.id}
                className="tap-scale absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
                aria-label="Obriši fotografiju"
              >
                {busyId === photo.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              </button>
              <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMovePhoto(photo.id, "left")}
                  disabled={i === 0}
                  className="tap-scale flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  aria-label="Pomeri levo"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMovePhoto(photo.id, "right")}
                  disabled={i === photos.length - 1}
                  className="tap-scale flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  aria-label="Pomeri desno"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="tap-scale flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] disabled:opacity-50"
            >
              {uploadingPhoto ? <Loader2 size={22} className="animate-spin" /> : <Plus size={22} />}
              <span className="text-xs">{uploadingPhoto ? "Šaljem..." : "Dodaj"}</span>
            </button>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoPick}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">
          Video ({videos.length}/{MAX_VIDEOS}) — do {MAX_VIDEO_DURATION_SECONDS}s
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {videos.map((video) => (
            <div key={video.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[var(--color-bg-elevated)]">
              <video
                src={video.url}
                poster={video.thumbnail_url ?? undefined}
                className="pointer-events-none h-full w-full object-cover"
                muted
                playsInline
                autoPlay
                loop
                // Bez "controls": ovo je mali pregled u mreži, ne player.
                // pointer-events-none sprečava da nativni video sloj "pojede"
                // klik na X dugme za brisanje koje je pozicionirano preko njega.
              />
              <ModerationBadge status={video.moderation_status} />
              <button
                type="button"
                onClick={() => handleDeleteVideo(video.id)}
                disabled={busyId === video.id}
                className="tap-scale absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
                aria-label="Obriši video"
              >
                {busyId === video.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              </button>
            </div>
          ))}

          {videos.length < MAX_VIDEOS && (
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={uploadingVideo}
              className={cn(
                "tap-scale flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)]",
                uploadingVideo && "opacity-50"
              )}
            >
              {uploadingVideo ? <Loader2 size={22} className="animate-spin" /> : <VideoIcon size={22} />}
              <span className="text-xs">{uploadingVideo ? "Šaljem..." : "Dodaj video"}</span>
            </button>
          )}
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          capture="environment"
          className="hidden"
          onChange={handleVideoPick}
        />
      </section>

      {notice && (
        <p className="rounded-xl bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">{notice}</p>
      )}
      {error && (
        <p className="rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
