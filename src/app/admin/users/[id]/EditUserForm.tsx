"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { FOOD_FAVORITE_OPTIONS } from "@/lib/foodFavorites";
import { updateManualUser } from "./actions";

type Gender = "musko" | "zensko" | "drugo";

const GENDERS: { value: Gender; label: string }[] = [
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

function toggle<T>(list: T[], value: T, setter: (v: T[]) => void) {
  setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
}

export interface EditUserInitial {
  name: string;
  birthDate: string;
  gender: Gender;
  interestedIn: Gender[];
  city: string;
  bio: string;
  interests: string[];
  foodFavorites: string[];
}

export function EditUserForm({ userId, initial }: { userId: string; initial: EditUserInitial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [gender, setGender] = useState<Gender>(initial.gender);
  const [interestedIn, setInterestedIn] = useState<Gender[]>(initial.interestedIn);
  const [city, setCity] = useState(initial.city);
  const [bio, setBio] = useState(initial.bio);
  const [interests, setInterests] = useState(initial.interests);
  const [foodFavorites, setFoodFavorites] = useState(initial.foodFavorites);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (name.trim().length < 2) return setError("Unesi ime.");
    if (!birthDate) return setError("Unesi datum rođenja.");
    if (!interestedIn.length) return setError("Izaberi koga osoba želi da upozna.");

    setSaving(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("birthDate", birthDate);
    fd.set("gender", gender);
    interestedIn.forEach((g) => fd.append("interestedIn", g));
    fd.set("city", city);
    fd.set("bio", bio);
    interests.forEach((i) => fd.append("interests", i));
    foodFavorites.forEach((f) => fd.append("foodFavorites", f));

    const result = await updateManualUser(userId, fd);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Osnovno</h3>
        <Input placeholder="Ime" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="text-sm text-[var(--color-text-muted)]">Datum rođenja</label>
        <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
        <label className="text-sm text-[var(--color-text-muted)]">Pol</label>
        <div className="flex gap-2">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGender(g.value)}
              className={cn(
                "tap-scale flex-1 rounded-xl border px-3 py-3 text-sm font-medium",
                gender === g.value ? "border-transparent bg-gradient-accent text-white" : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Koga želi da upozna?</h3>
        <div className="flex gap-2">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => toggle(interestedIn, g.value, setInterestedIn)}
              className={cn(
                "tap-scale flex-1 rounded-xl border px-3 py-3 text-sm font-medium",
                interestedIn.includes(g.value) ? "border-transparent bg-gradient-accent text-white" : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Grad</h3>
        <Input list="admin-edit-cities" placeholder="Npr. Beograd" value={city} onChange={(e) => setCity(e.target.value)} />
        <datalist id="admin-edit-cities">
          {CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Opis</h3>
        <textarea
          className="h-24 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-4 text-[15px] outline-none focus:border-[var(--color-accent)]"
          maxLength={280}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Interesovanja</h3>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              type="button"
              onClick={() => toggle(interests, interest, setInterests)}
              className={cn(
                "tap-scale rounded-full border px-3.5 py-2 text-sm",
                interests.includes(interest) ? "border-transparent bg-gradient-accent text-white" : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
              )}
            >
              {interest}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Koliko je Srbin/Srpkinja? 🇷🇸</h3>
        <div className="flex flex-wrap gap-2">
          {FOOD_FAVORITE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(foodFavorites, opt.value, setFoodFavorites)}
              className={cn(
                "tap-scale rounded-full border px-3.5 py-2 text-sm",
                foodFavorites.includes(opt.value) ? "border-transparent bg-gradient-accent text-white" : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
              )}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {saved && !error && <p className="text-sm text-[var(--color-success)]">Sačuvano ✓</p>}

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Čuvam..." : "Sačuvaj izmene"}
      </Button>
    </div>
  );
}
