import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getManifestationContent, saveManifestationContent } from "@/lib/dashboard-data"
import type { ManifestationContent } from "@/lib/types"

export async function GET() {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const content = await getManifestationContent()
  return NextResponse.json(content)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json() as ManifestationContent
  await saveManifestationContent(body)
  return NextResponse.json({ ok: true })
}
