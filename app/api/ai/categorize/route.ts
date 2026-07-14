import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import { categorizeInbox } from "@/lib/claude"
import type { CategorizeRequest } from "@/lib/types"

export const maxDuration = 120

export async function POST(request: Request) {
  const token = await getServerToken()
  if (!token?.access_token && !token?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const {
      emails, categories, account, customContext, systemContext, aboutYouContext, dreamInboxContext,
      aiPastEventDelete, aiSecurityAlertCleanup, aiSocialNotificationCleanup,
      aiExpiredPromoCleanup, aiOldNewsletterCleanup, aiLargeAttachmentCleanup,
      expandedSummariesForAll,
    }: CategorizeRequest & {
      customContext?: string; systemContext?: string; aboutYouContext?: string; dreamInboxContext?: string
      aiPastEventDelete?: boolean; aiSecurityAlertCleanup?: boolean; aiSocialNotificationCleanup?: boolean
      aiExpiredPromoCleanup?: boolean; aiOldNewsletterCleanup?: boolean; aiLargeAttachmentCleanup?: boolean
    } = await request.json()
    if (Array.isArray(emails) && emails.length > 100) {
      return NextResponse.json({ error: "Too many emails — max 100 per request" }, { status: 400 })
    }
    const result = await categorizeInbox(emails, categories, account, {
      customContext, systemContext, aboutYouContext, dreamInboxContext,
      aiPastEventDelete, aiSecurityAlertCleanup, aiSocialNotificationCleanup,
      aiExpiredPromoCleanup, aiOldNewsletterCleanup, aiLargeAttachmentCleanup,
      expandedSummariesForAll,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[ai/categorize]", err)
    return NextResponse.json({ error: "Categorization failed" }, { status: 500 })
  }
}
