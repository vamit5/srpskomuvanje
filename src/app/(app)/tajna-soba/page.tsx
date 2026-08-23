import { createClient } from "@/lib/supabase/server";
import { SecretRoomApp } from "./SecretRoomApp";

export const metadata = { title: "Tajna soba" };

export default async function TajnaSobaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <SecretRoomApp myId={user!.id} />;
}
