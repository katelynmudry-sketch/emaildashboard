import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchExistingLabels } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export async function GET(request: Request) {
  const session = await auth()
  const accountId = parseAccountId(new URL(request.url).searchParams.get("account"))
  const authz = requireGmailAccess(session, accountId)
  if (!authz.success) return authz.response

  try {
    const labels = await fetchExistingLabels(authz.accessToken)
    return NextResponse.json(labels)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch labels" }, { status: 500 })
  }
}
