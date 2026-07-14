import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { fetchExistingLabels } from "@/lib/gmail"
import { parseAccountId, requireGmailAccess } from "@/lib/gmail-auth"

export async function GET(request: Request) {
  const token = await getServerToken()
  const accountId = parseAccountId(new URL(request.url).searchParams.get("account"))
  const authz = requireGmailAccess(token, accountId)
  if (!authz.success) return authz.response

  try {
    const labels = await fetchExistingLabels(authz.accessToken)
    return NextResponse.json(labels)
  } catch (err) {
    console.error("[gmail/labels]", err)
    return NextResponse.json({ error: "Failed to fetch labels" }, { status: 500 })
  }
}
