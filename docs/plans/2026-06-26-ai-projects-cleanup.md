# AI Projects Folder Cleanup Plan
**Date:** 2026-06-26

---

## Goal
Audit every folder in `Documents/AI projects`, identify what's active vs. dead, stop the unexpected Gmail cron job if needed, and safely delete everything that isn't inbox-ai.

## Architecture
This is a housekeeping plan, not a code plan. Each block is a decision + action sequence. Nothing here touches inbox-ai's code.

---

## The Cron Job (Already Found)

**What it is:** Google Cloud Run job (`morning-briefing`) triggered by Cloud Scheduler (`morning-briefing-schedule`) at 7:00am Mountain Time, Mon–Fri.
**What it does:** Scans `drkmudry@gmail.com`, drafts AI replies to patient emails, forwards admin/Interac emails to desk, sends a summary.
**GCP project:** `morning-email-492118`, region `us-central1`
**Local files:** `Documents/AI projects/Morning email/`

> ⚠️ Deleting the local folder will NOT stop the job. The scheduler lives in Google Cloud and will keep firing. You must disable it in GCP (see Block 1).

**Decision needed:** Do you want to keep this running for Dr. K, or turn it off?

---

## Block 1 — Morning Briefing: Keep or Kill?

### Option A — Keep it running (no action needed)
The local files are just the source code. The cloud job runs independently. You can safely delete the local `Morning email` folder if you want to reclaim space — the job will still run from the deployed container image in GCP.

### Option B — Turn it off
Run these commands in Google Cloud Shell (console.cloud.google.com → >_ icon):

```bash
# Pause the schedule (safest — can re-enable later)
gcloud scheduler jobs pause morning-briefing-schedule --location us-central1

# OR delete permanently (can't undo easily)
gcloud scheduler jobs delete morning-briefing-schedule --location us-central1
gcloud run jobs delete morning-briefing --region us-central1
```

Then delete the local folder.

**Success Criteria:**
- [ ] Decision made: keep or kill
- [ ] If killing: scheduler job deleted/paused in GCP before local folder is deleted
- [ ] Local `Morning email` folder deleted (either way, if not needed locally)

---

## Block 2 — Safe-to-Delete Files (No Cloud Dependencies)

These are standalone files with no live services attached. Safe to delete immediately.

| Item | What it is | Action |
|------|-----------|--------|
| `Email App/` | Folder with one design plan doc (`2026-05-08-inbox-ai-design.md`) — early planning for inbox-ai | Delete |
| `buildtips.md` | Personal build notes file | Delete (or move to inbox-ai if still useful) |
| `email claude ui artifact.txt` | Old Claude UI export | Delete |
| `expense-tracker.html` | Standalone HTML tool | Delete (or keep if you use it) |

**Success Criteria:**
- [ ] `Email App/` deleted
- [ ] `buildtips.md` reviewed and deleted or kept
- [ ] `email claude ui artifact.txt` deleted
- [ ] `expense-tracker.html` deleted or kept

---

## Block 3 — Investigate Before Deleting

These two have live or potentially live deployments. Verify before deleting.

### `zoryawebsite/`
**What it is:** Static HTML/CSS website for Zorya (astrology/wellness brand). Has a `CLAUDE.md` with a Netlify branch workflow (`preview` → `main`), meaning it's likely deployed live on Netlify.

**Before deleting:** Check if the Netlify site is still live and if you want to keep it. Deleting the local folder won't take the Netlify site down — the site is hosted from Netlify's servers, not your computer.

**Action options:**
- If Zorya site is still active and you want to keep editing it → keep the local folder, or move it to a better location
- If Zorya site is dead or you don't need to edit it → safe to delete the local folder (site stays up on Netlify independently)

**Success Criteria:**
- [ ] Check if zoryawebsite is live on Netlify
- [ ] Decision made: keep local folder or delete it

---

### `refillform/`
**What it is:** A Next.js app with Supabase. Based on the name, likely a prescription refill request form for the clinic. No description beyond the default Next.js README — unclear if it's deployed anywhere.

**Before deleting:** Check if this is deployed (Vercel, Netlify, etc.) and if anyone is actively using it at the clinic.

**Action options:**
- If deployed and in active use → keep the local folder
- If never finished or not deployed → safe to delete

**Success Criteria:**
- [ ] Check if refillform is deployed somewhere
- [ ] Ask Dr. K (or check clinic workflow) if a refill form is in active use
- [ ] Decision made: keep or delete

---

## Block 4 — Keep

| Item | Status |
|------|--------|
| `inbox-ai/` | **Keep** — this is the active Email Party app |

No action needed here.

---

## Cleanup Order

1. Block 1 first — make the GCP decision before touching Morning email folder
2. Block 2 — delete the safe files immediately  
3. Block 3 — investigate zoryawebsite and refillform, then decide
4. Block 4 — leave inbox-ai alone

---

## Questions That Need Your Answers

1. **Morning Briefing** — Do you want it to keep running for Dr. K, or turn it off?
2. **zoryawebsite** — Is the Zorya website still live/active on Netlify?
3. **refillform** — Is a prescription refill form deployed and in use at the clinic?
