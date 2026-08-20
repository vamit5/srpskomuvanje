import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Poruke" };

export default function PorukePage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          💬 <span className="text-gradient">Poruke</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Razgovori sa tvojim matchevima</p>
      </header>

      <EmptyState
        emoji="💬"
        title="Nema razgovora još"
        description="Kad dobiješ prvi match, ovde se otvara real-time chat. Gradimo ovo u FAZI 4."
      />
    </div>
  );
}
