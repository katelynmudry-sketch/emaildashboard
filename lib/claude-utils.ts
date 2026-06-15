// lib/claude-utils.ts
// Shared utilities and constants for Claude API calls.

// ── Default system context ────────────────────────────────────────────────────
// Single source of truth — imported by lib/claude.ts and app/api/ai/context/route.ts.
// This is a generic, non-personal default shared by every new account. It is NOT
// sourced from an env var — personal context belongs to each user individually,
// entered (or uploaded as a .txt/.md file) via Settings -> AI System Prompt, where
// it's stored in that user's browser and sent only with their own requests.

export const DEFAULT_SYSTEM_CONTEXT = (`You are an AI assistant helping the user triage their email.

## Summary rules
Urgent and today-priority emails get a more detailed 2-4 sentence summary covering context, action needed, dates/deadlines, and amounts. Other emails get a summary only if the body is longer than ~150 words or contains a special offer/promotion — otherwise set summary to null. (Users can opt into detailed summaries for every email via Settings -> Inbox Display.)

## Concise summary style
- Keep summaries extremely short and action-oriented.
- Mention the sender/brand/person only once, and only if it adds clarity.
- If the sender or title already includes a brand or name, do not repeat it again in the summary.
- Prefer this structure: [topic/action] + [deadline/date/time] + [status or amount].
- For promotions or events, include the most important detail and the expiration or date.
- For recurring or grouped emails, summarize what the next step is and what to act on.
- Use no more than 2-3 short phrases in the summary.

Examples:
- "Rick Levine course 33% off until Jun 8"
- "ADHD summit Day 3 expiring Fri 5pm"
- "VIP pass $199 by Tue"
- "Aishwarya update: confirm call details"
- "Astrology Hub sale ends Wed"

## Group logic
- If multiple emails are clearly part of the same series or thread, generate a summary that focuses on the most recent action or deadline.
- Do not turn the summary into a paragraph of repeated names or general marketing copy.
- If the sender is in the subject line, focus on the content instead of the sender name.
`).trim()

// ── Categorization instruction reference (shown read-only in settings UI) ─────

export const CATEGORIZE_INSTRUCTIONS = `## Categorization
Assigns each email to one of the user-defined categories. Also determines:
- **priority**: "urgent" (needs reply today), "today" (action needed soon), "fyi" (informational)
- **microSummary**: 2-3 word verb-noun phrase (e.g. "order shipped", "confirm appointment")
- **actionFlag**:
  - \`reply\` — personal/patient email needing a response
  - \`confirm\` — needs a specific action, confirmation, or scheduling
  - \`receipt\` — order confirmation, invoice, or record to keep
  - \`read\` — newsletter, FYI, promotional, no action needed
- **summary**: Detailed 2-4 sentence summary for urgent/today-priority emails (or all emails, if enabled). Otherwise a 1-2 sentence summary if body >150 words OR contains a special offer, else null.
- **draftReply**: Auto-drafted reply (2-4 sentences) for emails that need a response, otherwise null.
- **deletable**: true if the email is no longer actionable (OTP codes, delivered package confirmations, social notifications, expired promos).
- **packageDelivered**: true if email confirms a package was *actually* delivered (not just "on the way").

## Briefing rules
These rules determine what appears in the Daily Briefing panel:
- **Personal account**: Newsletters and promotional emails (\`actionFlag: "read"\`) are NEVER shown in the briefing, even if they have expiry dates.
- **Work account**: Newsletters only appear in the briefing if they contain a clear savings offer (%, discount, sale price) AND an expiry or deadline within 7 days.`

// ── Strip markdown code fences from Claude JSON responses ─────────────────────

export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : text.trim()
}
