import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { categorizeInbox } from "@/lib/claude"
import type { CategorizeRequest } from "@/lib/types"

export const maxDuration = 120

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token && !session?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const {
      emails, categories, account, customContext, systemContext, aboutYouContext, dreamInboxContext,
      aiPastEventDelete, aiSecurityAlertCleanup, aiSocialNotificationCleanup,
      aiExpiredPromoCleanup, aiOldNewsletterCleanup, aiLargeAttachmentCleanup,
    }: CategorizeRequest & {
      customContext?: string; systemContext?: string; aboutYouContext?: string; dreamInboxContext?: string
      aiPastEventDelete?: boolean; aiSecurityAlertCleanup?: boolean; aiSocialNotificationCleanup?: boolean
      aiExpiredPromoCleanup?: boolean; aiOldNewsletterCleanup?: boolean; aiLargeAttachmentCleanup?: boolean
    } = await request.json()
    const result = await categorizeInbox(emails, categories, account, {
      customContext, systemContext, aboutYouContext, dreamInboxContext,
      aiPastEventDelete, aiSecurityAlertCleanup, aiSocialNotificationCleanup,
      aiExpiredPromoCleanup, aiOldNewsletterCleanup, aiLargeAttachmentCleanup,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Categorization failed" }, { status: 500 })
  }
}
