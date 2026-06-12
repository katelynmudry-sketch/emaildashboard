// lib/claude-utils.ts
// Shared utilities and constants for Claude API calls.

// ── Default system context (CLINIC_CONTEXT) ──────────────────────────────────
// Single source of truth — imported by lib/claude.ts and app/api/ai/context/route.ts.
// Override at runtime with the CLINIC_CONTEXT env var or via user settings in localStorage.

export const DEFAULT_SYSTEM_CONTEXT = (process.env.CLINIC_CONTEXT ?? `You are an AI assistant helping the user triage their email.

## Summary rules
Only generate a summary if the email body is longer than ~150 words or contains a special offer/promotion. Otherwise set summary to null.

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
- **summary**: 1-2 sentence summary if body >150 words OR contains a special offer. Otherwise null.
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
