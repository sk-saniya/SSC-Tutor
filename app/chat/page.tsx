import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ChatClient from "./ChatClient";

export default async function ChatPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const displayName =
    (data.user.user_metadata?.full_name as string | undefined) ??
    data.user.email ??
    "Student";

  return <ChatClient displayName={displayName} />;
}
