import { redirect } from "next/navigation";

// "Otkrij" je preimenovan u "Muvaj" (Tajna soba spec, sekcija 2) -- ova ruta
// ostaje samo kao trajan redirect, da stari linkovi/bookmark-ovi/push
// notifikacije koji još pokazuju na /otkrij ne pucaju.
export default function OtkrijRedirect() {
  redirect("/muvaj");
}
