import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { getDharmaTeacher, getDharmaTeachers, getDailyQuoteIndex } from "@/lib/dashboard-data"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: Request) {
  const token = await getServerToken()
  if (!token?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const teacherId = searchParams.get("teacher") ?? "thich-nhat-hanh"

  let teacher = await getDharmaTeacher(teacherId)
  if (!teacher) {
    const all = await getDharmaTeachers()
    teacher = all[0]
  }
  if (!teacher) {
    return NextResponse.json({ error: "No teachers found" }, { status: 500 })
  }

  const idx = getDailyQuoteIndex(teacher.quotes.length)
  const todayQuote = teacher.quotes[idx]

  // Generate a reflection question with Claude (Haiku — very cheap, ~$0.0002)
  let reflection = "What does this land in your body right now?"
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{
        role: "user",
        content: `Given this quote by ${teacher.name}: "${todayQuote.text}"

Write ONE short, open contemplative question (under 15 words) for a morning meditation practice.
The question should invite inward reflection, not analysis.
Return ONLY the question, no preamble.`
      }],
    })
    if (response.content[0].type === "text") {
      reflection = response.content[0].text.trim().replace(/^["']|["']$/g, "")
    }
  } catch (err) {
    console.error("[dharma] reflection generation failed:", err)
    // keep default reflection — don't fail the whole response
  }

  return NextResponse.json({
    teacher: { id: teacher.id, name: teacher.name, tradition: teacher.tradition },
    quote: todayQuote.text,
    source: todayQuote.source ?? null,
    reflection,
    // Client caches by this key to avoid re-calling on same day
    cacheKey: new Date().toISOString().slice(0, 10),
  })
}
