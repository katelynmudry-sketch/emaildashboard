import type { DefaultSession } from "next-auth"

// ── next-auth session augmentation ──────────────────────────────────────────

declare module "next-auth" {
  interface Session extends DefaultSession {
    access_token?: string
    refresh_token?: string
    expires_at?: number
    error?: "RefreshTokenError"
    work_access_token?: string
    work_refresh_token?: string
    work_expires_at?: number
    work_error?: "RefreshTokenError"
    /** True when the configured work inbox has completed at least one Google sign-in with tokens stored. */
    workAccountLinked?: boolean
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    work_access_token?: string
    work_refresh_token?: string
    work_expires_at?: number
    work_error?: "RefreshTokenError"
  }
}

// ── UI accounts (also used by Gmail API account selector) ───────────────────

export type AccountId = "personal" | "work"

// ── Email ────────────────────────────────────────────────────────────────────

export interface RawEmail {
  id: string
  threadId: string
  from: string
  fromEmail: string
  to: string
  subject: string
  snippet: string
  body: string          // plain text, truncated to 2000 chars
  htmlBody?: string     // full HTML body for rendering
  date: string          // ISO string
  internalDate: number  // ms timestamp for sorting
  inReplyTo?: string
  messageId?: string    // RFC 2822 Message-ID header
  labelIds: string[]
}

export interface Email {
  id: string
  threadId: string
  from: string          // display name only
  fromEmail: string
  to: string
  subject: string
  snippet: string
  body: string
  htmlBody?: string
  date: string
  internalDate: number
  inReplyTo?: string
  messageId?: string
  labelIds: string[]
  replied?: boolean
  forwarded?: boolean
  todo?: boolean         // manually pinned by user to top of briefing
  snoozedUntil?: string  // ISO date string — hidden until this date
  // AI-added fields
  category: string
  priority: "urgent" | "today" | "fyi"
  summary: string | null  // null if email is short and not promotional
  microSummary: string    // 2-3 word phrase for email row display
  actionFlag: "reply" | "confirm" | "receipt" | "read"
  draftReply: string | null
  timeAgo: string
  deletable: boolean           // AI flagged as safe to delete
  deletableReason: string | null  // e.g. "Security login alert, no longer actionable"
  packageDelivered: boolean    // AI detected this is a package delivery confirmation
  orderSender: string | null   // e.g. "amazon.com" — extracted from delivered email
}

// ── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string            // Gmail label ID (created/found via API)
  name: string          // display name, e.g. "Bills"
  color: string         // tailwind bg color class, e.g. "bg-violet-500"
  gmailLabelId: string  // actual Gmail label ID for applying
}

export interface CategoryConfig {
  account: string       // email address
  categories: Category[]
  proposedAt: string    // ISO timestamp
}

// ── Inbox data ───────────────────────────────────────────────────────────────

export interface InboxData {
  account: string
  fetchedAt: string
  emails: Email[]
  categories: Category[]
}

// ── API payloads ─────────────────────────────────────────────────────────────

export interface CategorizeRequest {
  emails: RawEmail[]
  categories: Category[]
  account: string
}

export interface ProposeRequest {
  emails: RawEmail[]
  existingLabelNames: string[]  // already in Gmail for this account
  account: string
}

export interface ProposeResponse {
  categories: Omit<Category, "id" | "gmailLabelId">[]  // names + colors only; IDs assigned after Gmail label creation
}

export interface LabelRequest {
  messageId: string
  gmailLabelId: string
  /** Which linked Google account to use (default: personal). */
  account?: AccountId
}

export interface ArchiveRequest {
  messageId: string
  account?: AccountId
}

export interface ReadRequest {
  messageId: string
  account?: AccountId
}

export interface DraftRequest {
  to: string
  subject: string
  body: string
  /** Omit for a brand-new message (not a reply in an existing thread). */
  threadId?: string
  inReplyTo?: string
  messageId?: string
  account?: AccountId
}

// ── UI state ─────────────────────────────────────────────────────────────────

export interface AccountConfig {
  id: AccountId
  email: string
  label: string
}

export const ACCOUNTS: AccountConfig[] = [
  { id: "personal", email: process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "", label: process.env.NEXT_PUBLIC_OWNER_EMAIL?.split("@")[0] ?? "personal" },
  { id: "work",     email: process.env.NEXT_PUBLIC_OWNER_WORK_EMAIL ?? "", label: process.env.NEXT_PUBLIC_OWNER_WORK_EMAIL?.split("@")[0] ?? "work" },
]
