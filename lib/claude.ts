import Anthropic from "@anthropic-ai/sdk"
import type { RawEmail, Email, Category, ProposeResponse } from "./types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Static context (cached by Claude) ────────────────────────────────────────

const CLINIC_CONTEXT = `
You are an AI assistant helping Dr. Katelyn Mudry (naturopathic doctor, Kimberley BC) triage her email.

## Her accounts
- katelynmudry@gmail.com — personal account
- drkmudry@gmail.com — clinic/work account

## Clinic voice for draft replies
- Warm, casual, concise. 2-4 sentences max.
- Address patient by first name.
- Sign off: "Best, Dr. K"
- Never use "I hope this email finds you well"
- Supplements: most can be taken together. B vitamins with food/morning. Iron 15min from coffee. Magnesium at night.
- Side effects: stop all, wait 2-3 days, restart at half dose, contact Dr. K if returns.
- Labs: encourage GP ordering first (covered). LifeLabs Kimberley for extras. Ask for photo of GP req.
- Never comment on specific lab values in email — save for appointment.

## Summary rules
Only generate a summary if the email body is:
- Longer than ~150 words (more than 1 paragraph), OR
- Contains a special offer, promotion, discount, or deal

For short transactional emails, receipts, appointment confirmations, brief patient messages — set summary to null and just show the actual email.
`.trim()

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : text.trim()
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
  account: string
): Promise<ProposeResponse> {
  const isWork = account.includes("drkmudry")

  const prompt = `
Analyze these ${emails.length} emails from ${account} and propose exactly 6 categories to organize this inbox.

${existingLabelNames.length > 0 ? `Existing Gmail labels to incorporate where relevant: ${existingLabelNames.join(", ")}` : "No existing labels — propose fresh categories."}

${isWork ? "This is a clinic/work inbox. Categories should reflect clinical practice email types." : "This is a personal inbox. Categories should reflect personal life email types."}

Return a JSON array of exactly 6 objects:
[
  { "name": "CategoryName", "color": "bg-violet-500" },
  ...
]

Color options (pick varied, visually distinct ones):
bg-violet-500, bg-blue-500, bg-emerald-500, bg-amber-500, bg-rose-500, bg-cyan-500, bg-orange-500, bg-pink-500, bg-teal-500, bg-indigo-500

Email subjects/senders for analysis:
${emails.slice(0, 30).map(e => `- From: ${e.from} | Subject: ${e.subject}`).join("\n")}

Return ONLY valid JSON array. No markdown, no explanation.
`.trim()

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: [{ type: "text", text: CLINIC_CONTEXT, cache_control: { type: "ephemeral" } }],
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
  account: string
): Promise<Email[]> {
  if (emails.length === 0) return []

  const categoryList = categories.map(c => c.name).join(", ")
  const isWork = account.includes("drkmudry")

  const prompt = `
Categorize each of these ${emails.length} emails into one of these categories: ${categoryList}

Also assign:
- priority: "urgent" (needs reply today/time-sensitive), "today" (action needed soon), or "fyi" (informational, no action needed)
- microSummary: 2-3 word phrase describing the email's topic or action. Verb-noun style preferred. Examples: "order shipped", "confirm appointment", "payment due", "new episode", "verify account", "lab results". No punctuation.
- actionFlag: one of:
  - "reply" — personal or patient email asking a question that needs a reply
  - "confirm" — needs a specific action, confirmation, scheduling, or response
  - "receipt" — order confirmation, invoice, receipt, or record to keep
  - "read" — newsletter, FYI, promotional, no action needed
- summary: 2-3 sentence plain-English summary IF the body is >150 words OR contains a special offer/promotion. Otherwise null.
- draftReply: ${isWork ? "For patient emails needing a reply — write a reply in Dr. K's voice (warm, casual, 2-4 sentences, sign off 'Best, Dr. K'). For non-patient emails: null." : "null for all emails."}

Return a JSON array with one object per email, in the same order:
[
  {
    "id": "<email id>",
    "category": "<category name>",
    "priority": "urgent|today|fyi",
    "microSummary": "<2-3 words>",
    "actionFlag": "reply|confirm|receipt|read",
    "summary": "<2-3 sentences or null>",
    "draftReply": "<reply text or null>"
  }
]

Emails to process:
${emails.map(e => `ID: ${e.id}
From: ${e.from} <${e.fromEmail}>
Subject: ${e.subject}
Body (truncated): ${e.body.slice(0, 500)}`).join("\n---\n")}

Return ONLY valid JSON array. No markdown, no explanation.
`.trim()

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: [{ type: "text", text: CLINIC_CONTEXT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]"
  let results: { id: string; category: string; priority: "urgent" | "today" | "fyi"; microSummary: string; actionFlag: "reply" | "confirm" | "receipt" | "read"; summary: string | null; draftReply: string | null }[]
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
    }
  })
}
