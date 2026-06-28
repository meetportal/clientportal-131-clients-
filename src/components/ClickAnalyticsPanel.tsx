"use client";

/**
 * ClickAnalyticsPanel.tsx
 *
 * Analytics panel rendered as the third tab in TriggersConsole.
 * Shows per-recipient link click data for all certificate emails sent.
 *
 * Features:
 *  - Summary bar (Total sent / clicked / CTR%)
 *  - Filterable table: Opened / Not Yet / All
 *  - Per-row: name, email, sent time, click count, first/last click, badges
 *  - Delete individual records
 *  - Auto-refresh every 30s while panel is open
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  MousePointerClick,
  Mail,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import type { TrackedLink, TrackedLinkAnalytics } from "@/types/tracking";
import { toAnalytics } from "@/types/tracking";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ── Component ─────────────────────────────────────────────────────────────────

type FilterMode = "all" | "opened" | "pending";

export function ClickAnalyticsPanel() {
  const [links, setLinks] = useState<TrackedLinkAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────

  const fetchLinks = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/db");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawLinks: TrackedLink[] = data.trackedLinks ?? [];
      const analytics = rawLinks
        .map(toAnalytics)
        .sort(
          (a, b) =>
            new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        );
      setLinks(analytics);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchLinks(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchLinks]);

  // ── Delete handler ──────────────────────────────────────────────────────

  const handleDelete = async (token: string) => {
    if (!confirm("Remove this tracking record? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/track?id=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLinks((prev) => prev.filter((l) => l.token !== token));
    } catch (err) {
      console.error("[ClickAnalyticsPanel] delete failed:", err);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────────────

  const totalSent = links.length;
  const totalClicked = links.filter((l) => l.hasClicked).length;
  const ctr = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  const filtered = links.filter((l) => {
    if (filterMode === "opened") return l.hasClicked;
    if (filterMode === "pending") return !l.hasClicked;
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={s.center}>
        <RefreshCw size={18} style={{ animation: "spin 1s linear infinite", color: "var(--at-accent)" }} />
        <span style={s.muted}>Loading analytics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.center}>
        <AlertTriangle size={18} color="#f59e0b" />
        <span style={s.muted}>{error}</span>
        <button style={s.refreshBtn} onClick={() => fetchLinks()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={s.root}>
      {/* ── Summary Bar ──────────────────────────────────────────────── */}
      <div style={s.summaryBar}>
        <div style={s.statCard}>
          <Mail size={16} style={{ color: "#60a5fa" }} />
          <div>
            <div style={s.statValue}>{totalSent}</div>
            <div style={s.statLabel}>Emails Sent</div>
          </div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <MousePointerClick size={16} style={{ color: "#34d399" }} />
          <div>
            <div style={{ ...s.statValue, color: "#34d399" }}>{totalClicked}</div>
            <div style={s.statLabel}>Clicked</div>
          </div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCard}>
          <CheckCircle2 size={16} style={{ color: totalClicked > 0 ? "#a78bfa" : "#6b7280" }} />
          <div>
            <div style={{ ...s.statValue, color: ctr > 0 ? "#a78bfa" : "#6b7280" }}>
              {ctr}%
            </div>
            <div style={s.statLabel}>Click-Through Rate</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {lastRefreshed && (
            <span style={s.muted}>
              Updated {formatRelative(lastRefreshed.toISOString())}
            </span>
          )}
          <button
            style={s.refreshBtn}
            onClick={() => fetchLinks()}
            title="Refresh analytics"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ───────────────────────────────────────────────── */}
      <div style={s.filterRow}>
        {(["all", "opened", "pending"] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            style={{
              ...s.filterTab,
              ...(filterMode === mode ? s.filterTabActive : {}),
            }}
            onClick={() => setFilterMode(mode)}
          >
            {mode === "all" && `All (${totalSent})`}
            {mode === "opened" && `✅ Opened (${totalClicked})`}
            {mode === "pending" && `⏳ Not Yet (${totalSent - totalClicked})`}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={s.center}>
          <MousePointerClick size={32} style={{ color: "#374151" }} />
          <p style={s.muted}>
            {totalSent === 0
              ? "No certificate emails have been sent yet. Run a mail merge to start tracking."
              : `No records match the "${filterMode}" filter.`}
          </p>
        </div>
      ) : (
        <div style={s.tableWrap}>
          {/* Header */}
          <div style={s.tableHeader}>
            <div style={{ ...s.th, flex: 2 }}>Recipient</div>
            <div style={{ ...s.th, flex: 2 }}>Email</div>
            <div style={{ ...s.th, flex: 1.5 }}>Sent</div>
            <div style={{ ...s.th, flex: 1, textAlign: "center" }}>Clicks</div>
            <div style={{ ...s.th, flex: 1.5 }}>First Opened</div>
            <div style={{ ...s.th, flex: 1, textAlign: "center" }}>Status</div>
            <div style={{ ...s.th, width: 36 }} />
          </div>

          {/* Rows */}
          {filtered.map((link) => (
            <div key={link.token}>
              {/* Main row */}
              <div
                style={{
                  ...s.tableRow,
                  background: link.hasClicked ? "rgba(52, 211, 153, 0.04)" : "transparent",
                  cursor: link.clicks.length > 0 ? "pointer" : "default",
                }}
                onClick={() =>
                  link.clicks.length > 0
                    ? setExpandedToken(expandedToken === link.token ? null : link.token)
                    : undefined
                }
              >
                {/* Name */}
                <div style={{ ...s.td, flex: 2, fontWeight: 600 }}>
                  {link.recipientName || "—"}
                </div>

                {/* Email */}
                <div style={{ ...s.td, flex: 2, color: "#9ca3af" }}>
                  {link.recipientEmail}
                </div>

                {/* Sent */}
                <div
                  style={{ ...s.td, flex: 1.5, color: "#6b7280" }}
                  title={formatAbsolute(link.sentAt)}
                >
                  {formatRelative(link.sentAt)}
                </div>

                {/* Click count */}
                <div style={{ ...s.td, flex: 1, textAlign: "center" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: link.clickCount > 0 ? "#34d399" : "#4b5563",
                    }}
                  >
                    {link.clickCount}
                  </span>
                </div>

                {/* First opened */}
                <div
                  style={{ ...s.td, flex: 1.5, color: "#6b7280" }}
                  title={formatAbsolute(link.firstClickAt)}
                >
                  {link.firstClickAt ? formatRelative(link.firstClickAt) : "—"}
                </div>

                {/* Status badge */}
                <div style={{ ...s.td, flex: 1, textAlign: "center" }}>
                  {link.hasClicked ? (
                    <span style={s.badgeOpened}>Opened</span>
                  ) : (
                    <span style={s.badgePending}>Not Yet</span>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{ ...s.td, width: 36, display: "flex", gap: 4, alignItems: "center" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.clicks.length > 0 && (
                    <button
                      style={s.expandBtn}
                      title={expandedToken === link.token ? "Collapse" : "View click details"}
                      onClick={() =>
                        setExpandedToken(
                          expandedToken === link.token ? null : link.token
                        )
                      }
                    >
                      {expandedToken === link.token ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </button>
                  )}
                  <button
                    style={s.deleteBtn}
                    title="Remove record"
                    onClick={() => handleDelete(link.token)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Expanded click-event details */}
              {expandedToken === link.token && link.clicks.length > 0 && (
                <div style={s.expandedPanel}>
                  <div style={s.expandedTitle}>
                    <MousePointerClick size={12} />
                    All click events for {link.recipientName}
                  </div>
                  {[...link.clicks]
                    .sort(
                      (a, b) =>
                        new Date(b.clickedAt).getTime() -
                        new Date(a.clickedAt).getTime()
                    )
                    .map((click, i) => (
                      <div key={i} style={s.clickEventRow}>
                        <Clock size={11} style={{ color: "#60a5fa", flexShrink: 0 }} />
                        <span style={s.clickTime} title={formatAbsolute(click.clickedAt)}>
                          {formatAbsolute(click.clickedAt)}
                        </span>
                        <span style={s.clickUa}>{click.userAgent}</span>
                      </div>
                    ))}
                  <a
                    href={link.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={s.driveLink}
                  >
                    <ExternalLink size={11} />
                    Open certificate in Drive
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "var(--font-body, sans-serif)",
  },
  summaryBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderBottom: "1px solid #1e293b",
    background: "#0b1120",
    flexShrink: 0,
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1,
    color: "#f1f5f9",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    background: "#1e293b",
    margin: "0 12px",
  },
  muted: {
    fontSize: 11,
    color: "#475569",
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 9px",
    border: "1px solid #1e293b",
    borderRadius: 6,
    background: "#1e293b",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 11,
  },
  filterRow: {
    display: "flex",
    gap: 4,
    padding: "8px 16px",
    borderBottom: "1px solid #1e293b",
    flexShrink: 0,
  },
  filterTab: {
    padding: "4px 12px",
    border: "1px solid #1e293b",
    borderRadius: 20,
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 500,
  },
  filterTabActive: {
    background: "#1e3a5f",
    borderColor: "#3b82f6",
    color: "#93c5fd",
    fontWeight: 600,
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 10,
    padding: 32,
    color: "#475569",
    fontSize: 12,
    textAlign: "center",
  },
  tableWrap: {
    flex: 1,
    overflowY: "auto",
  },
  tableHeader: {
    display: "flex",
    padding: "6px 16px",
    borderBottom: "1px solid #1e293b",
    background: "#0b1120",
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
  th: {
    fontSize: 10,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "0 4px",
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    borderBottom: "1px solid #0f1929",
    transition: "background 0.15s",
  },
  td: {
    fontSize: 12,
    color: "#cbd5e1",
    padding: "0 4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  badgeOpened: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    background: "rgba(52, 211, 153, 0.15)",
    color: "#34d399",
    border: "1px solid rgba(52, 211, 153, 0.3)",
    fontSize: 10,
    fontWeight: 600,
  },
  badgePending: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    background: "rgba(251, 191, 36, 0.1)",
    color: "#fbbf24",
    border: "1px solid rgba(251, 191, 36, 0.25)",
    fontSize: 10,
    fontWeight: 600,
  },
  expandBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    padding: 3,
    borderRadius: 4,
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#4b5563",
    display: "flex",
    alignItems: "center",
    padding: 3,
    borderRadius: 4,
  },
  expandedPanel: {
    padding: "10px 16px 12px 36px",
    background: "#060d1a",
    borderBottom: "1px solid #0f1929",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  expandedTitle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    color: "#475569",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
  },
  clickEventRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 11,
    color: "#94a3b8",
  },
  clickTime: {
    color: "#60a5fa",
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },
  clickUa: {
    color: "#475569",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  driveLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    fontSize: 10,
    color: "#3b82f6",
    textDecoration: "none",
  },
};
