import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { extractJson } from "@/lib/claude-utils"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 30

interface EditContextRequest {
  userRequest: string
  currentPersonalRules: string
  currentWorkRules: string
  currentSystemContext: string
}

interface SuggestedChange {
  section: "personalRules" | "workRules" | "systemContext"
  newText: string
  label: string  // human-readable label for the diff card
}

interface EditContextResponse {
  explanation: string
  changes: SuggestedChange[]
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token && !session?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const {
      userRequest,
      currentPersonalRules,
      currentWorkRules,
      currentSystemContext,
    }: EditContextRequest = await request.json()

    if (!userRequest?.trim()) {
      return NextResponse.json({ error: "userRequest is required" }, { status: 400 })
    }

    const prompt = `You are helping a user update the AI instructions for their personal email triage app.

The app has three editable instruction sections:

1. SYSTEM CONTEXT (base personality/style rules for Claude):
---
${currentSystemContext || "(empty — using default)"}
---

2. PERSONAL ACCOUNT RULES (extra instructions for personal inbox):
---
${currentPersonalRules || "(none)"}
---

3. WORK ACCOUNT RULES (extra instructions for work/clinic inbox):
---
${currentWorkRules || "(none)"}
---

The user wants to make this change:
"${userRequest.trim()}"

Determine which section(s) need updating. Return the FULL updated text for each changed section (not just the diff — the complete replacement text).

Return a JSON object with this exact shape:
{
  "explanation": "one short sentence describing what you changed",
  "changes": [
    {
      "section": "personalRules" | "workRules" | "systemContext",
      "label": "Personal inbox rules" | "Work inbox rules" | "System context",
      "newText": "the full updated text for this section"
    }
  ]
}

Rules:
- Only include sections that actually need to change.
- For personalRules and workRules, write clear natural-language instructions Claude can follow.
- For systemContext, maintain the existing style and structure — only add/modify what's needed.
- If the request is ambiguous about which account (personal vs work), update both with appropriate variants.
- Return ONLY valid JSON. No markdown, no explanation outside the JSON.`

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}"
    const jsonText = extractJson(raw)

    const result = JSON.parse(jsonText) as EditContextResponse
    return NextResponse.json(result)
  } catch (err) {
    console.error("[edit-context] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate suggestion" },
      { status: 500 }
    )
  }
}
