"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { FOOD_FAVORITE_OPTIONS } from "@/lib/foodFavorites";
import { createManualUser } from "./actions";

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

export function NewUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [interestedIn, setInterestedIn] = useState<Gender[]>([]);
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [foodFavorites, setFoodFavorites] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    setError(null);
    setNotice(null);

    if (!consent) return setError("Moraš potvrditi da je osoba stvarna i saglasna.");
    if (!email.includes("@")) return setError("Unesi ispravan email.");
    if (name.trim().length < 2) return setError("Unesi ime.");
    if (!birthDate) return setError("Unesi datum rođenja.");
    if (!gender) return setError("Izaberi pol.");
    if (!interestedIn.length) return setError("Izaberi koga osoba želi da upozna.");
    const photoFile = photoInputRef.current?.files?.[0];
    if (!photoFile) return setError("Dodaj profilnu fotografiju.");

    setSaving(true);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("name", name);
    fd.set("birthDate", birthDate);
    fd.set("gender", gender);
    interestedIn.forEach((g) => fd.append("interestedIn", g));
    fd.set("city", city);
    fd.set("bio", bio);
    interests.forEach((i) => fd.append("interests", i));
    foodFavorites.forEach((f) => fd.append("foodFavorites", f));
    fd.set("consentConfirmed", "on");
    fd.set("photo", photoFile);

    // try/catch je NAMERAN -- bez njega, bilo koji neuhvacen izuzetak
    // (mrezni prekid, prevelik body, isteklo vreme servera) ostavlja "saving"
    // zauvek true i dugme deluje kao da "samo ucitava" bez ikakve poruke.
    let result: { error: string | null };
    try {
      result = await createManualUser(fd);
    } catch {
      setSaving(false);
      setError("Nešto nije u redu na serveru (možda prevelika slika ili prekinuta konekcija). Pokušaj ponovo.");
      return;
    }
    setSaving(false);

    if (result.error && result.error.startsWith("Nalog je napravljen")) {
      // Nije prava greška -- nalog je uspesno napravljen, samo je slika
      // otisla na rucnu proveru/odbijena. Ipak preusmeravamo na listu.
      setNotice(result.error);
      setTimeout(() => router.push("/admin/users"), 2000);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/admin/users");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Nalog</h3>
        <Input type="email" placeholder="Email (pravi, njihov)" value={email} onChange={(e) => setEmail(e.target.value)} />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">Profilna fotografija</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="tap-scale flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-xs text-[var(--color-text-muted)]"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              "Dodaj"
            )}
          </button>
          <p className="text-xs text-[var(--color-text-muted)]">
            Ista provera kao za svakog korisnika (automatski se odbija eksplicitan sadržaj).
          </p>
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
      </section>

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
        <Input list="admin-cities" placeholder="Npr. Beograd" value={city} onChange={(e) => setCity(e.target.value)} />
        <datalist id="admin-cities">
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

      <label className="flex items-start gap-2 rounded-2xl border border-[var(--color-border-strong)] p-4 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>
          Potvrđujem da je ova osoba <strong>stvarna</strong>, da je <strong>saglasna</strong> da bude
          na Srpskomuvanju, i da imam pravo da koristim ovu fotografiju.
        </span>
      </label>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {notice && <p className="text-sm text-[var(--color-success)]">{notice}</p>}

      <Button className="w-full" onClick={handleSubmit} disabled={saving}>
        {saving ? "Pravim nalog..." : "Napravi nalog"}
      </Button>
    </div>
  );
}
