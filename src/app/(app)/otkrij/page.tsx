import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Otkrij" };

export default function OtkrijPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          💘 <span className="text-gradient">Otkrij</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Ljudi iz tvog grada</p>
      </header>

      <EmptyState
        emoji="🚧"
        title="Otkrij dolazi uskoro"
        description="Ovde će biti glavni feed sa profilima za lajkovanje — swipe kartice, Personal Match Score i Hot Mode filteri. Gradimo ovo u sledećoj fazi (FAZA 3)."
      />
    </div>
  );
}
