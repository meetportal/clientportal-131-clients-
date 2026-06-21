"use client";

import React, { useState } from "react";
import { Stepper } from "@/components/Stepper";
import { CreateSheet } from "@/components/steps/CreateSheet";
import { HideTabs } from "@/components/steps/HideTabs";
import { ShareSheet } from "@/components/steps/ShareSheet";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { useSheetsApi, CreatedSheet } from "@/hooks/useSheetsApi";
import { FileSpreadsheet, Sparkles, ChevronLeft } from "lucide-react";

const STEP_META = [
  {
    title: "Create your sheet",
    description: "Give it a name and fill in your data — or start with sample data.",
  },
  {
    title: "Choose what to hide",
    description: "Select tabs that viewers shouldn't see. Tab 1 always stays visible.",
  },
  {
    title: "Get your share link",
    description: "Generate a view-only link anyone can open — no sign-in required.",
  },
];

export function SheetManager() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [createdSheet, setCreatedSheet] = useState<CreatedSheet | null>(null);
  const [sheetName, setSheetName] = useState("");

  const { toasts, dismiss, toast } = useToast();
  const { isLoading, createSheet, hideTabs, shareSheet } = useSheetsApi();

  const handleCreated = (sheet: CreatedSheet, name: string) => {
    setCreatedSheet(sheet);
    setSheetName(name);
    setStep(2);
  };

  const handleTabsHidden = () => {
    setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3);
  };

  const currentMeta = STEP_META[step - 1];

  return (
    <>
      <div className="app-bg">
        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
            <span className="brand-pill">
              <span className="brand-pill-dot" />
              Google Sheets Automation
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "11px",
                background: "linear-gradient(135deg, #4355e8 0%, #7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(67,85,232,0.3)",
              }}
            >
              <FileSpreadsheet size={20} color="#fff" />
            </div>
            <h1
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "clamp(24px, 5vw, 30px)",
                fontWeight: 800,
                color: "#1c1917",
                letterSpacing: "-0.03em",
              }}
            >
              Sheet Manager
            </h1>
          </div>

          <p style={{ fontSize: "14.5px", color: "#78716c", maxWidth: "380px", margin: "0 auto", lineHeight: 1.55 }}>
            Create, configure &amp; share Google Sheets in three effortless steps.
          </p>
        </div>

        {/* ── Main card ────────────────────────────────────────── */}
        <div className="main-card">
          {/* Stepper */}
          <Stepper currentStep={step} />

          {/* Card body */}
          <div className="card-body">
            {/* Step heading row — back button + title */}
            <div style={{ marginBottom: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                {/* Back button — only show on steps 2 and 3 */}
                {step > 1 && (
                  <button
                    onClick={handleBack}
                    disabled={isLoading}
                    title="Go back"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 10px 4px 7px",
                      borderRadius: "8px",
                      border: "1.5px solid #e8e6e1",
                      background: "#fafaf8",
                      color: "#78716c",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      opacity: isLoading ? 0.5 : 1,
                      transition: "all 0.18s",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.borderColor = "#c4d0fe";
                        e.currentTarget.style.background = "#f0f4ff";
                        e.currentTarget.style.color = "#4355e8";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e8e6e1";
                      e.currentTarget.style.background = "#fafaf8";
                      e.currentTarget.style.color = "#78716c";
                    }}
                  >
                    <ChevronLeft size={13} strokeWidth={2.5} />
                    Back
                  </button>
                )}
                <p className="step-eyebrow" style={{ margin: 0 }}>Step {step} of 3</p>
              </div>
              <h2 className="step-title">{currentMeta.title}</h2>
              <p className="step-desc">{currentMeta.description}</p>
            </div>

            {/* Context strip — active sheet */}
            {sheetName && step > 1 && (
              <div className="context-strip" style={{ marginBottom: "20px" }}>
                <Sparkles size={13} color="#4355e8" />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Working on:
                </span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#4355e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sheetName}
                </span>
              </div>
            )}

            {/* Step panels */}
            {step === 1 && (
              <CreateSheet
                onCreated={handleCreated}
                createSheet={createSheet}
                isLoading={isLoading}
                onToast={toast}
              />
            )}
            {step === 2 && createdSheet && (
              <HideTabs
                tabs={createdSheet.tabs}
                spreadsheetId={createdSheet.spreadsheetId}
                hideTabs={hideTabs}
                isLoading={isLoading}
                onDone={handleTabsHidden}
                onToast={toast}
              />
            )}
            {step === 3 && createdSheet && (
              <ShareSheet
                spreadsheetId={createdSheet.spreadsheetId}
                shareSheet={shareSheet}
                isLoading={isLoading}
                onToast={toast}
              />
            )}
          </div>

          {/* Footer hint — step 1 only */}
          {step === 1 && (
            <div style={{ padding: "0 28px 20px", textAlign: "center" }}>
              <p style={{ fontSize: "12px", color: "#b8b0a8", lineHeight: 1.5 }}>
                You&apos;ll be asked to sign in with Google when you click &ldquo;Create Sheet&rdquo;.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="app-footer">
          <p>Built with Next.js · Google Sheets API · Google Drive API</p>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
