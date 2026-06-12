# Header Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Dashboard header into the two-row layout shown in `docs/plans/header-mockup.html` (logo+wordmark+AccountToggle left / utility links+mode pills right in Row A; stats+batch/refresh in Row B; new Compose/Roast+TODO row below), and fix the Party mode pill's invisible active-state text.

**Architecture:** This is a layout-only JSX reorganization inside `components/Dashboard.tsx`. No new components, no new state, no new styles — every relocated element keeps its exact current mode-conditional styling and copy. The entire header block (`<header>...</header>`, currently lines 1138–1500) is replaced with a restructured version built from the same JSX fragments in new positions. One single-line style fix is included (Party pill active text color).

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind utility classes + inline style objects, existing `PartyMode` theme system.

---

## Spec reference

Full design rationale: `docs/superpowers/specs/2026-06-11-header-restructure-design.md` (will be deleted after this plan is implemented, per user request — see Task 2).

## File Structure

- Modify: `components/Dashboard.tsx:1138-1500` — the entire `<header>` block is replaced in place. No other files change.

---

### Task 1: Restructure the header block

**Files:**
- Modify: `c:\Users\Katelyn\Documents\AI projects\inbox-ai\components\Dashboard.tsx` (lines 1138–1500)

- [ ] **Step 1: Replace the entire header block**

Replace lines 1138–1500 (from `{/* ══════════════════ HEADER ══════════════════════════════════════════ */}` through `{/* end Row B + roast + TODO widget */}` and the closing `</header>`) with the following. This preserves every existing element's mode-conditional styles/copy verbatim, only repositioning them and fixing the Party pill text color (see the `color:` line inside the mode-pill map — now `isActive && m.id === "party" ? "#FFFFFF" : m.accentHex`).

```tsx
        {/* ══════════════════ HEADER ══════════════════════════════════════════ */}
        <header style={{ padding: "24px 28px 20px", borderBottom: "1px solid rgba(26,10,53,0.08)" }}>

          {/* ── Row A: two columns — left: logo/wordmark/AccountToggle, right: utility links + mode pills ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">

            {/* Left column: logo icon + wordmark + subtitle + AccountToggle */}
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-4">
                <div style={{
                  width: 52, height: 52, flexShrink: 0,
                  borderRadius: 14,
                  background: mode === "zen"
                    ? "linear-gradient(135deg, #C8960C 0%, #B07B0A 100%)"
                    : mode === "wabi-sabi"
                      ? "transparent"
                      : "linear-gradient(135deg, #FF1F6E 0%, #FF6B1A 100%)",
                  border: mode === "wabi-sabi" ? "2px solid #111" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26,
                  boxShadow: mode === "zen"
                    ? "0 8px 32px rgba(200,150,12,0.30)"
                    : mode === "wabi-sabi"
                      ? "none"
                      : "0 8px 32px rgba(255,31,110,0.38)",
                  transition: "all 0.3s ease",
                }}>
                  ✉️
                </div>
                <div>
                  <h1 style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2rem, 5vw, 3.2rem)",
                    lineHeight: 1,
                    color: mode === "zen" ? "#3D2800" : "#1A0A35",
                    margin: 0,
                    transition: "color 0.3s ease",
                  }}>
                    EMAIL PARTY
                  </h1>
                  <p style={{
                    fontSize: "0.78rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: mode === "zen" ? "rgba(61,40,0,0.40)" : "rgba(26,10,53,0.35)",
                    margin: "5px 0 0",
                    transition: "color 0.3s ease",
                  }}>
                    {mode === "zen" ? "Your Mindful Inbox" : mode === "wabi-sabi" ? "ur inbox bestie" : "Your AI-Powered Inbox"}
                  </p>
                </div>
              </div>
              <AccountToggle active={activeAccount} onChange={handleAccountSwitch} loading={isLoading} />
            </div>

            {/* Right column: utility links (top) + mode pills (bottom), right-aligned */}
            <div className="flex flex-col items-end gap-2.5">

              {/* Utility buttons — quiet text links */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSentDrawerOpen(true)}
                  style={{ fontSize: "0.70rem", fontWeight: 500, opacity: 0.55, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                >
                  Sent
                </button>
                <button
                  type="button"
                  onClick={() => setLogDrawerOpen(true)}
                  style={{ fontSize: "0.70rem", fontWeight: 500, opacity: 0.55, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                >
                  Log
                </button>
                <div style={{ width: 1, height: 16, background: "rgba(26,10,53,0.14)", margin: "0 2px" }} />
                <button
                  type="button"
                  onClick={() => setInstructionsOpen(true)}
                  style={{ fontSize: "0.70rem", fontWeight: 500, opacity: 0.55, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => signOut({ redirectTo: "/" })}
                  style={{ fontSize: "0.70rem", fontWeight: 500, opacity: 0.55, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                >
                  Sign out
                </button>
              </div>

              {/* 3-way mode pills — text only, no emojis */}
              <div className="flex items-center gap-2">
                {([
                  { id: "party",     label: "Party",    activeBg: "#FF1F6E", accentHex: "#FF1F6E" },
                  { id: "wabi-sabi", label: "Basic AF", activeBg: "transparent", accentHex: "#111" },
                  { id: "zen",       label: "Zen",      activeBg: "#C8960C", accentHex: "#C8960C" },
                ] as { id: PartyMode; label: string; activeBg: string; accentHex: string }[]).map(m => {
                  const isActive = mode === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setPartyMode(m.id); setMode(m.id); setRoast(null) }}
                      style={{
                        padding: "7px 16px", borderRadius: 999, cursor: "pointer",
                        border: isActive
                          ? (m.id === "party" ? `1.5px solid ${m.activeBg}` : `1.5px solid ${m.accentHex}55`)
                          : `1px solid ${m.accentHex}44`,
                        background: isActive
                          ? (m.id === "party" ? m.activeBg : "#FFFFFF")
                          : "transparent",
                        color: isActive && m.id === "party" ? "#FFFFFF" : m.accentHex,
                        fontSize: "0.82rem", fontWeight: isActive ? 700 : 500,
                        letterSpacing: "0.04em",
                        transition: "all 0.18s ease",
                        opacity: isActive ? 1 : 0.6,
                        boxShadow: isActive
                          ? (m.id === "party" ? `0 2px 12px ${m.activeBg}33` : "0 1px 4px rgba(0,0,0,0.08)")
                          : "none",
                      }}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          {/* end Row A */}

          {/* ── Row B: stats row — left: Plant/Tally/MiniStats, right: batch picker + Refresh (+ Connect work Gmail) ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap mt-5">

            {/* Left cluster */}
            <div className="flex items-center gap-4 flex-wrap">
              <PlantHeader
                remaining={emails.length}
                total={totalUnreadInbox}
                mode={mode}
              />
              <TallyTicket loaded={emails.length} total={totalUnreadInbox} mode={mode} />
              <div className="flex items-stretch gap-1">
                <MiniStat value={urgentCount} label="urgent" color={mode === "party" ? "#FF1F6E" : themeAccent} mode={mode} />
                <MiniStat value={todayCount}  label="today"  color={mode === "party" ? "#FFD000" : themeAccent} mode={mode} />
                <MiniStat value={fyiCount}    label="fyi"    color={mode === "party" ? "#00E5C4" : themeAccent} mode={mode} />
              </div>
            </div>

            {/* Right cluster: batch picker + Refresh (+ Connect work Gmail) */}
            <div className="flex items-start gap-3 flex-wrap">

              {/* Batch picker + Refresh */}
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-0.5">
                  <span style={{ fontSize: "0.70rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(26,10,53,0.56)" }}>
                    per refresh
                  </span>
                  <div className="flex rounded-full p-0.5" style={{ border: "1px solid rgba(26,10,53,0.10)", background: "rgba(26,10,53,0.03)" }}>
                    {IMPORT_BATCH_OPTIONS.map(n => (
                      <button
                        key={n}
                        type="button"
                        disabled={isLoading}
                        onClick={() => updateImportBatchSize(n)}
                        className="min-w-9 px-2 py-1 rounded-full transition-colors disabled:opacity-40"
                        style={{
                          background: mode === "wabi-sabi" ? "transparent" : (importBatchSize === n ? themeAccent : "transparent"),
                          color: mode === "wabi-sabi"
                            ? (importBatchSize === n ? "#111" : "rgba(17,17,17,0.38)")
                            : (importBatchSize === n ? (mode === "zen" ? "#3D2800" : "#1A0A35") : "rgba(26,10,53,0.42)"),
                          fontSize: "0.84rem",
                          fontWeight: mode === "wabi-sabi" && importBatchSize === n ? 800 : 600,
                          border: mode === "wabi-sabi" && importBatchSize === n ? "1.5px solid #111" : "none",
                          cursor: "pointer",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={loadInbox}
                  disabled={isLoading}
                  style={{
                    padding: "6px 18px", borderRadius: 999,
                    background: isLoading
                      ? (mode === "zen" ? "rgba(200,150,12,0.30)" : "rgba(255,31,110,0.3)")
                      : (mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "transparent" : "#FF1F6E"),
                    color: mode === "zen" ? "#FFF8E0" : mode === "wabi-sabi" ? "#111" : "#1A0A35",
                    fontSize: "0.82rem", fontWeight: mode === "wabi-sabi" ? 800 : 700,
                    letterSpacing: "0.07em", textTransform: "uppercase",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    border: mode === "wabi-sabi" ? "1.5px solid rgba(17,17,17,0.25)" : "none",
                    fontFamily: "var(--font-body)",
                    boxShadow: isLoading ? "none"
                      : mode === "zen" ? "0 4px 20px rgba(200,150,12,0.30)"
                      : mode === "wabi-sabi" ? "none"
                      : "0 4px 20px rgba(255,31,110,0.45)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {appState === "fetching" ? "Fetching"
                    : appState === "proposing" ? "Analyzing"
                    : appState === "categorizing" ? "Sorting"
                    : appState === "ready" ? "Refresh"
                    : "Load Inbox"}
                </button>
              </div>

              {/* Connect work Gmail — only when not linked */}
              {workNeedsLink && activeAccountConfig.email && (
                <button
                  type="button"
                  onClick={() =>
                    signIn(
                      "google",
                      { redirectTo: typeof window !== "undefined" ? window.location.pathname : "/" },
                      { login_hint: activeAccountConfig.email, prompt: "select_account consent" },
                    )
                  }
                  style={{
                    padding: "6px 20px", borderRadius: 999,
                    border: "1px solid rgba(255,208,0,0.5)",
                    background: "rgba(255,208,0,0.10)",
                    color: "#FFD000",
                    fontSize: "0.8rem", fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Connect work Gmail
                </button>
              )}
            </div>
          </div>
          {/* end Row B */}

          {/* ── Row C: Compose/Roast (left) + TODO widget (right), roast text below ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap mt-4">

            {/* Left: Compose + Roast */}
            <div className="flex items-center gap-3 flex-wrap order-1">
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                style={{
                  padding: "6px 18px", borderRadius: 999,
                  border: mode === "zen"
                    ? "1px solid rgba(200,150,12,0.35)"
                    : mode === "wabi-sabi"
                      ? "1.5px solid rgba(26,10,53,0.18)"
                      : "1px solid rgba(0,229,196,0.40)",
                  background: mode === "wabi-sabi" ? "transparent" : mode === "zen" ? "rgba(200,150,12,0.07)" : "rgba(0,229,196,0.08)",
                  color: mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#111" : "#00E5C4",
                  fontSize: "0.82rem", fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Compose
              </button>

              {/* Roast — words only, no emojis */}
              <button
                onClick={handleRoast}
                disabled={roasting || emails.length === 0}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 999,
                  border: mode === "zen"
                    ? "1px solid rgba(200,150,12,0.35)"
                    : mode === "wabi-sabi"
                      ? "1px solid rgba(26,10,53,0.22)"
                      : "1px solid rgba(255,107,26,0.40)",
                  background: mode === "zen"
                    ? "rgba(200,150,12,0.07)"
                    : mode === "wabi-sabi"
                      ? "rgba(26,10,53,0.05)"
                      : "rgba(255,107,26,0.09)",
                  color: mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#1A0A35" : "#FF6B1A",
                  fontSize: "0.84rem", fontWeight: 600,
                  cursor: "pointer",
                  opacity: roasting || emails.length === 0 ? 0.4 : 1,
                  fontFamily: "var(--font-body)",
                }}
              >
                {mode === "zen"
                  ? (roasting ? "Reading" : "Read my inbox")
                  : mode === "wabi-sabi"
                    ? (roasting ? "Spilling" : "Spill the tea")
                    : (roasting ? "Roasting" : "Roast my inbox")}
              </button>
            </div>

            {/* Right: TODO widget */}
            {appState === "ready" && todoEmails.length > 0 && (
              <div
                className="order-2 overflow-hidden"
                style={{
                  background: mode === "zen" ? "#FFFEF9" : "#FFFFFF",
                  border: "1px solid rgba(255,208,0,0.28)",
                  borderRadius: 14,
                  boxShadow: mode === "wabi-sabi" ? "none" : "0 4px 24px rgba(255,208,0,0.08)",
                  minWidth: 220, maxWidth: 290,
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{
                    background: "rgba(255,208,0,0.08)",
                    borderBottom: "1px solid rgba(255,208,0,0.12)",
                  }}
                >
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#FFD000" }}>★ TODO</span>
                  <span style={{
                    fontSize: "0.82rem", fontWeight: 700,
                    background: "rgba(255,208,0,0.18)",
                    border: "none",
                    color: "#FFD000",
                    borderRadius: 99, padding: "1px 8px",
                  }}>
                    {todoEmails.length}
                  </span>
                </div>
                <div className="px-2 py-1 space-y-0.5 overflow-y-auto" style={{ maxHeight: 240 }}>
                  {todoEmails.map(email => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      selected={email.id === selectedEmail?.id}
                      isSelected={false}
                      selectionMode={false}
                      mode={mode}
                      onClick={() => { setExpandedEmail(email); setExpandedComposeMode("ai") }}
                      onDoubleClick={() => { setExpandedEmail(email); setExpandedComposeMode(null) }}
                      onMarkRead={() => handleMarkRead(email)}
                      onDelete={() => handleDelete(email)}
                      onReply={() => { setExpandedEmail(email); setExpandedComposeMode("reply") }}
                      onForward={() => { setExpandedEmail(email); setExpandedComposeMode("forward") }}
                      onToggleTodo={() => handleToggleTodo(email)}
                      onSnooze={() => setSnoozeTarget(email)}
                      onUnsubscribe={() => handleUnsubscribe(email)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Roast text — full-width below the Compose/Roast row */}
            {roast && appState === "ready" && (
              <div className="order-3 basis-full" style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: 500, marginTop: 4 }}>
                <span style={{
                  fontSize: "0.85rem",
                  fontStyle: "italic",
                  color: mode === "zen" ? "#C8960C" : mode === "wabi-sabi" ? "#1A0A35" : "#FF6B1A",
                  flex: 1,
                  letterSpacing: mode === "wabi-sabi" ? "0.02em" : undefined,
                }}>
                  &ldquo;{roast}&rdquo;
                </span>
                <button
                  onClick={() => setRoast(null)}
                  style={{ color: "rgba(26,10,53,0.56)", fontSize: "1rem", background: "none", border: "none", cursor: "pointer", lineHeight: 1, flexShrink: 0, marginTop: 1 }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
          {/* end Row C */}

        </header>
```

- [ ] **Step 2: Run the TypeScript build to check for errors**

Run: `npm run build` (or `npx tsc --noEmit` if build is slow)
Expected: No new TypeScript errors related to `Dashboard.tsx`. (Pre-existing unrelated errors elsewhere, if any, are out of scope.)

- [ ] **Step 3: Start the dev server and visually verify in the browser**

Run: `npm run dev`, open the app in a browser.

Check, for **each** of the 3 modes (use the mode pills, now in Row A's right column):
- Row A: logo/wordmark/subtitle on the left with `AccountToggle` below it; utility links (Sent/Log/Settings/Sign out) stacked above the mode pills on the right, right-aligned
- Party mode pill, when active, shows white text on its pink fill (not invisible pink-on-pink)
- Zen and Basic AF pills still render correctly when active/inactive (no regression from the pill color fix)
- Row B: PlantHeader/TallyTicket/MiniStats on the left; batch picker ("per refresh" 30/50/100) + Refresh button on the right (and "Connect work Gmail" if a work account needs linking)
- Row C: Compose + Roast buttons on the left; TODO widget on the right (if there are TODO-flagged emails)
- Click Roast and confirm the roast text appears full-width below Row C, with working dismiss (×) button
- Resize the browser narrow and confirm rows wrap sensibly without overlap

Expected: All three modes render correctly with no missing elements, no invisible text, and no layout breakage.

- [ ] **Step 4: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "refactor: restructure header layout and fix Party pill text color"
```

---

### Task 2: Remove the design spec

**Files:**
- Delete: `c:\Users\Katelyn\Documents\AI projects\inbox-ai\docs\superpowers\specs\2026-06-11-header-restructure-design.md`

- [ ] **Step 1: Delete the spec file and commit**

```bash
git rm docs/superpowers/specs/2026-06-11-header-restructure-design.md
git commit -m "chore: remove header restructure design spec"
```
