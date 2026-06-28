/**
 * tracking.ts
 * Type definitions for the certificate link click tracking system.
 */

// ── Core tracking record ───────────────────────────────────────────────────────

export interface ClickEvent {
  /** ISO 8601 timestamp of the click */
  clickedAt: string;
  /** Browser / OS string from User-Agent header */
  userAgent: string;
}

export interface TrackedLink {
  /** Opaque unique token — format: "tl_<timestamp>_<5-char-random>" */
  token: string;
  /** Recipient display name */
  recipientName: string;
  /** Recipient email address */
  recipientEmail: string;
  /** 0-based row index in the spreadsheet that produced this certificate */
  rowIndex: number;
  /** The real Google Drive sharing URL — never sent to the recipient directly */
  driveUrl: string;
  /** ISO 8601 timestamp when the email was dispatched */
  sentAt: string;
  /** All recorded click events for this link (appended on each GET /api/track) */
  clicks: ClickEvent[];
}

// ── Computed analytics view (derived, never stored) ───────────────────────────

export interface TrackedLinkAnalytics extends TrackedLink {
  clickCount: number;
  hasClicked: boolean;
  firstClickAt: string | null;
  lastClickAt: string | null;
}

/** Derives analytics fields from a raw TrackedLink */
export function toAnalytics(link: TrackedLink): TrackedLinkAnalytics {
  const sorted = [...link.clicks].sort(
    (a, b) => new Date(a.clickedAt).getTime() - new Date(b.clickedAt).getTime()
  );
  return {
    ...link,
    clickCount: link.clicks.length,
    hasClicked: link.clicks.length > 0,
    firstClickAt: sorted[0]?.clickedAt ?? null,
    lastClickAt: sorted[sorted.length - 1]?.clickedAt ?? null,
  };
}

// ── Token generator ────────────────────────────────────────────────────────────

/**
 * Generates an opaque tracking token.
 * Format: tl_<unix-ms>_<5-char-alphanum>
 * Example: tl_1719510123456_k7m2p
 *
 * No PII is encoded in the token — it is purely a DB lookup key.
 */
export function generateTrackingToken(): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `tl_${Date.now()}_${rand}`;
}

// ── DB payload extension ───────────────────────────────────────────────────────

/** Shape of the trackedLinks field stored in /api/db */
export interface TrackingDbPayload {
  trackedLinks: TrackedLink[];
}
