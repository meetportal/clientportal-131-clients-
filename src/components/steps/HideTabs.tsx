"use client";

import React, { useState } from "react";
import { Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react";
import { SheetTab } from "@/hooks/useSheetsApi";

interface HideTabsProps {
  tabs: SheetTab[];
  spreadsheetId: string;
  hideTabs: (spreadsheetId: string, sheetIds: number[]) => Promise<void>;
  isLoading: boolean;
  onDone: () => void;
  onToast: (type: "success" | "error" | "info", title: string, desc?: string) => void;
}

const TAB_COLORS = [
  "linear-gradient(135deg,#4355e8,#7c3aed)",
  "linear-gradient(135deg,#7c3aed,#a855f7)",
  "linear-gradient(135deg,#a855f7,#ec4899)",
  "linear-gradient(135deg,#06b6d4,#3b82f6)",
];

export function HideTabs({
  tabs,
  spreadsheetId,
  hideTabs,
  isLoading,
  onDone,
  onToast,
}: HideTabsProps) {
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState(false);

  const toggleTab = (sheetId: number) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(sheetId)) {
        next.delete(sheetId);
      } else {
        next.add(sheetId);
      }
      return next;
    });
  };

  const handleApply = async () => {
    if (hiddenIds.size === 0) {
      onToast("info", "Nothing to hide", "Toggle at least one tab to hide.");
      return;
    }
    try {
      await hideTabs(spreadsheetId, Array.from(hiddenIds));
      setApplied(true);
      const hiddenTitles = tabs
        .filter((t) => hiddenIds.has(t.sheetId))
        .map((t) => t.title)
        .join(", ");
      onToast("success", "Tabs hidden!", `Hidden: ${hiddenTitles}`);
    } catch {
      onToast("error", "Failed to hide tabs", "Please try again.");
    }
  };

  const visibleTabs = tabs.filter((t) => !hiddenIds.has(t.sheetId));
  const hiddenTabs = tabs.filter((t) => hiddenIds.has(t.sheetId));

  /* ── Applied success state ─────────────────────────────────── */
  if (applied) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "8px 0 4px" }}>
        <div className="success-icon-wrap">
          <CheckCircle2 size={32} color="#16a34a" strokeWidth={2.5} />
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 800, color: "#1c1917", marginBottom: "5px" }}>
            Visibility Updated!
          </p>
          <p style={{ fontSize: "14px", color: "#78716c" }}>
            Your tab settings have been applied.
          </p>
        </div>

        {/* Summary panel */}
        <div className="preview-panel" style={{ width: "100%", maxWidth: "380px" }}>
          <div className="preview-row">
            <span className="preview-row-label">Visible</span>
            <div className="preview-tags">
              {visibleTabs.map((t) => (
                <span key={t.sheetId} className="tag-visible">
                  <Eye size={10} />
                  {t.title}
                </span>
              ))}
            </div>
          </div>
          <div className="preview-row">
            <span className="preview-row-label">Hidden</span>
            <div className="preview-tags">
              {hiddenTabs.length === 0 ? (
                <span style={{ fontSize: "12px", color: "#b8b0a8", fontStyle: "italic" }}>None</span>
              ) : (
                hiddenTabs.map((t) => (
                  <span key={t.sheetId} className="tag-hidden">
                    <EyeOff size={10} />
                    {t.title}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onDone}
          className="btn-primary"
          style={{ maxWidth: "320px" }}
        >
          Continue to Share
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  /* ── Default state ─────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <p style={{ fontSize: "13.5px", color: "#78716c", lineHeight: 1.55 }}>
        Tap a tab to toggle its visibility. Viewers will only see tabs marked as visible.
      </p>

      {/* Tab cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {tabs.map((tab, idx) => {
          const isFirst = idx === 0;
          const isHidden = hiddenIds.has(tab.sheetId);

          let cardClass = "tab-card ";
          if (isFirst) cardClass += "tab-card--first";
          else if (isHidden) cardClass += "tab-card--hidden";
          else cardClass += "tab-card--visible";

          return (
            <div key={tab.sheetId} className={cardClass}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                {/* Color dot */}
                <div
                  className="tab-dot"
                  style={{ background: TAB_COLORS[idx % TAB_COLORS.length], flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1c1917", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tab.title}
                  </p>
                  {isFirst && (
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#4355e8", marginTop: "1px" }}>
                      Always visible
                    </p>
                  )}
                </div>
              </div>

              {/* Toggle button */}
              <button
                onClick={() => !isFirst && toggleTab(tab.sheetId)}
                disabled={isFirst}
                className={[
                  "tab-toggle-btn",
                  isFirst
                    ? "tab-toggle-btn--locked"
                    : isHidden
                    ? "tab-toggle-btn--hidden"
                    : "tab-toggle-btn--visible",
                ].join(" ")}
                title={isFirst ? "First tab cannot be hidden" : undefined}
              >
                {isHidden ? (
                  <>
                    <EyeOff size={12} />
                    Hidden
                  </>
                ) : (
                  <>
                    <Eye size={12} />
                    Visible
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Live preview */}
      <div className="preview-panel">
        <div className="preview-row">
          <span className="preview-row-label">Visible</span>
          <div className="preview-tags">
            {visibleTabs.map((t) => (
              <span key={t.sheetId} className="tag-visible">
                <Eye size={10} />
                {t.title}
              </span>
            ))}
          </div>
        </div>
        <div className="preview-row">
          <span className="preview-row-label">Hidden</span>
          <div className="preview-tags">
            {hiddenTabs.length === 0 ? (
              <span style={{ fontSize: "12px", color: "#b8b0a8", fontStyle: "italic" }}>None selected</span>
            ) : (
              hiddenTabs.map((t) => (
                <span key={t.sheetId} className="tag-hidden">
                  <EyeOff size={10} />
                  {t.title}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleApply}
        disabled={isLoading || hiddenIds.size === 0}
        className="btn-primary"
      >
        {isLoading ? (
          <>
            <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Applying…
          </>
        ) : (
          <>
            <EyeOff size={16} />
            {hiddenIds.size > 0
              ? `Hide ${hiddenIds.size} Tab${hiddenIds.size !== 1 ? "s" : ""}`
              : "Select tabs to hide"}
          </>
        )}
      </button>
    </div>
  );
}
