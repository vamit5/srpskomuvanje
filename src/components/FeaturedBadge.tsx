import { cn } from "@/lib/utils";

/** Transparentan bedz za profile koje admin oznaci kao is_featured -- ne
 * tvrdi nista o sadrzaju slika, samo da je profil istaknut. */
export function FeaturedBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("rounded-full bg-gradient-accent px-2 py-0.5 text-[10px] font-bold text-white shadow-lg", className)}>
      {label}
    </span>
  );
}
