import { redirect } from "next/navigation";

// "Tajna soba" je zamenjena sa "18+ Muvanje" (drugaciji, jednostavniji
// mehanizam -- Krevet signal direktno iz Muvaj, bez timer-runde). Ova
// ruta ostaje samo kao trajan redirect za stare linkove/push notifikacije.
export default function TajnaSobaRedirect() {
  redirect("/18-plus");
}
