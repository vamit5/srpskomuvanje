/** Prava srpska trobojka (crvena/plava/bela), ne emoji -- konzistentno na svim uredjajima/OS-ovima. */
export function SerbianFlag({ className = "h-4 w-6 rounded-[2px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden="true">
      <rect width="3" height="2" fill="#C6363C" />
      <rect width="3" height="1.333" fill="#0C4076" />
      <rect width="3" height="0.667" fill="#FFFFFF" />
    </svg>
  );
}
