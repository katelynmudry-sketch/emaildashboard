# Inbox AI — Setup Guide

The app is now running at `http://localhost:3000` but needs OAuth credentials to work.

## Step 1: Get Google OAuth Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select or create project `morning-email-492118`
3. Go to **APIs & Services > Credentials**
4. Click **+ Create Credentials > OAuth client ID**
5. Choose **Web application**
6. Under "Authorized redirect URIs", add:
   - `http://localhost:3000/api/auth/callback/google`
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

## Step 2: Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Click your account → **API keys**
3. Create a new key
4. Copy it

## Step 3: Set Up .env.local

In the `inbox-ai` directory, create a file called `.env.local` (copy from `.env.example`):

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
GOOGLE_CLIENT_ID=<your Client ID from step 1>
GOOGLE_CLIENT_SECRET=<your Client Secret from step 1>
ANTHROPIC_API_KEY=<your API key from step 2>
```

To generate `NEXTAUTH_SECRET`, run in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Copy the output and paste it as the value.

## Step 4: Restart the Dev Server

After creating `.env.local`, the dev server will hot-reload automatically. If not:
```bash
cd "C:\Users\Katelyn\Documents\AI projects\inbox-ai"
npm run dev
```

## Step 5: Test It

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Sign in with Google"
3. Select `katelynmudry@gmail.com`
4. Click "Load inbox"
5. Wait for Claude to analyze your emails and propose 6 categories
6. Confirm, and the grid should populate with your triaged inbox

---

## Troubleshooting

**"Unauthorized" on /api/gmail/messages**
- Make sure Gmail API is enabled in your GCP project
- Go to console.cloud.google.com > APIs & Services > Enable APIs & Services
- Search for "Gmail API" and enable it

**"Invalid client" on OAuth**
- Double-check Client ID and Client Secret are copied exactly
- Make sure you created a **Web application** type client, not Desktop

**"RefreshTokenError" after a few minutes**
- This means the OAuth redirect URI was accepted, but token refresh is failing
- Check that `prompt: "consent"` is in `lib/auth.ts` (it is)
- Try signing out and signing in again

**Categories not showing**
- Wait 10-15 seconds — Claude is analyzing your inbox
- Check your browser console (F12) for any JS errors
- Check terminal for any server errors

---

## What Happens Next

1. **First load**: Claude proposes 6 categories based on your inbox patterns
2. **You confirm**: Names can be edited, then click confirm
3. **Gmail labels created**: The app creates those 6 labels in your Gmail account
4. **Categorization**: Claude assigns each email to a category and applies the label
5. **Grid appears**: Your emails show up in a 2×3 grid by category
6. **Triage**: Click emails, archive, save drafts, mark read — all sync to Gmail in real-time

---

## Second Account (Work Email)

Once personal works, add your work account:
1. Top of the screen, click the pill toggle to switch accounts
2. If categories don't exist yet, the flow repeats — Claude proposes new categories just for your work inbox
3. Each account has independent categories stored in localStorage
4. Gmail labels are created separately for each account

---

## Deployment to Vercel (Later)

When ready to make it public:

```bash
git push origin main
# Go to vercel.com > New Project > Select repo > Deploy
```

In Vercel dashboard:
- Add environment variables (same as .env.local, but change `NEXTAUTH_URL` to your Vercel URL)
- Add your Vercel URL to Google Console OAuth redirect URIs

No code changes needed — same codebase.

---

Happy triaging! 🚀
