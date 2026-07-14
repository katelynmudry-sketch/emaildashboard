import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const SUPABASE_URL = process.env.EMAILPARTY_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EMAILPARTY_SUPABASE_ANON_KEY

export async function POST() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Signup storage not configured" }, { status: 500 })
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/emailparty_email_signups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({
      email: email.toLowerCase(),
      name: session?.user?.name ?? null,
    }),
  })

  if (!res.ok && res.status !== 409) {
    return NextResponse.json({ error: "Signup failed" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
