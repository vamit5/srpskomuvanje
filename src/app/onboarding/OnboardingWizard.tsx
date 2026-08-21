"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { completeOnboarding, type OnboardingInput } from "./actions";

const GENDERS: { value: OnboardingInput["gender"]; label: string }[] = [
  { value: "musko", label: "Muško" },
  { value: "zensko", label: "Žensko" },
  { value: "drugo", label: "Drugo" },
];

const CITIES = [
  "Beograd", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Zrenjanin", "Pančevo",
  "Čačak", "Kraljevo", "Novi Pazar", "Leskovac", "Smederevo", "Valjevo", "Vranje",
  "Šabac", "Sombor", "Požarevac", "Užice", "Kikinda", "Sremska Mitrovica",
];

const INTERESTS = [
  "Muzika", "Putovanja", "Fitnes", "Film", "Gejming", "Kuvanje", "Priroda",
  "Umetnost", "Moda", "Sport", "Knjige", "Fotografija", "Ples", "Kafa",
  "Noćni život", "Kućni ljubimci", "Joga", "Tehnologija",
];

const STEPS = ["osnovno", "trazim", "grad", "opis", "interesi"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<OnboardingInput["gender"] | "">("");
  const [interestedIn, setInterestedIn] = useState<OnboardingInput["gender"][]>([]);
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  function toggle<T>(list: T[], value: T, setter: (v: T[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function canContinue() {
    switch (STEPS[step]) {
      case "osnovno":
        return name.trim().length >= 2 && !!birthDate && !!gender;
      case "trazim":
        return interestedIn.length > 0;
      case "grad":
        return city.trim().length > 1;
      case "opis":
        return true;
      case "interesi":
        return true;
    }
  }

  async function handleNext() {
    setError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    setLoading(true);
    const result = await completeOnboarding({
      name,
      birthDate,
      gender: gender as OnboardingInput["gender"],
      interestedIn,
      city,
      bio,
      interests,
    });
    // completeOnboarding radi redirect() na uspehu (baca NEXT_REDIRECT),
    // pa se do ovde stiže samo ako postoji greška.
    if (result?.error) {
      setLoading(false);
      setError(result.error);
    } else {
      router.push("/sada");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-8">
      <div className="mb-8 flex gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-gradient-accent" : "bg-[var(--color-bg-elevated)]"
            )}
          />
        ))}
      </div>

      <div className="flex-1">
        {STEPS[step] === "osnovno" && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold">Kako se zoveš?</h1>
            <Input placeholder="Ime" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="text-sm text-[var(--color-text-muted)]">Datum rođenja</label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
            <label className="text-sm text-[var(--color-text-muted)]">Pol</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(g.value)}
                  className={cn(
                    "tap-scale flex-1 rounded-xl border px-3 py-3 text-sm font-medium",
                    gender === g.value
                      ? "border-transparent bg-gradient-accent text-white"
                      : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {STEPS[step] === "trazim" && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold">Koga želiš da upoznaš?</h1>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => toggle(interestedIn, g.value, setInterestedIn)}
                  className={cn(
                    "tap-scale flex-1 rounded-xl border px-3 py-3 text-sm font-medium",
                    interestedIn.includes(g.value)
                      ? "border-transparent bg-gradient-accent text-white"
                      : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {STEPS[step] === "grad" && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold">U kom si gradu?</h1>
            <Input
              list="cities"
              placeholder="Npr. Beograd"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <datalist id="cities">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="text-xs text-[var(--color-text-muted)]">
              Tačnu lokaciju uključujemo kasnije, uz tvoju dozvolu — drugima se nikad ne prikazuje
              adresa, samo približna udaljenost.
            </p>
          </div>
        )}

        {STEPS[step] === "opis" && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold">Napiši kratak opis</h1>
            <textarea
              className="h-32 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-4 text-[15px] outline-none focus:border-[var(--color-accent)]"
              placeholder="Par rečenica o tebi..."
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="text-right text-xs text-[var(--color-text-faint)]">{bio.length}/280</p>
          </div>
        )}

        {STEPS[step] === "interesi" && (
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold">Šta te zanima?</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Izaberi bar 3 — pomaže algoritmu da nađe tvoj tip.</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggle(interests, interest, setInterests)}
                  className={cn(
                    "tap-scale rounded-full border px-3.5 py-2 text-sm",
                    interests.includes(interest)
                      ? "border-transparent bg-gradient-accent text-white"
                      : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
                  )}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={loading}>
            Nazad
          </Button>
        )}
        <Button className="flex-1" onClick={handleNext} disabled={!canContinue() || loading}>
          {loading ? "Sačuvavam..." : step === STEPS.length - 1 ? "Uđi" : "Dalje"}
        </Button>
      </div>
    </div>
  );
}
