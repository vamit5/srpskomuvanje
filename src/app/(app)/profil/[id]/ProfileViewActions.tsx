"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { reportUser, blockUser, type ReportReason } from "../../_safety/actions";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "neprikladan_sadrzaj", label: "Neprikladan sadržaj" },
  { value: "uznemiravanje", label: "Uznemiravanje" },
  { value: "lazan_profil", label: "Lažan profil" },
  { value: "spam", label: "Spam" },
  { value: "prevara", label: "Prevara" },
  { value: "maloletna_osoba", label: "Maloletna osoba" },
  { value: "nasilje_pretnje", label: "Nasilje / pretnje" },
  { value: "drugo", label: "Drugo" },
];

export function ProfileViewActions({ profileId, name }: { profileId: string; name: string }) {
  const router = useRouter();
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("neprikladan_sadrzaj");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBlock() {
    const result = await blockUser(profileId);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/poruke");
  }

  async function handleReport() {
    setReportSending(true);
    const result = await reportUser(profileId, reportReason, reportDetails);
    setReportSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReportSent(true);
  }

  return (
    <div className="mb-6 flex gap-2">
      <Button variant="ghost" className="flex-1" onClick={() => setReportOpen(true)}>
        🚩 Prijavi
      </Button>
      <Button variant="danger" className="flex-1" onClick={() => setConfirmingBlock(true)}>
        🚫 Blokiraj
      </Button>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {confirmingBlock && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-[var(--color-bg-card)] p-5 sm:rounded-3xl">
            <p className="mb-3 text-sm">Blokirati {name}? Neće više moći da te vidi ni kontaktira.</p>
            <div className="flex flex-col gap-2">
              <Button variant="danger" onClick={handleBlock}>
                Da, blokiraj
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingBlock(false)}>
                Otkaži
              </Button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-[var(--color-bg-card)] p-5 sm:rounded-3xl">
            {reportSent ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-3xl">✅</p>
                <p className="font-semibold">Prijava poslata</p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    setReportOpen(false);
                    setReportSent(false);
                    setReportDetails("");
                  }}
                >
                  Zatvori
                </Button>
              </div>
            ) : (
              <>
                <h2 className="mb-3 font-semibold">Prijavi {name}</h2>
                <div className="mb-3 flex flex-col gap-2">
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="reason"
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="accent-[var(--color-accent)]"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Dodatni detalji (opciono)"
                  maxLength={500}
                  className="h-20 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="danger" onClick={handleReport} disabled={reportSending}>
                    {reportSending ? "Šaljem..." : "Pošalji prijavu"}
                  </Button>
                  <Button variant="ghost" onClick={() => setReportOpen(false)}>
                    Otkaži
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
