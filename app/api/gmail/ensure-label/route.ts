import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { ensureLabel } from "@/lib/gmail"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name }: { name: string } = await request.json()
    const id = await ensureLabel(session.access_token, name)
    return NextResponse.json({ id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Label creation failed" }, { status: 500 })
  }
}
