"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Star, Loader2 } from "lucide-react";
import { MAX_PHOTOS } from "@/lib/media/constants";
import { addManualUserPhoto, deleteManualUserPhoto, setManualUserPrimaryPhoto } from "./actions";

type ModerationStatus = "approved" | "pending" | "rejected";

interface PhotoRow {
  id: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  moderation_status: ModerationStatus;
}

function ModerationBadge({ status }: { status: ModerationStatus }) {
  if (status === "approved") return null;
  const isPending = status === "pending";
  return (
    <span
      className={`pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-center text-[9px] font-semibold leading-tight ${
        isPending ? "bg-[var(--color-warning)] text-black" : "bg-[var(--color-danger)] text-white"
      }`}
    >
      {isPending ? "⏳ Na proveri" : "🚫 Odbijeno"}
    </span>
  );
}

export function EditUserPhotos({ userId, initialPhotos }: { userId: string; initialPhotos: PhotoRow[] }) {
  const router = useRouter();
  // Namerno BEZ lokalne kopije initialPhotos sinhronizovane preko efekta
  // (react-hooks/set-state-in-effect) -- umesto toga, samo pratimo optimisticno
  // obrisane ID-jeve, i render direktno filtrira initialPhotos. router.refresh()
  // posle svake izmene dovlaci svez initialPhotos sa servera (nov render
  // Server Componente), sto automatski istisne stare "obrisane" ID-jeve.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const photos = initialPhotos.filter((p) => !hiddenIds.has(p.id));
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setNotice(null);
    const fd = new FormData();
    fd.set("photo", file);
    const result = await addManualUserPhoto(userId, fd);
    setUploading(false);

    if (result.error && !result.error.startsWith("Fotografija čeka") && !result.error.startsWith("Fotografija je odbijena")) {
      setError(result.error);
      return;
    }
    if (result.error) setNotice(result.error);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    const result = await deleteManualUserPhoto(userId, id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setHiddenIds((prev) => new Set(prev).add(id));
    router.refresh();
  }

  async function handleSetPrimary(id: string) {
    setBusyId(id);
    setError(null);
    const result = await setManualUserPrimaryPhoto(userId, id);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">
        Fotografije ({photos.length}/{MAX_PHOTOS})
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[var(--color-bg-elevated)]">
            {photo.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.thumbnail_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
            )}
            <ModerationBadge status={photo.moderation_status} />
            {photo.is_primary && (
              <span className="absolute left-1 top-1 rounded-full bg-gradient-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                GLAVNA
              </span>
            )}
            <button
              type="button"
              onClick={() => handleDelete(photo.id)}
              disabled={busyId === photo.id}
              className="tap-scale absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-50"
              aria-label="Obriši fotografiju"
            >
              {busyId === photo.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            </button>
            {!photo.is_primary && (
              <button
                type="button"
                onClick={() => handleSetPrimary(photo.id)}
                disabled={busyId === photo.id}
                className="tap-scale absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-black/60 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                <Star size={10} /> Postavi kao glavnu
              </button>
            )}
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="tap-scale flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] disabled:opacity-50"
          >
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            <span className="text-xs">{uploading ? "Šaljem..." : "Dodaj"}</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
      {notice && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{notice}</p>}
    </section>
  );
}
