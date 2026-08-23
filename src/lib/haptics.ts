// Haptic vibracija (Vibration API) -- radi samo na Android Chrome (iOS
// Safari je namerno ne podrzava), zato je uvek zamotano u probaj/uhvati i
// proveru postojanja -- nikad ne sme da obori glavnu akciju.
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // tiho ignorisi -- haptika nikad ne sme da prekine tok korisnika
  }
}
