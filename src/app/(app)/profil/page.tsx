import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "./actions";

export const metadata = { title: "Profil" };

function calculateAge(birthDate: string) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, birth_date, city, is_verified, profile_completion_score, bio, interests")
    .eq("id", user!.id)
    .single();

  if (!profile) return null;

  const age = calculateAge(profile.birth_date);
  const score = profile.profile_completion_score ?? 0;

  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-accent text-xl font-bold text-white">
          {profile.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="flex items-center gap-1 text-xl font-bold">
            {profile.name}, {age}
            {profile.is_verified && <span title="Verifikovan profil">✓</span>}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">{profile.city || "Grad nije podešen"}</p>
        </div>
      </header>

      <section className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Profil popunjen</span>
          <span className="text-[var(--color-text-muted)]">{score}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
          <div
            className="h-full rounded-full bg-gradient-accent transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
        {score < 100 && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Dodaj još fotografija i video da povećaš vidljivost profila (uskoro — FAZA 2).
          </p>
        )}
      </section>

      {profile.bio && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-[var(--color-text-muted)]">O meni</h2>
          <p className="text-sm">{profile.bio}</p>
        </section>
      )}

      {profile.interests?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Interesovanja</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest: string) => (
              <span
                key={interest}
                className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs"
              >
                {interest}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button variant="secondary" disabled>
          Uredi profil (uskoro)
        </Button>
        <form action={signOutAction}>
          <Button variant="ghost" type="submit" className="w-full">
            Odjavi se
          </Button>
        </form>
      </div>
    </div>
  );
}
