import { NextResponse } from "next/server"
import { getServerToken } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { saveManifestationContent } from "@/lib/dashboard-data"
import type { ManifestationContent } from "@/lib/types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const token = await getServerToken()
  if (!token?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { imageBase64, mediaType = "image/jpeg" } = await request.json() as {
    imageBase64: string
    mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
  }

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 })
  }

  const prompt = `This is a photo of someone's personal journal or vision board showing their intentions and manifestation work.

Please extract the written content and return it as a JSON object with this exact shape:
{
  "yearIntention": "<the main year/season intention statement — usually the largest or most prominent text>",
  "callingIn": [
    { "tag": "<short label like 'Abundance', 'Love', 'Health', 'Creativity'>", "color": "<one of: --gold, --rose, --teal, --purple, --orange, --lime>", "text": "<what they are calling in for this theme>" }
  ]
}

Rules:
- If you can't read the handwriting clearly, do your best and note [unclear] for truly illegible parts
- "yearIntention" should be the main affirmation or intention statement
- "callingIn" should be the list of intentions/desires they've written — assign colors that feel semantically appropriate (gold for abundance/prosperity, rose for love/relationships, teal for health/body, purple for spiritual/magic, orange for creativity/career, lime for growth/nature)
- Extract up to 6 callingIn items
- Return ONLY the JSON, no explanation

If the image doesn't appear to contain journal/intention writing, return:
{ "yearIntention": "", "callingIn": [] }`

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",  // Sonnet for Vision quality
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 }
          },
          { type: "text", text: prompt }
        ]
      }]
    })

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}"
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const extracted = JSON.parse(jsonMatch?.[0] ?? "{}") as Partial<ManifestationContent>

    const content: ManifestationContent = {
      yearIntention: extracted.yearIntention ?? "",
      callingIn: extracted.callingIn ?? [],
      moonPhase: "",
      lastUpdated: new Date().toISOString(),
    }

    await saveManifestationContent(content)
    return NextResponse.json(content)
  } catch (err) {
    console.error("[manifestation/extract]", err)
    return NextResponse.json(
      { error: "Failed to extract from image — try a clearer photo" },
      { status: 500 }
    )
  }
}
