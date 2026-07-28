import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/messages  — returns the signed-in user's full chat history from Supabase
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, image_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}
