# inbox-ai

An AI-powered Gmail triage app that reads your inbox, categorizes your emails, flags priorities, summarizes long threads, and drafts replies — all tuned to how *you* actually communicate.

Built with Next.js, Gmail OAuth, and the Claude API.

---

## What it does

- **Categorizes your inbox** — Claude proposes labels based on your actual email patterns, then sorts everything into them
- **Flags priority** — urgent, needs action today, or just FYI
- **Micro-summaries** — 2–3 word phrase on every row so you can scan at a glance
- **Full summaries** — only on long emails or promotions, never on short messages
- **Draft replies** — AI-written in your voice, ready to edit and send
- **Deletable flagging** — surfaces emails that are safe to delete (expired OTPs, delivered packages, old login alerts)

---

## Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [NextAuth v5](https://authjs.dev) — Gmail OAuth
- [Claude API](https://anthropic.com) (claude-sonnet-4-6) — categorization, summaries, draft replies
- [Tailwind CSS v4](https://tailwindcss.com)
- Gmail API via [googleapis](https://github.com/googleapis/google-api-nodejs-client)

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

**Optional — personalize the AI for your own inbox:**

```env
# Your personal system prompt for the AI (use \n for line breaks)
# If blank, a generic prompt is used. Can also be overridden per-session in Settings.
CLINIC_CONTEXT=You are an AI assistant helping [your name] triage their email...
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Gmail, and let Claude sort your inbox.

---

## How the AI works

On first use, Claude reads your inbox and proposes 6 categories based on your actual email patterns. You can accept them as-is or tweak. It then categorizes everything, flags priorities, and writes micro-summaries — all in a single API call per inbox load.

You can tune how the AI behaves by setting `CLINIC_CONTEXT` to a description of yourself, your role, and how you like to write. The more specific you are, the better the draft replies.

---

## Free tier / API costs

Using the Claude API costs roughly **$0.05–0.50 per inbox sort** depending on how many emails you have. At typical usage, most people spend under $2/month on their own API key.

---

## Roadmap

- [ ] Multi-user onboarding (persona setup for any Gmail account)
- [ ] BYOK in-app (paste your Anthropic key in settings, no env var needed)
- [ ] Free tier (1 sort/week) for users without an API key
- [ ] "Learn from sent mail" — AI reads your writing style and adapts
- [ ] True multi-account Gmail support

---

## License

MIT
