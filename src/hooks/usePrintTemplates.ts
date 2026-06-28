/**
 * usePrintTemplates.ts
 *
 * Custom React hook managing PrintTemplate[] state with:
 *  - Tier 1: localStorage auto-save (debounced 500ms)
 *  - Tier 2: /api/db cloud sync (piggybacked on existing DB route)
 *  - Tier 3: JSON export / JSON import for user backups
 *
 * No external libraries. Uses standard Web APIs only.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PrintTemplate, TemplateType, PageSize, PageOrientation } from "@/types/print";
import { PRESET_TEMPLATES } from "@/utils/printEngine";

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = "sheet-manager:print-templates";
const DEBOUNCE_MS = 500;

// ── ID Generator (no uuid dependency) ────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Built-in Presets (instantiated once with stable IDs) ─────────────────────

function buildPresets(): PrintTemplate[] {
  const now = new Date().toISOString();
  return PRESET_TEMPLATES.map((preset) => ({
    ...preset,
    id: `preset-${preset.type}-${preset.name.toLowerCase().replace(/\s+/g, "-")}`,
    createdAt: now,
    updatedAt: now,
  }));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UsePrintTemplatesReturn {
  /** All saved templates (presets + user-created) */
  templates: PrintTemplate[];
  /** Currently active/selected template for editing */
  activeTemplate: PrintTemplate | null;
  /** Set the active template by ID */
  setActiveTemplateId: (id: string) => void;
  /** Update the bodyHtml of the active template (triggers auto-save) */
  updateActiveHtml: (html: string) => void;
  /** Update metadata fields (name, pageSize, pageOrientation) */
  updateActiveMetadata: (patch: Partial<Pick<PrintTemplate, "name" | "pageSize" | "pageOrientation" | "type">>) => void;
  /** Create a new blank custom template and make it active */
  createTemplate: (name?: string) => void;
  /** Duplicate the active template */
  duplicateActive: () => void;
  /** Delete a template by ID (cannot delete presets) */
  deleteTemplate: (id: string) => void;
  /** Export active template as a downloadable .json file */
  exportTemplate: (id: string) => void;
  /** Import a template from a .json file (File object) */
  importTemplate: (file: File) => Promise<void>;
  /** Sync all templates to the /api/db endpoint */
  syncToDb: () => Promise<void>;
  /** Whether a DB sync is in progress */
  isSyncing: boolean;
  /** Last sync error message, if any */
  syncError: string | null;
}

export function usePrintTemplates(): UsePrintTemplatesReturn {
  const presets = useRef<PrintTemplate[]>(buildPresets());

  // ── State ────────────────────────────────────────────────────────────────

  const [userTemplates, setUserTemplates] = useState<PrintTemplate[]>(() => {
    // Initialize from localStorage on first render
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PrintTemplate[];
        // Basic shape validation
        if (Array.isArray(parsed) && parsed.every((t) => t.id && t.name && t.bodyHtml)) {
          return parsed;
        }
      }
    } catch {
      // Corrupted localStorage entry — start fresh
    }
    return [];
  });

  const [activeId, setActiveId] = useState<string | null>(() =>
    presets.current[0]?.id ?? null
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────

  const allTemplates: PrintTemplate[] = [...presets.current, ...userTemplates];
  const activeTemplate = allTemplates.find((t) => t.id === activeId) ?? null;

  // ── Tier 1: Auto-save to localStorage (debounced) ─────────────────────────

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(userTemplates));
      } catch (e) {
        console.warn("[usePrintTemplates] localStorage save failed:", e);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [userTemplates]);

  // ── Tier 2: DB Sync ───────────────────────────────────────────────────────

  const syncToDb = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printTemplates: userTemplates }),
      });
      if (!res.ok) throw new Error(`DB sync returned ${res.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setSyncError(msg);
      console.warn("[usePrintTemplates] DB sync failed:", msg);
    } finally {
      setIsSyncing(false);
    }
  }, [userTemplates]);

  // ── Tier 3: JSON Export / Import ─────────────────────────────────────────

  const exportTemplate = useCallback(
    (id: string) => {
      const tpl = allTemplates.find((t) => t.id === id);
      if (!tpl) return;
      const json = JSON.stringify(tpl, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tpl.name.replace(/\s+/g, "-").toLowerCase()}.print-template.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [allTemplates]
  );

  const importTemplate = useCallback(async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string) as PrintTemplate;
          // Shape validation
          if (!parsed.id || !parsed.name || !parsed.bodyHtml) {
            throw new Error("Invalid template file: missing required fields");
          }
          const imported: PrintTemplate = {
            ...parsed,
            // Always generate a new ID to avoid collision with existing templates
            id: generateId(),
            updatedAt: new Date().toISOString(),
          };
          setUserTemplates((prev) => [...prev, imported]);
          setActiveId(imported.id);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }, []);

  // ── CRUD Operations ───────────────────────────────────────────────────────

  const setActiveTemplateId = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const updateUserTemplate = useCallback(
    (id: string, patch: Partial<PrintTemplate>) => {
      const now = new Date().toISOString();
      setUserTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now } : t))
      );
    },
    []
  );

  const updateActiveHtml = useCallback(
    (html: string) => {
      if (!activeId) return;

      // If the active template is a preset, duplicate it first as a user template
      const isPreset = presets.current.some((p) => p.id === activeId);
      if (isPreset) {
        const preset = presets.current.find((p) => p.id === activeId)!;
        const now = new Date().toISOString();
        const copy: PrintTemplate = {
          ...preset,
          id: generateId(),
          name: `${preset.name} (Custom)`,
          bodyHtml: html,
          createdAt: now,
          updatedAt: now,
        };
        setUserTemplates((prev) => [...prev, copy]);
        setActiveId(copy.id);
        return;
      }

      updateUserTemplate(activeId, { bodyHtml: html });
    },
    [activeId, updateUserTemplate]
  );

  const updateActiveMetadata = useCallback(
    (patch: Partial<Pick<PrintTemplate, "name" | "pageSize" | "pageOrientation" | "type">>) => {
      if (!activeId) return;

      const isPreset = presets.current.some((p) => p.id === activeId);
      if (isPreset) {
        // Cannot rename/resize presets — silently ignore
        return;
      }

      updateUserTemplate(activeId, patch as Partial<PrintTemplate>);
    },
    [activeId, updateUserTemplate]
  );

  const createTemplate = useCallback((name?: string) => {
    const now = new Date().toISOString();
    const newTemplate: PrintTemplate = {
      id: generateId(),
      name: name ?? `Custom Template ${new Date().toLocaleTimeString()}`,
      type: "custom" as TemplateType,
      bodyHtml: `<div style="font-family: Arial, sans-serif; padding: 16px;">
  <h1>{{col:0}}</h1>
  <p>Edit this template. Use <code>{{col:N}}</code> for column values, or <code>{{SUM(A2:A10)}}</code> for formulas.</p>
</div>`,
      pageSize: "A4" as PageSize,
      pageOrientation: "portrait" as PageOrientation,
      createdAt: now,
      updatedAt: now,
    };
    setUserTemplates((prev) => [...prev, newTemplate]);
    setActiveId(newTemplate.id);
  }, []);

  const duplicateActive = useCallback(() => {
    if (!activeTemplate) return;
    const now = new Date().toISOString();
    const copy: PrintTemplate = {
      ...activeTemplate,
      id: generateId(),
      name: `${activeTemplate.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    setUserTemplates((prev) => [...prev, copy]);
    setActiveId(copy.id);
  }, [activeTemplate]);

  const deleteTemplate = useCallback(
    (id: string) => {
      const isPreset = presets.current.some((p) => p.id === id);
      if (isPreset) return; // Presets cannot be deleted

      setUserTemplates((prev) => prev.filter((t) => t.id !== id));

      // If deleting the active template, fall back to first preset
      if (activeId === id) {
        setActiveId(presets.current[0]?.id ?? null);
      }
    },
    [activeId]
  );

  return {
    templates: allTemplates,
    activeTemplate,
    setActiveTemplateId,
    updateActiveHtml,
    updateActiveMetadata,
    createTemplate,
    duplicateActive,
    deleteTemplate,
    exportTemplate,
    importTemplate,
    syncToDb,
    isSyncing,
    syncError,
  };
}
