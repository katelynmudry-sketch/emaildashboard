import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchExistingLabels } from "@/lib/gmail"

export async function GET() {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const labels = await fetchExistingLabels(session.access_token)
    return NextResponse.json(labels)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch labels" }, { status: 500 })
  }
}
