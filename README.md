# inbox-ai (Email Party)

An AI-powered Gmail triage dashboard that reads your inbox, categorizes your emails, flags priorities, summarizes long threads, and drafts replies — all tuned to how *you* actually communicate. Wrapped in a gamified, choose-your-vibe interface that makes sorting your inbox feel less like a chore.

Built with Next.js, Gmail OAuth, and the Claude API. Settings live in your browser's localStorage — the server is stateless, so it runs identically on localhost or Vercel with no database.

---

## What it does

- **Categorizes your inbox** — Claude proposes labels based on your actual email patterns, then sorts everything into them
- **Flags priority** — urgent, needs action today, or just FYI
- **Micro-summaries** — 2–3 word phrase on every row so you can scan at a glance
- **Full summaries** — only on long emails or promotions, never on short messages
- **Draft replies** — AI-written in your voice, ready to edit and send, with inline editing and "continue writing" support
- **Deletable flagging** — surfaces emails that are safe to delete (expired OTPs, delivered packages, old login alerts, past calendar invites)
- **Unread/archived filters & sort order** — show unread-only or everything, inbox-only or archived too, newest-first or oldest-first
- **Bulk actions & hover actions** — archive, mark read, unsubscribe, and multi-select straight from the list
- **TODO flagging** — pin emails to a running TODO list, with optional export to a Google Doc (separate doc per account)
- **Snooze** — hide an email until a later date, then have it resurface
- **Inline image previews** — attachment thumbnails and large inline images load on demand
- **Daily Briefing & morning dashboard** — a separate "start your day" view with widgets (manifestation/intentions, calendar, plant/garden growth tied to inbox-zero progress)
- **Karma/XP system** — clearing your inbox earns points, with a roast/hype API that reacts to your progress
- **Action log** — a drawer showing a running log of every action taken (archived, replied, deleted, etc.) plus a sent-mail log

---

## Multi-account support

- Sign in with a personal Gmail account, then use **"Connect second Gmail"** to link a second ("work") account
- Each account gets its own AI-proposed categories, Gmail labels, save folders, and (optionally) its own TODO export doc
- A pill toggle in the header switches the whole dashboard between accounts

---

## The 3-theme system

Pick a vibe on first run (or switch anytime) — every part of the UI, including AI-generated copy and tone, adapts:

- 🎉 **Party** — loud, celebratory, gamified. The inbox is a game you're winning.
- 🧘 **Zen** — calm, poetic, contemplative. No pressure, just presence.
- ☕ **Basic AF** — warm latte/PSL energy. Excited about everything, specific about nothing.

---

## First-run onboarding

New users get a guided wizard: pick a vibe, connect account(s), set inbox display preferences, optionally add AI rules + an "About You" reference doc, and preview exactly what gets sent to Claude. Every step is skippable with sensible defaults, and you can re-run the wizard anytime from Settings.

---

## Settings

A slide-out panel with 5 tabs:

- **📥 Inbox Display** — unread/archived filters, sort order, batch size
- **✏️ AI Rules** — per-account custom rules, AI action toggles (past-event cleanup, delivery-chain cleanup), and an "About You" doc (paste or upload `.txt`/`.md`) that's included in every AI prompt
- **🧠 AI System Prompt** — edit the underlying system prompt directly, or chat with Claude to refine it
- **📋 Full Prompt** — see exactly what's sent to Claude for categorization and for draft replies, per account
- **🔗 Accounts & Storage** — connect a second Gmail account, set per-account save folders and TODO export docs

---

## Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [NextAuth v5](https://authjs.dev) — Gmail OAuth (supports two linked accounts)
- [Claude API](https://anthropic.com) (claude-haiku-4-5) — categorization, summaries, draft replies
- [Tailwind CSS v4](https://tailwindcss.com)
- Gmail API + Google Docs API via [googleapis](https://github.com/googleapis/google-api-nodejs-client)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/your-username/inbox-ai.git
cd inbox-ai
npm install
```

### 2. Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Enable **Gmail API**
3. Credentials → Create → **OAuth 2.0 Client ID** → Web application
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy the client ID and secret

### 3. Get a Claude API key

Sign up at [console.anthropic.com](https://console.anthropic.com) and create an API key.

### 4. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=          # generate with: openssl rand -base64 32

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

ANTHROPIC_API_KEY=
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Gmail, and follow the onboarding wizard.

---

## How the AI works

On first use, Claude reads your inbox and proposes categories based on your actual email patterns. You can accept them as-is or tweak. It then categorizes everything, flags priorities, and writes micro-summaries — all in a single API call per inbox load.

You can tune how the AI behaves three ways, all from the **Settings** panel (no redeploy needed):

- **System prompt** — write your own from scratch, upload a `.txt`/`.md` file, or edit it via chat. Empty by default (a generic prompt is used) — nothing personal is shared between accounts.
- **Per-account rules** — free-text instructions specific to your personal vs. work inbox (tone, signoff, what counts as urgent, etc.)
- **About You** — a reference doc (paste or upload `.txt`/`.md`) describing who you are, included in every prompt

The "Full Prompt" tab shows exactly what gets sent to Claude for categorization and for draft replies, so there's no guessing. Everything is stored in your own browser and sent only with your own requests.

---

## Free tier / API costs

Using the Claude API costs roughly **$0.05–0.50 per inbox sort** depending on how many emails you have. At typical usage, most people spend under $2/month on their own API key.

---

## Roadmap

- [ ] BYOK in-app (paste your Anthropic key in settings, no env var needed)
- [ ] Free tier (1 sort/week) for users without an API key
- [ ] "Learn from sent mail" — AI reads your writing style and adapts

---

## License

MIT
