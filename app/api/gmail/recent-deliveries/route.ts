import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchRecentDeliveries } from "@/lib/gmail"

export async function GET() {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const deliveries = await searchRecentDeliveries(session.access_token)
    return NextResponse.json(deliveries)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed" }, { status: 500 })
  }
}
