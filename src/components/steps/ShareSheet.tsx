"use client";

import React, { useState } from "react";
import { Share2, Copy, Check, ExternalLink, Globe, RefreshCw } from "lucide-react";

interface ShareSheetProps {
  spreadsheetId: string;
  shareSheet: (fileId: string) => Promise<string>;
  isLoading: boolean;
  onToast: (type: "success" | "error" | "info", title: string, desc?: string) => void;
}

export function ShareSheet({
  spreadsheetId,
  shareSheet,
  isLoading,
  onToast,
}: ShareSheetProps) {
  const [shareableLink, setShareableLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const link = await shareSheet(spreadsheetId);
      setShareableLink(link);
      onToast("success", "Sheet shared!", "Anyone with the link can view it.");
    } catch {
      onToast("error", "Failed to share", "Check your Drive permissions and try again.");
    }
  };

  const handleCopy = async () => {
    if (!shareableLink) return;
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      onToast("success", "Link copied!", "Share it with anyone.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast("error", "Copy failed", "Please copy the link manually.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Info banner */}
      <div className="info-banner">
        <div className="info-banner-icon">
          <Globe size={16} color="#fff" />
        </div>
        <div>
          <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#1c1917", marginBottom: "3px" }}>
            Public viewer access
          </p>
          <p style={{ fontSize: "12.5px", color: "#57534e", lineHeight: 1.55 }}>
            Anyone with the link can view <strong>Sheet 1</strong>. Hidden tabs stay private.
          </p>
        </div>
      </div>

      {!shareableLink ? (
        <>
          {/* Pre-share illustration */}
          <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #eef2ff 0%, #f4f0ff 100%)",
                border: "2px solid #c4d0fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 4px 16px rgba(67,85,232,0.1)",
              }}
            >
              <Share2 size={28} color="#4355e8" />
            </div>
            <p style={{ fontSize: "13.5px", color: "#78716c", maxWidth: "280px", margin: "0 auto", lineHeight: 1.6 }}>
              Click below to generate a shareable view-only link for your Google Sheet.
            </p>
          </div>

          <button
            onClick={handleShare}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? (
              <>
                <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Generating link…
              </>
            ) : (
              <>
                <Share2 size={16} />
                Share Sheet
              </>
            )}
          </button>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Success banner */}
          <div className="success-banner">
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Check size={14} color="#16a34a" strokeWidth={3} />
            </div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#15803d" }}>
              Sheet is now public — anyone with the link can view it
            </p>
          </div>

          {/* Link row */}
          <div>
            <label className="field-label">Shareable Link</label>
            <div className="link-box-wrap">
              <input
                type="text"
                readOnly
                value={shareableLink}
                className="link-input"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopy}
                title="Copy link"
                className={`copy-btn${copied ? " copy-btn--copied" : ""}`}
              >
                {copied ? (
                  <Check size={16} strokeWidth={3} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>

          {/* Open link */}
          <a
            href={shareableLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: "none" }}
          >
            <ExternalLink size={15} />
            Open in Google Sheets
          </a>

          {/* Start over */}
          <div style={{ textAlign: "center", paddingTop: "4px" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12.5px",
                color: "#a8a29e",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#4355e8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#a8a29e")}
            >
              <RefreshCw size={11} />
              Start over with a new sheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
