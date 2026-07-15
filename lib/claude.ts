import Anthropic from "@anthropic-ai/sdk"
import type { RawEmail, Email, Category, ProposeResponse } from "./types"
import { loadRules, formatRulesForPrompt } from "./rules"
import { DEFAULT_SYSTEM_CONTEXT, extractJson } from "./claude-utils"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Settings passed in from client (localStorage → request body) ──────────────

export interface ClaudeSettings {
  customContext?: string  // per-account rules text
  systemContext?: string  // full CLINIC_CONTEXT override (user-edited via settings panel)
  aiPastEventDelete?: boolean
  aiSecurityAlertCleanup?: boolean
  aiSocialNotificationCleanup?: boolean
  aiExpiredPromoCleanup?: boolean
  aiOldNewsletterCleanup?: boolean
  aiLargeAttachmentCleanup?: boolean
  aboutYouContext?: string  // free-text "about the user" reference doc
  dreamInboxContext?: string  // "Describe your Dream Inbox" — what the user wants surfaced/prioritized
  draftTone?: string  // per-account draft voice/tone, used for reply drafting
  expandedSummariesForAll?: boolean  // give every email a detailed summary, not just urgent/today-priority ones
}

// ── Build the "About the user" prompt section, if present ─────────────────────

function buildAboutYouSection(settings?: ClaudeSettings): string {
  let section = settings?.aboutYouContext?.trim()
    ? `\n\n## About the user\n${settings.aboutYouContext.trim()}`
    : ""
  if (settings?.draftTone?.trim()) {
    section += `\n\n## Tone for replies from this account\n${settings.draftTone.trim()}`
  }
  return section
}

// ── Build the "Dream Inbox" prompt section, if present ─────────────────────────

function buildDreamInboxSection(settings?: ClaudeSettings): string {
  const text = settings?.dreamInboxContext?.trim() || settings?.customContext?.trim()
  return text ? `\n\n## What this user needs from their inbox\n${text}` : ""
}

// ── Build the "summary" field instruction, based on summary settings ──────────

function buildSummaryInstruction(settings?: ClaudeSettings): string {
  const detailedStyle = `Write 2-4 sentences covering the key context, any action needed, dates/deadlines, and amounts. Stay plain-English and skimmable — no filler.`
  const conciseStyle = `Write 1-2 short sentences. Use one mention of the sender/brand/person at most. If the sender or subject already names the sender, omit that name and summarize the key action, date, deadline, or amount instead. Prefer short phrases like "Day 3 expires Fri 5pm" or "course 33% off until Jun 8".`

  if (settings?.expandedSummariesForAll) {
    return `- summary: plain-English summary for every email. ${detailedStyle}`
  }

  return `- summary:
  - If priority is "urgent" or "today": plain-English summary. ${detailedStyle}
  - Otherwise: plain-English summary IF the body is longer than ~150 words OR contains a special offer/promotion. Otherwise null. ${conciseStyle}`
}

// ── Sanitize strings (passthrough — kept for call-site compatibility) ─────────
// Note: this round-trip does not change well-formed strings; kept to avoid
// touching all 20+ call sites in this file. Real encoding issues should be
// handled at the Gmail API decode boundary in lib/gmail.ts.

function sanitizeUtf8(str: string): string {
  // Replace lone surrogates with replacement char — unpaired surrogates break JSON.stringify
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�")
}

function timeAgo(internalDate: number): string {
  const now = Date.now()
  const diff = now - internalDate
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(internalDate).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

// ── Propose categories for a new account ─────────────────────────────────────

export async function proposeCategories(
  emails: RawEmail[],
  existingLabelNames: string[],
  account: string,
  isWork: boolean,
  settings?: ClaudeSettings
): Promise<ProposeResponse> {
  const existingSection = existingLabelNames.length > 0
    ? `The user already has these Gmail labels — USE THEM AS-IS wherever they make sense. List each matching label first, before any new suggestions. Only invent a new category name if none of the existing labels fit a clear pattern in the emails.

Existing Gmail labels (reuse these):
${existingLabelNames.map(n => `  - ${n}`).join("\n")}`
    : "No existing labels — propose fresh categories based on the email patterns below."

  const aboutYouSection = buildAboutYouSection(settings)
  const dreamInboxSection = buildDreamInboxSection(settings)

  const prompt = `
Analyze these ${emails.length} emails from ${account} and propose inbox categories to organize this inbox.

${existingSection}

${isWork ? "This is a clinic/work inbox. Categories should reflect clinical practice email types." : "This is a personal inbox. Categories should reflect personal life email types."}
${aboutYouSection}${dreamInboxSection}

Rules:
- Prefer reusing existing label names over inventing new ones.
- Propose as many or as few categories as actually make sense for the emails — no fixed minimum or maximum.
- Each category should cover a meaningfully distinct slice of the inbox.
- If the "About the user" or "What this user needs from their inbox" sections above name specific people, companies, or topics, propose a category for them even if their emails are low-volume — these are flagged as important to the user.

Return a JSON array of objects:
[
  { "name": "CategoryName", "color": "bg-violet-500" },
  ...
]

Color options (pick varied, visually distinct ones):
bg-violet-500, bg-blue-500, bg-emerald-500, bg-amber-500, bg-rose-500, bg-cyan-500, bg-orange-500, bg-pink-500, bg-teal-500, bg-indigo-500

Email subjects/senders for analysis:
${emails.slice(0, Math.min(100, emails.length)).map(e => `- From: ${sanitizeUtf8(e.from)} | Subject: ${sanitizeUtf8(e.subject)}`).join("\n")}

Return ONLY valid JSON array. No markdown, no explanation.
`.trim()

  const effectiveSystemContext = settings?.systemContext?.trim() || DEFAULT_SYSTEM_CONTEXT

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: [{ type: "text", text: effectiveSystemContext, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]"
  try {
    const categories = JSON.parse(extractJson(raw)) as { name: string; color: string }[]
    return { categories }
  } catch {
    throw new Error(`Claude returned invalid JSON for category proposal: ${raw.slice(0, 200)}`)
  }
}

// ── Categorize inbox emails ───────────────────────────────────────────────────

export async function categorizeInbox(
  emails: RawEmail[],
  categories: Category[],
  account: string,
  settings?: ClaudeSettings
): Promise<Email[]> {
  if (emails.length === 0) return []

  const categoryList = categories.map(c => c.name).join(", ")
  const rulesSection = formatRulesForPrompt(loadRules())
  const customContextSection = settings?.customContext?.trim()
    ? `\n## Custom instructions for this account\n${settings.customContext.trim()}`
    : ""
  const effectiveSystemContext = settings?.systemContext?.trim() || DEFAULT_SYSTEM_CONTEXT
  const aboutYouSection = buildAboutYouSection(settings) + buildDreamInboxSection(settings)
  const today = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD

  const pastEventCriterion = settings?.aiPastEventDelete !== false
    ? `, calendar event invitations or meeting RSVP emails where the event date has already passed (today is ${today} — check the event date in the email body or subject)`
    : ""

  const deletableCriteria = [
    `shipping notifications where the package has already been delivered (status says "delivered")`,
  ]
  if (settings?.aiSecurityAlertCleanup !== false) {
    deletableCriteria.push("security login alerts and OTP/2FA codes")
  }
  if (settings?.aiSocialNotificationCleanup !== false) {
    deletableCriteria.push("social media notifications (likes, follows, friend requests)")
  }
  if (settings?.aiExpiredPromoCleanup !== false) {
    deletableCriteria.push("single-use promotional codes or coupons that have already expired")
  }
  if (settings?.aiOldNewsletterCleanup) {
    deletableCriteria.push(`newsletters or digests sent more than 14 days ago (today is ${today}) that have already been read (Read: true)`)
  }
  if (settings?.aiLargeAttachmentCleanup) {
    deletableCriteria.push(`emails sent more than 30 days ago (today is ${today}) with large attachments (over 2MB) that are unlikely to be needed for future reference`)
  }
  const includeEmailMeta = !!(settings?.aiOldNewsletterCleanup || settings?.aiLargeAttachmentCleanup)

  const prompt = `
Categorize each of these ${emails.length} emails into one of these categories: ${categoryList}
${rulesSection}${customContextSection}

Today's date: ${today}

Also assign:
- priority: "urgent" (needs reply today/time-sensitive), "today" (action needed soon), or "fyi" (informational, no action needed)
- microSummary: 2-3 word phrase describing the email's topic or action. Verb-noun style preferred. Do not repeat the sender name or brand if it already appears in the subject or sender. Focus on the action, event, price, or deadline. Examples: "order shipped", "confirm appointment", "payment due", "ADHD Day 3", "VIP pass", "course discount". No punctuation.
- actionFlag: one of:
  - "reply" — personal or patient email asking a question that needs a reply
  - "confirm" — needs a specific action, confirmation, scheduling, or response
  - "receipt" — order confirmation, invoice, receipt, or record to keep
  - "read" — newsletter, FYI, promotional, no action needed
${buildSummaryInstruction(settings)}
- draftReply: For emails needing a reply, write a friendly, concise reply (2-4 sentences). For emails that don't need a reply: null.
- deletable: true if the email is clearly no longer actionable and safe to delete. Flag: ${deletableCriteria.join(", ")}${pastEventCriterion}.
- deletableReason: one short phrase explaining why (e.g. "Security login alert, no longer actionable"), or null if not deletable.
- packageDelivered: true if this email confirms a package/parcel was successfully delivered. Look at subject AND body. Signs: "delivered", "arrived", "left at door", "delivery complete", "your parcel is here", "successfully delivered", "package received", "order delivered", "shipment delivered", "item delivered", "has been delivered", "delivery confirmation", "delivered to". "Out for delivery" or "on its way" are NOT enough — must confirm actual delivery happened.
- orderSender: if packageDelivered is true, extract a short identifier for the sender (e.g. "amazon.ca", "Postmedia Parcel Services", "Canada Post" — use the display name if the domain isn't recognizable). Otherwise null.
- otp: true if this is a one-time verification code, 2FA/MFA code, or a passwordless magic sign-in link. These expire within minutes and are always safe to delete regardless of the deletable settings above — flag them independently of "deletable".

Return a JSON array with one object per email, in the same order:
[
  {
    "id": "<email id>",
    "category": "<category name>",
    "priority": "urgent|today|fyi",
    "microSummary": "<2-3 words>",
    "actionFlag": "reply|confirm|receipt|read",
    "summary": "<summary text or null — see instructions above>",
    "draftReply": "<reply text or null>",
    "deletable": true|false,
    "deletableReason": "<short phrase or null>",
    "packageDelivered": true|false,
    "orderSender": "<sender domain or null>",
    "otp": true|false
  }
]

Emails to process:
${emails.map(e => `ID: ${e.id}
From: ${sanitizeUtf8(e.from)} <${sanitizeUtf8(e.fromEmail)}>
Subject: ${sanitizeUtf8(e.subject)}${includeEmailMeta ? `
Sent: ${new Date(e.internalDate).toLocaleDateString("en-CA")} | Read: ${e.read}${e.attachments?.length ? ` | Attachments: ${e.attachments.map(a => `${a.filename} (${Math.round(a.size / 1024)}KB)`).join(", ")}` : ""}` : ""}
Body (truncated): ${sanitizeUtf8(e.body.slice(0, 500))}`).join("\n---\n")}

Return ONLY valid JSON array. No markdown, no explanation.
`.trim()

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    system: [{ type: "text", text: effectiveSystemContext + aboutYouSection, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]"
  let results: { id: string; category: string; priority: "urgent" | "today" | "fyi"; microSummary: string; actionFlag: "reply" | "confirm" | "receipt" | "read"; summary: string | null; draftReply: string | null; deletable: boolean; deletableReason: string | null; packageDelivered: boolean; orderSender: string | null; otp?: boolean }[]
  try {
    results = JSON.parse(extractJson(raw))
  } catch {
    throw new Error(`Claude returned invalid JSON for categorization: ${raw.slice(0, 200)}`)
  }

  // Merge AI results back into full email objects
  return emails.map(raw => {
    const ai = results.find(r => r.id === raw.id) ?? {
      category: categories[0]?.name ?? "Other",
      priority: "fyi" as const,
      microSummary: "no summary",
      actionFlag: "read" as const,
      summary: null,
      draftReply: null,
      deletable: false,
      deletableReason: null,
      packageDelivered: false,
      orderSender: null,
      otp: false,
    }
    return {
      ...raw,
      category: ai.category,
      priority: ai.priority,
      microSummary: ai.microSummary ?? "no summary",
      actionFlag: ai.actionFlag ?? "read",
      summary: ai.summary,
      draftReply: ai.draftReply,
      timeAgo: timeAgo(raw.internalDate),
      deletable: ai.deletable ?? false,
      deletableReason: ai.deletableReason ?? null,
      packageDelivered: ai.packageDelivered ?? false,
      orderSender: ai.orderSender ?? null,
      otp: ai.otp ?? false,
    }
  })
}

// ── Deep Clean: cheap subjects+senders-only delete suggestions ───────────────
// Metadata-only classification for the read/archived sweep — much cheaper
// than full categorizeInbox (no body, no draft reply, no category).

export interface SweepClassifyInput {
  id: string
  subject: string
  from: string
}

export interface SweepSuggestion {
  id: string
  reason: string
}

export async function proposeSweepDeletions(emails: SweepClassifyInput[]): Promise<SweepSuggestion[]> {
  if (emails.length === 0) return []

  const prompt = `
These are subject lines and senders from a person's archived/read email, all older than 30 days. Identify which are safe to delete permanently — the same categories used elsewhere in this app: expired promos/deals, old newsletters/digests, past-event invitations, security/login alerts, social media notifications, delivered-package shipping notifications, one-time verification codes.

Do NOT suggest deleting anything that looks like a receipt, invoice, contract, personal correspondence, or anything that could matter for records/taxes/warranty.

Emails:
${emails.map(e => `ID: ${e.id}\nFrom: ${sanitizeUtf8(e.from)}\nSubject: ${sanitizeUtf8(e.subject)}`).join("\n---\n")}

Return a JSON array of only the emails safe to delete, with one short reason each:
[{ "id": "<id>", "reason": "<short phrase>" }]

Return ONLY valid JSON. No markdown, no explanation.
`.trim()

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]"
  try {
    const parsed = JSON.parse(extractJson(raw)) as SweepSuggestion[]
    const validIds = new Set(emails.map(e => e.id))
    return parsed.filter(s => validIds.has(s.id))
  } catch {
    return []
  }
}

// ── Generate a draft reply for a single email ─────────────────────────────────

export async function generateDraftReply(
  email: { from: string; fromEmail: string; subject: string; body: string },
  account: string,
  partialDraft: string = "",
  settings?: ClaudeSettings
): Promise<string> {
  const hasPartial = partialDraft.trim().length > 0

  const partialSection = hasPartial
    ? `\n\nThe user has already started writing this reply — continue it naturally, keeping their tone and completing their thought. Do not restart or rewrite what they wrote; seamlessly extend it:\n<partial_draft>\n${partialDraft.trim()}\n</partial_draft>`
    : ""

  const prompt = `${hasPartial ? "Complete this in-progress reply" : "Write a friendly, concise reply to this email"}. ${hasPartial ? "Keep the user's tone and seamlessly extend what they've written." : "2-4 sentences."} Return only the ${hasPartial ? "full completed reply text (including what was already written)" : "reply text"}.

From: ${sanitizeUtf8(email.from)} <${sanitizeUtf8(email.fromEmail)}>
Subject: ${sanitizeUtf8(email.subject)}
Message: ${sanitizeUtf8(email.body.slice(0, 1000))}${partialSection}`

  const effectiveSystemContext = settings?.systemContext?.trim() || DEFAULT_SYSTEM_CONTEXT
  const customContextSection = settings?.customContext?.trim()
    ? `\n\n## Custom instructions for this account\n${settings.customContext.trim()}`
    : ""
  const aboutYouSection = buildAboutYouSection(settings) + buildDreamInboxSection(settings)

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: [{ type: "text", text: effectiveSystemContext + customContextSection + aboutYouSection, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  })

  return response.content[0].type === "text" ? response.content[0].text.trim() : ""
}
