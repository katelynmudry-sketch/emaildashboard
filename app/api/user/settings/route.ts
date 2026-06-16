import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createSupabaseServerClient } from "@/lib/supabase"
import type { InboxSettings } from "@/lib/settings-storage"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("userId", session.user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ settings: null }, { status: 200 })
  }

  return NextResponse.json({ settings: data.settings as Partial<InboxSettings> })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json() as { settings: Partial<InboxSettings> }
  if (!body.settings) {
    return NextResponse.json({ error: "Missing settings" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { userId: session.user.id, settings: body.settings, updated_at: new Date().toISOString() },
      { onConflict: "userId" }
    )

  if (error) {
    console.error("[user/settings POST]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
