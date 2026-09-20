import { redirect } from "next/navigation";

// 18+ Muvanje je privremeno sakriveno (poslovna odluka, ne tehnicki kvar) --
// vidi PremiumCard/MuvajDeck/BottomNav za ostale uklonjene ulazne tacke.
export default function EighteenPlusPage() {
  redirect("/sada");
}
