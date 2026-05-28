# Morning Dashboard — Full Feature Plan
**Date**: 2026-05-27  
**Branch**: `feature/morning-dashboard`

---

## Header

**Goal**: Add a collapsible "Morning Dashboard" panel above the inbox that shows today's Google Calendar, a daily Buddhist quote from a chosen teacher, the user's personal manifestation intentions, a 4-7-8 breathwork timer, and a visual breakdown of the day + inbox by category — with 3 selectable visual themes.

**Architecture**: A thin data layer (`data/dashboard-content.json` for manifestation, `data/dharma-teachers.json` for curated quotes) feeds static content to the UI with zero daily API cost. Google Calendar is fetched live on load and cached 15 min in `localStorage`. Claude Vision extracts intentions from journal photos on-upload only. A single Haiku call generates a daily reflection question, cached in `localStorage` by date.

**Design Patterns**: Repository pattern for dashboard data (`lib/dashboard-data.ts`), Strategy pattern for theme rendering (3 theme configs fed into one `DashboardPanel` component), Pre-computation pattern for daily quote (deterministic day-of-year index — no runtime API call for the quote itself).

**Tech Stack**: Next.js App Router, `@anthropic-ai/sdk` (Vision for photo extraction, Haiku for reflection), Google Calendar API (via existing `googleapis` package + new OAuth scope), localStorage for theme pref + calendar cache + daily reflection cache, TypeScript strict.

---

## Answer: Pre-load vs. Daily Claude Pull

| Widget | Data Source | Claude Involved? |
|---|---|---|
| Manifestation | `data/dashboard-content.json` (written once on photo upload) | Only on upload (Vision API) |
| Dharma quote | `data/dharma-teachers.json` — deterministic daily rotation | Never for the quote itself |
| Reflection seed | `localStorage` cache keyed by date | Once per day (Haiku, ~50 tokens) |
| Google Calendar | Google Calendar API, 15-min localStorage cache | Never |
| Theme preference | `localStorage` | Never |
| 4-7-8 breathwork timer | Pure client-side (CSS animation + JS state) | Never |
| Day + inbox breakdown | Computed from existing `emails` state + calendar events already in memory | Never |

**Cost estimate**: ~$0.0002/day in Claude tokens (just the reflection question). Upload of a journal photo: ~$0.005 per image.

---

## Conventions (from codebase scan)

- **Auth**: `import { auth } from "@/lib/auth"` — all API routes use this pattern
- **Claude client**: `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` — instantiated per route file
- **Model**: `claude-haiku-4-5-20251001` for fast/cheap calls; use `claude-sonnet-4-6` for Vision
- **Prompt caching**: Add `cache_control: { type: "ephemeral" }` to system blocks per `lib/claude.ts` pattern
- **Data files**: `data/*.json` pattern already established (`data/custom-context.json`, `data/categorization-rules.json`)
- **No test framework installed** — verification is: `npm run build` (TypeScript compile) + manual browser check
- **API responses**: Always `NextResponse.json(...)` with status codes
- **Google APIs**: `googleapis` package already installed — use existing auth token from session
- **Calendar scope**: Must add `https://www.googleapis.com/auth/calendar.readonly` to `lib/auth.ts` OAuth config
- **Reuse**: `lib/gmail-auth.ts` already has `getGoogleAuth()` helper — use it for Calendar API too

---

## Block 1: Data Layer + Types

> Everything the widgets need to read/write, defined before any UI exists.

**Success Criteria**:
- [ ] `lib/types.ts` exports `DashboardTheme`, `DharmaTeacher`, `ManifestationContent`, `DashboardPrefs` types
- [ ] `data/dharma-teachers.json` exists with ≥ 4 teachers and ≥ 20 quotes each
- [ ] `data/dashboard-content.json` template exists (empty defaults)
- [ ] `lib/dashboard-data.ts` has typed read/write functions for both files
- [ ] `npm run build` passes with zero errors

---

### Chunk 1.1 — Add dashboard types to `lib/types.ts`

**Files**: Modify `lib/types.ts` (append to end of file)

**Step 1 — Write failing build check**:
```typescript
// In any component, temporarily add:
import type { DashboardTheme } from "@/lib/types"
const _t: DashboardTheme = "morning-altar" // TS error: DashboardTheme does not exist
```

**Step 2 — Verify failure**: `npm run build` → `Type error: Module '"@/lib/types"' has no exported member 'DashboardTheme'`

**Step 3 — Implement**:
```typescript
// Append to lib/types.ts:

export type DashboardTheme = "morning-altar" | "festival-stage" | "wabi-sabi-studio"

export interface DharmaTeacher {
  id: string
  name: string
  tradition: string
  description: string
  quotes: Array<{
    text: string
    source?: string
  }>
}

export interface ManifestationContent {
  yearIntention: string
  callingIn: Array<{
    tag: string      // e.g. "Abundance", "Love", "Health"
    color: string    // CSS var name e.g. "--gold"
    text: string
  }>
  moonPhase?: string
  lastUpdated?: string // ISO date
}

export interface DashboardPrefs {
  theme: DashboardTheme
  dharmaTeacherId: string
  dashboardOpen: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  startTime: string   // HH:MM format
  endTime?: string
  colorDot: string    // hex color
  location?: string
  isNow?: boolean
}
```

**Step 4 — Verify pass**: `npm run build` → zero new errors

**Step 5 — Commit**:
```bash
git add lib/types.ts
git commit -m "feat(dashboard): add DashboardTheme, DharmaTeacher, ManifestationContent types"
```

---

### Chunk 1.2 — Seed `data/dharma-teachers.json`

**Files**: Create `data/dharma-teachers.json`

**Step 3 — Implement** (populate with 4 real teachers, 25 quotes each):
```json
[
  {
    "id": "thich-nhat-hanh",
    "name": "Thich Nhat Hanh",
    "tradition": "Zen / Plum Village",
    "description": "Vietnamese Zen master, peace activist, and author of The Miracle of Mindfulness",
    "quotes": [
      { "text": "The present moment is the only moment available to us, and it is the door to all moments.", "source": "The Miracle of Mindfulness" },
      { "text": "Smile, breathe, and go slowly.", "source": "Zen Keys" },
      { "text": "If you love someone but rarely make yourself available to them, that is not true love.", "source": "True Love" },
      { "text": "The most precious gift we can offer anyone is our attention.", "source": "The Miracle of Mindfulness" },
      { "text": "Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.", "source": "Stepping into Freedom" },
      { "text": "Because you are alive, everything is possible.", "source": "The Heart of the Buddha's Teaching" },
      { "text": "The seed of suffering in you may be strong, but don't wait until you have no more suffering before allowing yourself to be happy.", "source": "No Mud, No Lotus" },
      { "text": "Waking up this morning, I smile. Twenty-four brand new hours are before me.", "source": "Present Moment Wonderful Moment" },
      { "text": "People usually consider walking on water or in thin air a miracle. But I think the real miracle is not to walk either on water or in thin air, but to walk on earth.", "source": "The Miracle of Mindfulness" },
      { "text": "To be beautiful means to be yourself. You don't need to be accepted by others. You need to accept yourself.", "source": "Teachings on Love" },
      { "text": "The present moment contains past and future. The secret of transformation is in the way we handle this very moment.", "source": "Savor" },
      { "text": "In mindfulness one is not only restful and happy, but alert and awake.", "source": "The Miracle of Mindfulness" },
      { "text": "When you plant lettuce, if it does not grow well, you don't blame the lettuce.", "source": "Peace Is Every Step" },
      { "text": "My actions are my only true belongings.", "source": "Understanding Our Mind" },
      { "text": "When you look deeply into your anger, you will see that the person you call your enemy is also suffering.", "source": "Living Buddha, Living Christ" },
      { "text": "Through my love for you, I want to express my love for the whole cosmos, the whole of humanity, and all beings.", "source": "Teachings on Love" },
      { "text": "Drink your tea slowly and reverently, as if it is the axis on which the world earth revolves.", "source": "Present Moment Wonderful Moment" },
      { "text": "Hope is important because it can make the present moment less difficult to bear.", "source": "Peace Is Every Step" },
      { "text": "Every breath we take, every step we make, can be filled with peace, joy and serenity.", "source": "Peace Is Every Step" },
      { "text": "Life is available only in the present moment.", "source": "The Art of Living" },
      { "text": "Sometimes your joy is the source of your smile, but sometimes your smile can be the source of your joy.", "source": "Peace Is Every Step" },
      { "text": "To think in terms of either pessimism or optimism oversimplifies the truth.", "source": "Being Peace" },
      { "text": "We are here to awaken from our illusion of separateness.", "source": "Interbeing" },
      { "text": "The foundation of happiness is mindfulness.", "source": "The Art of Living" },
      { "text": "Letting go gives us freedom, and freedom is the only condition for happiness.", "source": "The Heart of the Buddha's Teaching" }
    ]
  },
  {
    "id": "pema-chodron",
    "name": "Pema Chödrön",
    "tradition": "Tibetan / Shambhala",
    "description": "American Buddhist nun and student of Chögyam Trungpa, author of When Things Fall Apart",
    "quotes": [
      { "text": "You are the sky. Everything else is just the weather.", "source": "Comfortable with Uncertainty" },
      { "text": "The most fundamental aggression to ourselves, the most fundamental harm we can do to ourselves, is to remain ignorant by not having the courage and the respect to look at ourselves honestly and gently.", "source": "When Things Fall Apart" },
      { "text": "Nothing ever goes away until it has taught us what we need to know.", "source": "When Things Fall Apart" },
      { "text": "We think that the point is to pass the test or overcome the problem, but the truth is that things don't really get solved. They come together and they fall apart.", "source": "When Things Fall Apart" },
      { "text": "Lean into the discomfort of the work.", "source": "Comfortable with Uncertainty" },
      { "text": "The most precious opportunity presents itself when we come to the place where we think we can't handle whatever is happening.", "source": "When Things Fall Apart" },
      { "text": "Impermanence is a principle of harmony. When we don't struggle against it, we are in harmony with reality.", "source": "Comfortable with Uncertainty" },
      { "text": "Rather than letting our negativity get the better of us, we could acknowledge that right now we feel like a piece of shit and not be squeamish about taking a good look.", "source": "When Things Fall Apart" },
      { "text": "Start where you are.", "source": "Start Where You Are" },
      { "text": "Compassion is not a relationship between the healer and the wounded. It's a relationship between equals.", "source": "When Things Fall Apart" },
      { "text": "We already have everything we need. There is no need for self-improvement.", "source": "Start Where You Are" },
      { "text": "If we learn to open our hearts, anyone, including the people who drive us crazy, can be our teacher.", "source": "Practicing Peace in Times of War" },
      { "text": "Life is glorious, but life is also wretched. It is both.", "source": "The Wisdom of No Escape" },
      { "text": "The healing comes from letting there be room for all of this to happen: room for grief, for relief, for misery, for joy.", "source": "When Things Fall Apart" },
      { "text": "The path is the goal.", "source": "The Wisdom of No Escape" },
      { "text": "To be fully alive, fully human, and completely awake is to be continually thrown out of the nest.", "source": "Comfortable with Uncertainty" },
      { "text": "Feelings like disappointment, embarrassment, irritation, resentment, anger, jealousy, and fear, instead of being bad news, are actually very clear moments that teach us where it is that we're holding back.", "source": "When Things Fall Apart" },
      { "text": "Things falling apart is a kind of testing and also a kind of healing.", "source": "When Things Fall Apart" },
      { "text": "The essence of bravery is being without self-deception.", "source": "Comfortable with Uncertainty" },
      { "text": "In order to have compassion for others, we have to have compassion for ourselves.", "source": "Start Where You Are" },
      { "text": "Meditation is not about getting rid of thoughts. It's about getting to know them.", "source": "How to Meditate" },
      { "text": "When you open yourself to the continually changing, impermanent, dynamic nature of your own being and of reality, you increase your capacity to love and care for others.", "source": "Comfortable with Uncertainty" },
      { "text": "Awakening is not a process of building ourselves up but a process of letting go.", "source": "The Wisdom of No Escape" },
      { "text": "Every act counts. Every thought and emotion counts too.", "source": "Start Where You Are" },
      { "text": "The trick is to keep exploring and not bail out, even when we find out that something is not what we thought.", "source": "When Things Fall Apart" }
    ]
  },
  {
    "id": "jack-kornfield",
    "name": "Jack Kornfield",
    "tradition": "Vipassana / Spirit Rock",
    "description": "Co-founder of Spirit Rock Meditation Center, trained as a monk in Thailand, Burma, and India",
    "quotes": [
      { "text": "The trouble is, you think you have time.", "source": "A Path with Heart" },
      { "text": "If your compassion does not include yourself, it is incomplete.", "source": "A Path with Heart" },
      { "text": "In the end, just three things matter: How well we have lived. How well we have loved. How well we have learned to let go.", "source": "A Path with Heart" },
      { "text": "We can struggle with what is, but it doesn't change what is.", "source": "The Wise Heart" },
      { "text": "Even the greatest teachers have bad days.", "source": "A Path with Heart" },
      { "text": "The present moment always will have been.", "source": "After the Ecstasy, the Laundry" },
      { "text": "Enlightenment is intimacy with all things.", "source": "The Wise Heart" },
      { "text": "The art of forgiveness begins with the fact that anything can be healed.", "source": "A Path with Heart" },
      { "text": "To be present is to feel the aliveness of this moment.", "source": "The Wise Heart" },
      { "text": "Everything that has a beginning has an ending. Make your peace with that and all will be well.", "source": "A Path with Heart" },
      { "text": "Being generous is one of the most joyful of all human experiences. It's about opening the heart.", "source": "The Art of Forgiveness, Lovingkindness, and Peace" },
      { "text": "We are not meant to figure out everything. We are meant to live.", "source": "After the Ecstasy, the Laundry" },
      { "text": "Our task is not to seek for love, but merely to seek and find all the barriers within yourself that you have built against it.", "source": "A Path with Heart" },
      { "text": "Mindfulness helps us to not take things so personally.", "source": "The Wise Heart" },
      { "text": "Our sorrows and wounds are healed only when we touch them with compassion.", "source": "A Path with Heart" },
      { "text": "The heart is like a garden: it can grow compassion or fear, resentment or love. What seeds will you plant there?", "source": "The Wise Heart" },
      { "text": "We do not have to improve ourselves. We just have to let go of what blocks our heart.", "source": "A Path with Heart" },
      { "text": "True happiness is not made in getting something. True happiness is becoming something.", "source": "After the Ecstasy, the Laundry" },
      { "text": "As we heal ourselves, we heal the world.", "source": "The Wise Heart" },
      { "text": "You can explore the universe looking for somebody who is more deserving of your love and affection than you are yourself, and you will not find that person anywhere.", "source": "A Path with Heart" },
      { "text": "Breathing in, I calm my body and mind. Breathing out, I smile.", "source": "The Art of Forgiveness, Lovingkindness, and Peace" },
      { "text": "Awakening is the natural state of the heart when it is unobstructed.", "source": "The Wise Heart" },
      { "text": "Grief, when it comes, is nothing like we expect it to be.", "source": "A Path with Heart" },
      { "text": "Grace is what picks you up when you can't get up yourself.", "source": "After the Ecstasy, the Laundry" },
      { "text": "Real fearlessness is the product of tenderness.", "source": "A Path with Heart" }
    ]
  },
  {
    "id": "tara-brach",
    "name": "Tara Brach",
    "tradition": "Vipassana / Western",
    "description": "Psychologist and Buddhist teacher, author of Radical Acceptance and True Refuge",
    "quotes": [
      { "text": "Radical acceptance is the willingness to experience ourselves and our lives as it is.", "source": "Radical Acceptance" },
      { "text": "Perhaps the most radical act of self-care is to stop judging ourselves.", "source": "Radical Acceptance" },
      { "text": "The boundary to what we can accept is the boundary to our freedom.", "source": "Radical Acceptance" },
      { "text": "Instead of asking, 'What's wrong with me?' we can ask, 'What's going on for me?'", "source": "Radical Compassion" },
      { "text": "When we pause, allow a gap, and breathe deeply, we can experience instant refreshment.", "source": "Radical Acceptance" },
      { "text": "The pain of disconnection is a call to return home to our own heart.", "source": "True Refuge" },
      { "text": "We are not our thoughts or feelings. We are the awareness that notices them.", "source": "Radical Compassion" },
      { "text": "The intimacy that arises in listening and speaking truth is only possible if we can open to the vulnerability of our own hearts.", "source": "Radical Acceptance" },
      { "text": "You can't hate yourself into a better version of yourself.", "source": "Radical Acceptance" },
      { "text": "Healing doesn't mean the damage never existed. It means the damage no longer controls our lives.", "source": "True Refuge" },
      { "text": "Our suffering comes from our resistance to the truth of impermanence.", "source": "Radical Acceptance" },
      { "text": "When we lose ourselves in activities, we lose touch with who we really are.", "source": "Radical Acceptance" },
      { "text": "The practice of RAIN: Recognize, Allow, Investigate, Nurture.", "source": "Radical Compassion" },
      { "text": "True refuge is not a place that's sheltered from trouble. It's a place of understanding and love.", "source": "True Refuge" },
      { "text": "Mindfulness is a kind of loving awareness.", "source": "Radical Compassion" },
      { "text": "Compassion is the natural response of love meeting suffering.", "source": "Radical Acceptance" },
      { "text": "The need for approval is a prison. Seek only the approval of your own heart.", "source": "Radical Acceptance" },
      { "text": "Feeling fear, hurt, or anger is not a sign that something has gone wrong.", "source": "True Refuge" },
      { "text": "When we are not present, we are essentially asleep to our lives.", "source": "Radical Compassion" },
      { "text": "Love is not a state, a feeling, or an emotion. It is the ground of being itself.", "source": "True Refuge" },
      { "text": "Wherever you are is called Here, and you must treat it as a powerful stranger.", "source": "Radical Acceptance" },
      { "text": "Suffering is craving things to be other than they are.", "source": "Radical Acceptance" },
      { "text": "Each moment of fully accepting what is frees us from the grip of the past.", "source": "Radical Compassion" },
      { "text": "We can't think our way to freedom. We must feel our way.", "source": "True Refuge" },
      { "text": "The more we recognize the fleeting nature of thought and feeling, the less we are ruled by them.", "source": "Radical Compassion" }
    ]
  }
]
```

**Step 4 — Verify**: File exists, valid JSON: `node -e "JSON.parse(require('fs').readFileSync('data/dharma-teachers.json','utf-8')); console.log('OK')"`

**Step 5 — Commit**:
```bash
git add data/dharma-teachers.json
git commit -m "feat(dashboard): add dharma teachers quote database (4 teachers, 100 quotes)"
```

---

### Chunk 1.3 — Create `data/dashboard-content.json` (empty defaults)

**Files**: Create `data/dashboard-content.json`

**Step 3 — Implement**:
```json
{
  "yearIntention": "",
  "callingIn": [
    { "tag": "Abundance", "color": "--gold", "text": "" },
    { "tag": "Love", "color": "--rose", "text": "" },
    { "tag": "Health", "color": "--teal", "text": "" },
    { "tag": "Magic", "color": "--purple", "text": "" }
  ],
  "moonPhase": "",
  "lastUpdated": ""
}
```

**Step 5 — Commit**:
```bash
git add data/dashboard-content.json
git commit -m "feat(dashboard): add dashboard-content.json template"
```

---

### Chunk 1.4 — `lib/dashboard-data.ts` — typed data access layer

**Files**: Create `lib/dashboard-data.ts`

**Step 3 — Implement**:
```typescript
import { promises as fs } from "fs"
import path from "path"
import type { DharmaTeacher, ManifestationContent } from "./types"

const DATA_DIR = path.join(process.cwd(), "data")

export async function getDharmaTeachers(): Promise<DharmaTeacher[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "dharma-teachers.json"), "utf-8")
  return JSON.parse(raw) as DharmaTeacher[]
}

export async function getDharmaTeacher(id: string): Promise<DharmaTeacher | null> {
  const teachers = await getDharmaTeachers()
  return teachers.find(t => t.id === id) ?? null
}

export function getDailyQuoteIndex(quotesLength: number): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000)
  return dayOfYear % quotesLength
}

export async function getManifestationContent(): Promise<ManifestationContent> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "dashboard-content.json"), "utf-8")
    return JSON.parse(raw) as ManifestationContent
  } catch {
    return { yearIntention: "", callingIn: [], moonPhase: "", lastUpdated: "" }
  }
}

export async function saveManifestationContent(content: ManifestationContent): Promise<void> {
  const withDate = { ...content, lastUpdated: new Date().toISOString() }
  await fs.writeFile(
    path.join(DATA_DIR, "dashboard-content.json"),
    JSON.stringify(withDate, null, 2),
    "utf-8"
  )
}
```

**Step 4 — Verify**: `npm run build` → zero errors

**Step 5 — Commit**:
```bash
git add lib/dashboard-data.ts
git commit -m "feat(dashboard): add dashboard-data.ts repository layer"
```

---

## Block 2: Google Calendar API

> Plug in Calendar scope + a clean API route returning today's events.

**Success Criteria**:
- [ ] `lib/auth.ts` includes `calendar.readonly` scope
- [ ] `GET /api/calendar/today` returns today's events array (or empty array if no events)
- [ ] Response shape matches `CalendarEvent[]` type
- [ ] Graceful fallback: returns `[]` (not 500) if Calendar API fails

**⚠️ Important**: Adding the Calendar scope requires users to re-authenticate. The existing refresh token won't include it. Users will need to sign out and back in once after this deploy.

---

### Chunk 2.1 — Add Calendar scope to OAuth config

**Files**: Modify `lib/auth.ts:L34-42`

**Step 3 — Implement** (add one line to the scope array):
```typescript
// In lib/auth.ts, update the scope array:
scope: [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/calendar.readonly",  // ← ADD THIS
].join(" "),
```

**Step 5 — Commit**:
```bash
git add lib/auth.ts
git commit -m "feat(dashboard): add calendar.readonly OAuth scope"
```

---

### Chunk 2.2 — Create `app/api/calendar/today/route.ts`

**Files**: Create `app/api/calendar/today/route.ts`

**Step 3 — Implement**:
```typescript
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { google } from "googleapis"
import type { CalendarEvent } from "@/lib/types"

const EVENT_COLORS = ["#FF1F6E", "#FFD000", "#FF6B1A", "#00C4A7", "#8FC900", "#8B3FD8"]

function toHHMM(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true })
}

export async function GET() {
  const session = await auth()
  const accessToken = session?.access_token
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const oauth2 = new google.auth.OAuth2()
    oauth2.setCredentials({ access_token: accessToken })
    const calendar = google.calendar({ version: "v3", auth: oauth2 })

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    })

    const nowMs = now.getTime()
    const events: CalendarEvent[] = (res.data.items ?? []).map((item, i) => {
      const start = item.start?.dateTime ?? item.start?.date ?? ""
      const end = item.end?.dateTime ?? item.end?.date ?? ""
      const startMs = start ? new Date(start).getTime() : 0
      const endMs = end ? new Date(end).getTime() : startMs + 3_600_000
      return {
        id: item.id ?? String(i),
        title: item.summary ?? "Untitled event",
        startTime: start ? toHHMM(start) : "All day",
        endTime: end ? toHHMM(end) : undefined,
        colorDot: EVENT_COLORS[i % EVENT_COLORS.length],
        location: item.location ?? undefined,
        isNow: nowMs >= startMs && nowMs <= endMs,
      }
    })

    return NextResponse.json({ events })
  } catch (err) {
    console.error("[calendar/today]", err)
    return NextResponse.json({ events: [] }) // graceful fallback — never 500 for dashboard
  }
}
```

**Step 4 — Verify**: `npm run build` → zero errors. Manual test: open app → Network tab → `GET /api/calendar/today`

**Step 5 — Commit**:
```bash
git add app/api/calendar/today/route.ts
git commit -m "feat(dashboard): add GET /api/calendar/today route"
```

---

## Block 3: Dharma API Routes

> One route returns a quote + Claude-generated reflection. Another handles teacher preference.

**Success Criteria**:
- [ ] `GET /api/dashboard/dharma?teacher=<id>` returns `{ quote, source, teacher, reflection }`
- [ ] Reflection is Claude-generated (Haiku) but cached in response — client caches by date in localStorage
- [ ] Unknown teacher ID falls back to first available teacher
- [ ] `GET /api/dashboard/dharma/teachers` returns list of all teachers (id, name, tradition, description)

---

### Chunk 3.1 — Create `app/api/dashboard/dharma/route.ts`

**Files**: Create `app/api/dashboard/dharma/route.ts`

**Step 3 — Implement**:
```typescript
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { getDharmaTeacher, getDharmaTeachers, getDailyQuoteIndex } from "@/lib/dashboard-data"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
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

  // Generate a reflection question with Claude (Haiku — very cheap)
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
    // Client should cache this by date to avoid re-calling
    cacheKey: new Date().toISOString().slice(0, 10),
  })
}
```

---

### Chunk 3.2 — Create `app/api/dashboard/dharma/teachers/route.ts`

**Files**: Create `app/api/dashboard/dharma/teachers/route.ts`

**Step 3 — Implement**:
```typescript
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getDharmaTeachers } from "@/lib/dashboard-data"

export async function GET() {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const teachers = await getDharmaTeachers()
  // Return only metadata, not the full quotes array
  const list = teachers.map(({ id, name, tradition, description }) => ({ id, name, tradition, description }))
  return NextResponse.json({ teachers: list })
}
```

**Step 5 — Commit (both dharma routes together)**:
```bash
git add app/api/dashboard/dharma/
git commit -m "feat(dashboard): add dharma quote + teacher list API routes"
```

---

## Block 4: Manifestation API Routes

> Upload a journal photo → Claude Vision extracts intentions. CRUD for the content.

**Success Criteria**:
- [ ] `POST /api/dashboard/manifestation/extract` accepts a base64 image, returns extracted `ManifestationContent`
- [ ] `GET /api/dashboard/manifestation` returns current saved content
- [ ] `PUT /api/dashboard/manifestation` saves updated content (manual edits)
- [ ] Image upload gracefully handles non-handwriting images (returns partial result, not error)

---

### Chunk 4.1 — Create `app/api/dashboard/manifestation/route.ts` (GET + PUT)

**Files**: Create `app/api/dashboard/manifestation/route.ts`

**Step 3 — Implement**:
```typescript
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getManifestationContent, saveManifestationContent } from "@/lib/dashboard-data"
import type { ManifestationContent } from "@/lib/types"

export async function GET() {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const content = await getManifestationContent()
  return NextResponse.json(content)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json() as ManifestationContent
  await saveManifestationContent(body)
  return NextResponse.json({ ok: true })
}
```

---

### Chunk 4.2 — Create `app/api/dashboard/manifestation/extract/route.ts`

**Files**: Create `app/api/dashboard/manifestation/extract/route.ts`

**Step 3 — Implement**:
```typescript
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"
import { saveManifestationContent } from "@/lib/dashboard-data"
import type { ManifestationContent } from "@/lib/types"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token) {
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
```

**Step 5 — Commit**:
```bash
git add app/api/dashboard/
git commit -m "feat(dashboard): add manifestation GET/PUT/extract API routes with Claude Vision"
```

---

## Block 5: Client Prefs (localStorage)

> Theme choice + teacher preference + daily reflection cache — all client-side, instant.

**Success Criteria**:
- [ ] `lib/dashboard-prefs.ts` exports typed read/write functions
- [ ] Reading a missing key returns safe defaults (theme: "morning-altar", teacher: "thich-nhat-hanh")
- [ ] `getDharmaCache()` returns null if cached date ≠ today

---

### Chunk 5.1 — Create `lib/dashboard-prefs.ts`

**Files**: Create `lib/dashboard-prefs.ts`

**Step 3 — Implement**:
```typescript
import type { DashboardPrefs, DashboardTheme } from "./types"

const PREFS_KEY = "inbox-ai:dashboard-prefs"
const DHARMA_CACHE_KEY = "inbox-ai:dharma-cache"

const DEFAULTS: DashboardPrefs = {
  theme: "morning-altar",
  dharmaTeacherId: "thich-nhat-hanh",
  dashboardOpen: true,
}

export function getDashboardPrefs(): DashboardPrefs {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) } as DashboardPrefs
  } catch {
    return DEFAULTS
  }
}

export function saveDashboardPrefs(prefs: Partial<DashboardPrefs>): void {
  if (typeof window === "undefined") return
  const current = getDashboardPrefs()
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }))
}

export function setDashboardTheme(theme: DashboardTheme): void {
  saveDashboardPrefs({ theme })
}

export function setDharmaTeacher(id: string): void {
  saveDashboardPrefs({ dharmaTeacherId: id })
}

export function setDashboardOpen(open: boolean): void {
  saveDashboardPrefs({ dashboardOpen: open })
}

// Daily dharma cache — avoids re-calling Claude for the reflection on same day
export interface DharmaCache {
  date: string // YYYY-MM-DD
  teacher: string
  quote: string
  source: string | null
  reflection: string
  teacherName: string
  teacherTradition: string
}

export function getDharmaCache(teacherId: string): DharmaCache | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DHARMA_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as DharmaCache
    const today = new Date().toISOString().slice(0, 10)
    if (cached.date !== today || cached.teacher !== teacherId) return null
    return cached
  } catch {
    return null
  }
}

export function saveDharmaCache(data: DharmaCache): void {
  if (typeof window === "undefined") return
  localStorage.setItem(DHARMA_CACHE_KEY, JSON.stringify(data))
}
```

**Step 4 — Verify**: `npm run build` → zero errors

**Step 5 — Commit**:
```bash
git add lib/dashboard-prefs.ts
git commit -m "feat(dashboard): add dashboard-prefs.ts with theme, teacher, dharma cache helpers"
```

---

## Block 6: UI Components

> Three themed widget components + the collapsible dashboard panel wrapper + settings modal.

**Success Criteria**:
- [ ] `DashboardPanel` renders above email list, collapsed/expanded state persisted to prefs
- [ ] `CalendarWidget` shows today's events (live from API, cached 15 min)
- [ ] `DharmaWidget` shows quote + reflection (cached by date), teacher selector dropdown
- [ ] `ManifestationWidget` shows content from API, has edit mode + photo upload button
- [ ] `ThemeSelector` lets user pick between 3 themes; selection persists across reloads
- [ ] All 3 themes render correctly (CSS vars + Tailwind coexist)
- [ ] Dashboard can be hidden/shown with smooth animation
- [ ] `BreathworkWidget` animates through 4s inhale → 7s hold → 8s exhale cycle with a visual ring; start/stop/reset controls
- [ ] `InsightWidget` shows two donut/bar charts: inbox split by email category % + calendar day split by event type %

---

### Chunk 6.1 — Create `components/dashboard/` folder + theme config

**Files**: Create `components/dashboard/theme-config.ts`

**Step 3 — Implement**:
```typescript
import type { DashboardTheme } from "@/lib/types"

export interface ThemeConfig {
  id: DashboardTheme
  name: string
  emoji: string
  description: string
  // CSS-in-JS style tokens for the panel
  panelBg: string
  cardBg: string
  cardBorder: string
  cardRadius: string
  cardShadow: string
  titleFont: string
  labelStyle: React.CSSProperties
  fontImport: string
}

export const THEMES: Record<DashboardTheme, ThemeConfig> = {
  "morning-altar": {
    id: "morning-altar",
    name: "Morning Altar",
    emoji: "🕯️",
    description: "Sacred, contemplative — Cormorant serif",
    panelBg: "transparent",
    cardBg: "#FFFEF9",
    cardBorder: "1px solid rgba(200,150,12,0.18)",
    cardRadius: "18px",
    cardShadow: "0 2px 24px rgba(200,150,12,0.06)",
    titleFont: "'Cormorant Garamond', Georgia, serif",
    labelStyle: { fontFamily: "'Cormorant Garamond', serif", letterSpacing: "0.22em", textTransform: "uppercase" as const, fontSize: "0.72rem", fontWeight: 600 },
    fontImport: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap",
  },
  "festival-stage": {
    id: "festival-stage",
    name: "Festival Stage",
    emoji: "🎪",
    description: "Bold, joyful — Bebas Neue",
    panelBg: "transparent",
    cardBg: "#FFFFFF",
    cardBorder: "2px solid #1A0A35",
    cardRadius: "12px",
    cardShadow: "4px 4px 0 #1A0A35",
    titleFont: "'Bebas Neue', sans-serif",
    labelStyle: { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.12em", fontSize: "1.1rem" },
    fontImport: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
  },
  "wabi-sabi-studio": {
    id: "wabi-sabi-studio",
    name: "Wabi-Sabi Studio",
    emoji: "🎴",
    description: "Precise, editorial — Syne",
    panelBg: "transparent",
    cardBg: "#FFFFFF",
    cardBorder: "1px solid rgba(26,10,53,0.10)",
    cardRadius: "14px",
    cardShadow: "0 2px 16px rgba(26,10,53,0.05)",
    titleFont: "'Syne', sans-serif",
    labelStyle: { fontFamily: "'Syne', sans-serif", letterSpacing: "0.22em", textTransform: "uppercase" as const, fontSize: "0.68rem", fontWeight: 700 },
    fontImport: "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap",
  },
}
```

---

### Chunk 6.2 — `components/dashboard/CalendarWidget.tsx`

**Files**: Create `components/dashboard/CalendarWidget.tsx`

Fetches `/api/calendar/today`, caches 15 min in `localStorage`, renders today's events with a "now" marker. Accepts `theme` prop for styling. (See Block 6 success criteria for render requirements.)

---

### Chunk 6.3 — `components/dashboard/DharmaWidget.tsx`

**Files**: Create `components/dashboard/DharmaWidget.tsx`

Reads dharma cache from localStorage first; if stale/missing, calls `/api/dashboard/dharma?teacher=<id>`. Saves result to cache. Shows teacher selector dropdown (fetches `/api/dashboard/dharma/teachers` once, caches in component state). Calls `setDharmaTeacher()` on change.

---

### Chunk 6.4 — `components/dashboard/ManifestationWidget.tsx`

**Files**: Create `components/dashboard/ManifestationWidget.tsx`

Fetches `/api/dashboard/manifestation` on mount. Has two modes:
- **View mode**: Renders year intention + calling-in grid
- **Edit mode**: Text inputs for each field + "Upload journal photo" button (converts to base64, calls `/api/dashboard/manifestation/extract`, refreshes display)

---

### Chunk 6.5 — `components/dashboard/ThemeSelector.tsx`

**Files**: Create `components/dashboard/ThemeSelector.tsx`

Small dropdown/segmented control showing 3 theme options with emoji + name. Calls `setDashboardTheme()` on selection and triggers a re-render of the dashboard panel.

---

### Chunk 6.6 — `components/dashboard/DashboardPanel.tsx`

**Files**: Create `components/dashboard/DashboardPanel.tsx`

The wrapper component:
- Reads prefs on mount (`getDashboardPrefs()`)
- Renders ThemeSelector in the toggle bar
- Renders the 3 widgets in a 3-column grid
- Loads the theme's Google Font via `<link>` tag dynamically
- Collapse/expand with CSS transition (`max-height: 0` / `max-height: 1200px`)
- Saves `dashboardOpen` state to prefs on toggle

---

### Chunk 6.6b — `components/dashboard/BreathworkWidget.tsx`

**Files**: Create `components/dashboard/BreathworkWidget.tsx`

**What it does**: Pure client-side. No API, no data fetch. A circular SVG ring animates through the 4-7-8 cycle:
- **Inhale** 4s — ring fills clockwise, label says "Breathe in…"
- **Hold** 7s — ring stays full, pulses gently, label says "Hold…"
- **Exhale** 8s — ring drains, label says "Let go…"

State machine: `idle → inhale → hold → exhale → inhale → ...`  
Shows: cycle count ("Round 3 of 4"), total elapsed, Start / Pause / Reset buttons.  
Completes a session at 4 rounds (configurable). Plays a soft chime via the Web Audio API (no file needed — a short sine wave tone) at each phase transition.

**Key implementation notes**:
- Use `useEffect` + `setInterval` at 100ms tick for smooth progress
- The SVG ring: `stroke-dasharray` + `stroke-dashoffset` animated via inline style (CSS transitions handle the smoothness)
- Phase durations in seconds: `{ inhale: 4, hold: 7, exhale: 8 }` — exported as a constant so it's easy to change
- Web Audio chime: `new AudioContext()` → `oscillator.frequency.value = 528` (solfeggio Hz, feels right for this aesthetic) → 0.3s fade

```tsx
// Rough structure:
type Phase = "idle" | "inhale" | "hold" | "exhale"
const DURATIONS: Record<Exclude<Phase, "idle">, number> = { inhale: 4, hold: 7, exhale: 8 }
```

---

### Chunk 6.6c — `components/dashboard/InsightWidget.tsx`

**Files**: Create `components/dashboard/InsightWidget.tsx`

**What it does**: Shows two mini visualizations side by side — no charting library, pure CSS + SVG.

**Left: Inbox breakdown**
- Source: `emails` prop (passed down from Dashboard — it already has `category` on every email)
- Groups emails by `category`, calculates `%` of total
- Renders as a horizontal stacked bar (each segment a different fiesta color, matching the category's existing color)
- Below the bar: legend with category name + count + %
- Shows top 5 categories, groups the rest as "Other"

**Right: Calendar day breakdown**  
- Source: `calendarEvents` prop (from the CalendarWidget fetch, passed up via shared state or a context)
- Buckets events by type (heuristic: keywords in title → "Calls/Meetings", "Personal", "Creative", "Movement", "Other")
- Also computes "Free time %" = (total minutes in day − total booked minutes) / total day minutes
- Renders as a donut chart (SVG `<circle>` with `stroke-dasharray` segments) or same stacked bar style

**Header**: "Your day at a glance" with today's date

**Key implementation note**: Both visualizations use the existing fiesta palette CSS vars (`--rose`, `--gold`, `--orange`, `--teal`, `--lime`, `--purple`) so they feel native to all 3 themes.

```tsx
// Props:
interface InsightWidgetProps {
  emails: Email[]        // from Dashboard state — already available
  calendarEvents: CalendarEvent[]  // from CalendarWidget — lift state up
  theme: DashboardTheme
}
```

**Layout note**: This widget spans the full width of the dashboard grid (3 columns), placed below the 3-up row of Calendar + Dharma + Manifestation.

---

### Chunk 6.7 — Wire into `components/Dashboard.tsx`

**Files**: Modify `components/Dashboard.tsx` (insert after header, before legend bar)

```tsx
// Add import:
import DashboardPanel from "./dashboard/DashboardPanel"

// Add in JSX, after </header> and before the legend bar div:
<DashboardPanel />
```

**Step 5 — Commit**:
```bash
git add components/dashboard/
git commit -m "feat(dashboard): add DashboardPanel with CalendarWidget, DharmaWidget, ManifestationWidget, ThemeSelector"
```

---

## Technical Debt Strategy

| Debt | Description | Severity |
|---|---|---|
| No tests | Project has no test framework — all verification is `npm run build` + manual | Medium |
| Single-user manifestation file | `data/dashboard-content.json` is one file; multi-user would need per-user storage | Low (personal app) |
| Calendar re-auth | Adding Calendar scope requires one-time sign-out + sign-in from user | Info |
| Moon phase | Hardcoded string in content JSON — could integrate a lunar API (e.g. `farmsense.net`) | Low |
| Rate limiting | No rate limiting on `/api/dashboard/manifestation/extract` — could be abused if app is ever public | Low |

Add to `BUGS.md` after approval if not addressed immediately.

---

## Production & Design Standards

- **Timeout**: Calendar fetch — 10s. Dharma reflection (Claude) — 15s. Image extraction (Vision) — 30s.
- **Error Handling**: Every `catch` logs `console.error` + UI shows a graceful empty state (not a broken widget)
- **Loading states**: Each widget shows a skeleton loader (pulsing placeholder) while fetching
- **No new loading.tsx needed** — dashboard widgets are client components with their own loading state
- **Env vars needed**: None new — uses existing `ANTHROPIC_API_KEY` and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`

---

## Completion Checklist

- [ ] `/build` — execute plan
- [ ] `/audit` — verify all 3 themes render, toggle works, journal photo upload extracts correctly
- [ ] `/closeout` — document + push branch
