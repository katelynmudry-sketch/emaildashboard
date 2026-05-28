# Plan: Settings Panel + AI Chat Editor for Instructions

**Date:** 2026-05-27  
**Mockup:** `public/prototype_settings_panel.html` (approved)

---

## Header

**Goal:** Replace the "📋 AI Rules" button with a ⚙️ gear icon in the upper right, expand the settings panel to allow editing the full `CLINIC_CONTEXT` system prompt, and add a Claude-powered chat interface where the user describes changes in plain English and Claude suggests exact diffs for approval — working identically on localhost and Vercel.

**Architecture:** All settings (custom rules + system context) are stored in `localStorage` on the client and passed as fields in the request body on each categorize/propose call. The server stays completely stateless — no file writes, no database. `lib/claude.ts` is updated to accept settings from function parameters instead of reading from disk. This means the feature works on any hosting platform with no infrastructure changes.

**Design Patterns:** 
- **Stateless server / stateful client** — server reads context from request, client owns all state in localStorage  
- **Command pattern for chat editing** — user describes intent, API returns a `suggested` string, client presents approve/discard UI before committing
- **Dependency injection** — `categorizeInbox()` and `proposeCategories()` accept a `settings` param instead of reading globals

**Tech Stack:** Next.js App Router, TypeScript, Anthropic SDK (`claude-haiku-4-5`), React `useState`/`useEffect`, `localStorage` for persistence.

---

## Vercel Compatibility Guarantee

| What | Local | Vercel | Why it works |
|------|-------|--------|--------------|
| Custom rules | localStorage | localStorage | Browser-based, no server writes |
| CLINIC_CONTEXT edits | localStorage | localStorage | Same |
| Passed to Claude | Request body | Request body | Stateless API |
| `data/custom-context.json` | Seed/default only | Read-only (that's fine) | Never written at runtime |
| `data/categorization-rules.json` | File write | ⚠️ Read-only on Vercel | Existing limitation, out of scope |

> **Note:** `categorization-rules.json` (the "teach Claude" rules) has the same Vercel limitation as before this plan — that's a separate migration not in scope here.

---

## Conventions Observed

- API routes: `NextResponse.json()` with `try/catch` returning `{ error: string }`, status 500
- Auth: `const session = await auth()` guard at top of every POST route
- No toast library — errors handled via component state
- No test framework in codebase (flagged in Technical Debt)
- Components: inline styles + Tailwind utility classes, default exports
- Types: defined in `lib/types.ts`, imported as `import type { ... }`
- `lib/claude.ts`: sync-like pattern but uses async/await; `CLINIC_CONTEXT` already supports env var override

---

## Block 1 — Storage & API Layer (Stateless Settings)

Make the server accept settings from the request body instead of reading from disk.

**Success Criteria:**
- [ ] `categorizeInbox(emails, cats, account, settings?)` accepts optional settings param
- [ ] `POST /api/ai/categorize` passes `customContext` + `systemContext` from request body to Claude
- [ ] `GET /api/ai/context` returns current defaults (from file or env var) for the UI to seed from
- [ ] `data/custom-context.json` is only ever read (never written at runtime)

### Chunk 1.1 — `lib/settings-storage.ts` client utility
**Files:** Create `lib/settings-storage.ts`

```typescript
// lib/settings-storage.ts
const KEY = "inbox-ai:settings"

export interface InboxSettings {
  personalRules: string
  workRules: string
  systemContext: string  // overrides CLINIC_CONTEXT if non-empty
}

const DEFAULTS: InboxSettings = {
  personalRules: "",
  workRules: "",
  systemContext: "",
}

export function loadSettings(): InboxSettings {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch { return DEFAULTS }
}

export function saveSettings(s: Partial<InboxSettings>): InboxSettings {
  const current = loadSettings()
  const next = { ...current, ...s }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
```

**Commit:** `feat: add settings-storage localStorage utility`

---

### Chunk 1.2 — Update `lib/claude.ts` to accept settings param
**Files:** Modify `lib/claude.ts:L1-L40`, `L121-L135`, `L62-L68`

Remove the `loadCustomContext()` file-read function added earlier. Add a `settings` parameter to `categorizeInbox` and `proposeCategories`.

```typescript
// New signature:
export async function categorizeInbox(
  emails: RawEmail[],
  categories: Category[],
  account: string,
  settings?: { customContext?: string; systemContext?: string }
): Promise<Email[]>

// Inside the function:
const effectiveSystemContext = settings?.systemContext?.trim() 
  ? settings.systemContext.trim() 
  : CLINIC_CONTEXT

const customContextSection = settings?.customContext?.trim()
  ? `\n## Custom instructions for this account\n${settings.customContext.trim()}`
  : ""

// Use effectiveSystemContext for system param, customContextSection in prompt
```

Same pattern for `proposeCategories`.

**Commit:** `refactor: claude functions accept settings param instead of reading file`

---

### Chunk 1.3 — Update `POST /api/ai/categorize` and `POST /api/ai/propose`
**Files:** Modify `app/api/ai/categorize/route.ts`, `app/api/ai/propose/route.ts`

```typescript
// categorize/route.ts
const { emails, categories, account, customContext, systemContext }: 
  CategorizeRequest & { customContext?: string; systemContext?: string } = await request.json()

const result = await categorizeInbox(emails, categories, account, {
  customContext,
  systemContext,
})
```

**Commit:** `feat: categorize and propose routes accept settings from request body`

---

### Chunk 1.4 — Update `Dashboard.tsx` to pass settings with API calls
**Files:** Modify `components/Dashboard.tsx` — the `loadInbox()` and `runCategorization()` functions

```typescript
// In loadInbox(), before the categorize fetch:
import { loadSettings } from "@/lib/settings-storage"

// In runCategorization():
const settings = loadSettings()
const isWork = activeAccount === "work"
body: JSON.stringify({
  emails: emailsForApi,
  categories: cats,
  account: activeAccountConfig.email,
  customContext: isWork ? settings.workRules : settings.personalRules,
  systemContext: settings.systemContext || undefined,
})
```

**Commit:** `feat: dashboard passes localStorage settings with each categorize request`

---

## Block 2 — Settings Gear Button (UI Repositioning)

**Success Criteria:**
- [ ] "📋 AI Rules" button replaced with a ⚙️ gear icon (38×38px, purple accent)
- [ ] Positioned in the top-right action cluster, after Refresh button
- [ ] Existing `InstructionsPanel` still opens correctly

### Chunk 2.1 — Move and restyle the settings button
**Files:** Modify `components/Dashboard.tsx` — the button in the right header cluster

Replace the current `📋 AI Rules` button with:
```tsx
<button
  type="button"
  onClick={() => setInstructionsOpen(true)}
  title="Settings & AI Instructions"
  style={{
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    border: "1px solid rgba(139,63,216,0.30)",
    background: "rgba(139,63,216,0.08)",
    color: "#8B3FD8", fontSize: "1.1rem",
    cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center",
  }}
>
  ⚙️
</button>
```

**Commit:** `feat: replace AI Rules text button with gear icon in upper right`

---

## Block 3 — Full Context Editing Tab

Allow the user to read and edit the full `CLINIC_CONTEXT` system prompt directly.

**Success Criteria:**
- [ ] "🧠 AI Context" tab shows full current `CLINIC_CONTEXT` (seeded from API, overridable)
- [ ] Edits saved to `localStorage` as `settings.systemContext`
- [ ] "Reset to default" button clears the override
- [ ] Save confirmation appears for 2.5 seconds

### Chunk 3.1 — Seed system context from API on panel open
**Files:** Modify `components/InstructionsPanel.tsx`

On `open`, the panel already calls `GET /api/ai/context`. Extend the effect to seed `systemContext` in localStorage only if the user hasn't already set a custom one:

```typescript
useEffect(() => {
  if (!open) return
  fetch("/api/ai/context").then(r => r.json()).then((d: ContextData) => {
    setData(d)
    const stored = loadSettings()
    // Seed textarea with stored override, fallback to server default
    setSystemContextText(stored.systemContext || d.systemContext)
    setPersonalText(stored.personalRules || d.custom.personal)
    setWorkText(stored.workRules || d.custom.work)
  })
}, [open])
```

### Chunk 3.2 — "AI Context" tab with editable textarea
**Files:** Modify `components/InstructionsPanel.tsx` — add tab and content

New tab content:
```tsx
{tab === "context" && (
  <div className="flex flex-col gap-4">
    <p className="hint">
      The full system prompt Claude receives — controls tone, summary style, and group logic.
      Your edits are saved in the browser and override the default on every refresh.
    </p>
    <label style={SECTION_LABEL_STYLE}>System prompt</label>
    <textarea
      value={systemContextText}
      onChange={e => setSystemContextText(e.target.value)}
      rows={14}
      style={TEXTAREA_STYLE}
    />
    <div className="flex items-center gap-3 flex-wrap">
      <button onClick={handleSaveContext} style={BTN_PRIMARY_STYLE}>
        Save Context
      </button>
      <button onClick={handleResetContext} style={BTN_GHOST_STYLE}>
        Reset to default
      </button>
      {saveOk === "context" && <span style={SAVE_OK_STYLE}>✓ Saved!</span>}
    </div>
  </div>
)}
```

**Commit:** `feat: add editable CLINIC_CONTEXT tab to settings panel`

---

## Block 4 — Claude Chat Editor

**Success Criteria:**
- [ ] "💬 Chat Editor" tab shows a mini chat UI
- [ ] User types a plain-English request (e.g. "always flag Dr. Aishwarya as urgent")
- [ ] `POST /api/ai/edit-context` returns a `suggested` string + which `section` was changed
- [ ] UI shows a diff card with **Apply** / **Discard** buttons
- [ ] Apply saves to `localStorage` immediately; Discard does nothing

### Chunk 4.1 — `POST /api/ai/edit-context` endpoint
**Files:** Create `app/api/ai/edit-context/route.ts`

```typescript
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.access_token && !session?.work_access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { userRequest, currentPersonal, currentWork, currentSystemContext } = await request.json()
  
  const prompt = `The user manages an AI email triage app. They have these current instructions:

SYSTEM CONTEXT:
${currentSystemContext}

PERSONAL ACCOUNT RULES:
${currentPersonal || "(none)"}

WORK ACCOUNT RULES:
${currentWork || "(none)"}

The user wants to make this change: "${userRequest}"

Determine which section(s) to update (systemContext, personalRules, and/or workRules).
Return a JSON object:
{
  "explanation": "one sentence describing what you changed",
  "changes": [
    { "section": "personalRules" | "workRules" | "systemContext", "newText": "full updated text for that section" }
  ]
}
Return ONLY valid JSON.`

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })
  // parse + return
}
```

**Commit:** `feat: add /api/ai/edit-context endpoint`

---

### Chunk 4.2 — Chat UI in `InstructionsPanel.tsx`
**Files:** Modify `components/InstructionsPanel.tsx`

State additions:
```typescript
type ChatMsg = { role: "user" | "claude"; text: string; changes?: Change[] }
type Change = { section: "personalRules" | "workRules" | "systemContext"; newText: string; applied: boolean }
const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
const [chatInput, setChatInput] = useState("")
const [chatLoading, setChatLoading] = useState(false)
```

`sendChatMessage()` function:
1. Append user message
2. Show typing indicator
3. POST to `/api/ai/edit-context` with current texts
4. Append Claude response with `changes` array
5. Each change rendered as a diff card with Apply/Discard

Apply handler saves the `newText` for that `section` to localStorage and updates the corresponding textarea.

**Commit:** `feat: add chat editor tab with diff apply/discard UI`

---

### Chunk 4.3 — Wire chat state to textarea state (two-way sync)
**Files:** Modify `components/InstructionsPanel.tsx`

When Apply is clicked in chat:
```typescript
function applyChange(change: Change) {
  if (change.section === "personalRules") setPersonalText(change.newText)
  if (change.section === "workRules") setWorkText(change.newText)
  if (change.section === "systemContext") setSystemContextText(change.newText)
  saveSettings({ [change.section]: change.newText })
}
```

This means the "Custom Rules" and "AI Context" tabs immediately reflect the applied change.

**Commit:** `feat: applying chat suggestions updates textarea state + localStorage`

---

## Block 5 — Full Prompt Read-Only Tab

**Success Criteria:**
- [ ] "📋 Full Prompt" tab shows assembled prompt (system context + custom rules + placeholder for email list)
- [ ] Clearly labeled sections so user can see exactly what Claude receives

### Chunk 5.1 — Assembled prompt preview
**Files:** Modify `components/InstructionsPanel.tsx`

```tsx
{tab === "raw" && (
  <pre style={CODE_STYLE}>
    {[
      "[SYSTEM]\n" + (systemContextText || data.systemContext),
      customRulesSection ? "[CUSTOM RULES]\n" + customRulesSection : null,
      "[CATEGORIZE INSTRUCTIONS]\n" + data.categorizeInstructions,
      "\n[EMAIL LIST]\n<your emails are appended here at runtime>",
    ].filter(Boolean).join("\n\n---\n\n")}
  </pre>
)}
```

**Commit:** `feat: full prompt preview tab assembles live context`

---

## Technical Debt

| Item | Impact | Where |
|------|--------|-------|
| No test framework | High — no automated verification | Whole codebase |
| `categorization-rules.json` file writes fail silently on Vercel | Medium — "Teach Claude" rules don't persist on Vercel | `lib/rules.ts` |
| `loadCustomContext()` added to `lib/claude.ts` earlier this session reads from file | Must remove in Chunk 1.2 | `lib/claude.ts:L14-L28` |
| `app/api/ai/context/route.ts` POST writes to file | Must remove/no-op in Block 1 | `app/api/ai/context/route.ts` |

---

## Production & Design Standards

**Timeouts:**
- `POST /api/ai/edit-context` — AI call, set `max_tokens: 1024`, Haiku is fast (~2-4s). No explicit timeout needed; panel has a loading state.
- `GET /api/ai/context` — simple file read, <100ms.

**Error Handling:**
- All `fetch` calls in panel wrapped in `try/catch`
- On error: set an `error` state string shown inline in red below the relevant section (no toast library in codebase)
- Claude edit endpoint: returns `{ error: string }` on failure, shown as a Claude "error" bubble in chat

**Loading States:**
- Panel body shows "Loading…" spinner while `GET /api/ai/context` resolves
- Chat send button disabled + "Thinking…" text while waiting for edit-context response
- Typing indicator (three animated dots) in chat history while Claude responds

**Design (matches festival aesthetic):**
- Panel header: `linear-gradient(135deg, #8B3FD8 0%, #FF1F6E 100%)` (purple→magenta, distinguishes it from email content)
- Active tab underline: `#8B3FD8`
- Diff cards: teal border + green added text, magenta removed text
- Apply button: teal (`#00C4A7`)
- All `font-family: var(--font-body)` for readability in text areas
- Section labels: uppercase, 0.72rem, color-coded per account type

---

## File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `lib/settings-storage.ts` | **Create** | localStorage helpers |
| `app/api/ai/edit-context/route.ts` | **Create** | Claude chat editing endpoint |
| `lib/claude.ts` | **Modify** | Accept settings param, remove file read |
| `app/api/ai/categorize/route.ts` | **Modify** | Pass settings to `categorizeInbox` |
| `app/api/ai/propose/route.ts` | **Modify** | Pass settings to `proposeCategories` |
| `app/api/ai/context/route.ts` | **Modify** | Remove file write from POST |
| `components/InstructionsPanel.tsx` | **Rewrite** | 4 tabs + chat editor + localStorage |
| `components/Dashboard.tsx` | **Modify** | Gear button, pass settings in API calls |

---

Ready to build? Use `/build`.
