"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Filter,
  ArrowUpDown,
  Search,
  X,
  Plus,
  LayoutGrid,
  Columns,
  Image,
  List,
  Calendar,
  ChevronDown,
  Trash2,
  SlidersHorizontal,
  Printer,
} from "lucide-react";
import {
  FilterRule,
  SortRule,
  FilterOperator,
  ALL_FILTER_OPERATORS,
  FilterOperatorMeta,
} from "@/hooks/useFilteredData";
import { ImportedSheet } from "@/components/SpreadsheetGrid";

export type ViewType = "grid" | "kanban" | "gallery" | "list" | "calendar" | "print";

export const VIEW_OPTIONS: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: "grid",     label: "Grid",     icon: <LayoutGrid size={14} /> },
  { id: "kanban",   label: "Kanban",   icon: <Columns size={14} /> },
  { id: "gallery",  label: "Gallery",  icon: <Image size={14} /> },
  { id: "list",     label: "List",     icon: <List size={14} /> },
  { id: "calendar", label: "Calendar", icon: <Calendar size={14} /> },
  { id: "print",    label: "Print",    icon: <Printer size={14} /> },
];

// ─── Operator categories for the UI ──────────────────────────────────────────

const OPERATOR_CATEGORIES: { key: string; label: string }[] = [
  { key: "text",   label: "Text" },
  { key: "number", label: "Number" },
  { key: "date",   label: "Date" },
  { key: "unique", label: "Special" },
];

interface FilterToolbarProps {
  sheet: ImportedSheet | null;
  viewType: ViewType;
  filterRules: FilterRule[];
  sortRules: SortRule[];
  searchTerm: string;
  filteredCount: number;
  totalRows: number;
  onViewChange: (v: ViewType) => void;
  onFilterRulesChange: (rules: FilterRule[]) => void;
  onSortRulesChange: (rules: SortRule[]) => void;
  onSearchChange: (term: string) => void;
  kanbanGroupCol?: number;
  onKanbanGroupColChange?: (col: number) => void;
  calendarDateCol?: number;
  onCalendarDateColChange?: (col: number) => void;
  galleryTitleCol?: number;
  onGalleryTitleColChange?: (col: number) => void;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

function genId() {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  sheet,
  rules,
  onChange,
  onClose,
}: {
  sheet: ImportedSheet;
  rules: FilterRule[];
  onChange: (r: FilterRule[]) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useClickOutside(panelRef, onClose);

  const headers = sheet.data[0]?.map((c) => c.value || "") ?? [];
  const [activeCategory, setActiveCategory] = useState<string>("text");

  const visibleOps = ALL_FILTER_OPERATORS.filter((o) => o.category === activeCategory);

  const addRule = (op: FilterOperatorMeta) => {
    const newRule: FilterRule = {
      id: genId(),
      colIndex: 0,
      operator: op.value,
      value: "",
      value2: undefined,
      logic: "and",
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (id: string, patch: Partial<FilterRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => onChange(rules.filter((r) => r.id !== id));

  const getOpMeta = (op: FilterOperator): FilterOperatorMeta | undefined =>
    ALL_FILTER_OPERATORS.find((o) => o.value === op);

  return (
    <div ref={panelRef} className="filter-panel">
      <div className="filter-panel-header">
        <span className="filter-panel-title">
          <Filter size={13} /> Filters
        </span>
        <button className="filter-panel-close" onClick={onClose}><X size={14} /></button>
      </div>

      {/* Active Rules */}
      <div className="filter-active-rules">
        {rules.length === 0 && (
          <p className="filter-empty-hint">No filters active. Add one below.</p>
        )}
        {rules.map((rule, idx) => {
          const meta = getOpMeta(rule.operator);
          return (
            <div key={rule.id} className="filter-rule-row">
              {/* Logic connector */}
              {idx > 0 && (
                <select
                  className="filter-logic-select"
                  value={rule.logic ?? "and"}
                  onChange={(e) => updateRule(rule.id, { logic: e.target.value as "and" | "or" })}
                >
                  <option value="and">AND</option>
                  <option value="or">OR</option>
                </select>
              )}

              {/* Column selector */}
              <select
                className="filter-col-select"
                value={rule.colIndex}
                onChange={(e) => updateRule(rule.id, { colIndex: parseInt(e.target.value, 10) })}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                ))}
              </select>

              {/* Operator */}
              <select
                className="filter-op-select"
                value={rule.operator}
                onChange={(e) => updateRule(rule.id, { operator: e.target.value as FilterOperator, value: "", value2: undefined })}
              >
                {OPERATOR_CATEGORIES.map((cat) => (
                  <optgroup key={cat.key} label={cat.label}>
                    {ALL_FILTER_OPERATORS.filter((o) => o.category === cat.key).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {/* Value input(s) */}
              {meta?.needsValue && (
                <input
                  className="filter-val-input"
                  type={meta.category === "number" ? "number" : meta.category === "date" ? "date" : "text"}
                  value={rule.value}
                  onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                  placeholder={meta.category === "number" ? "Number" : meta.category === "date" ? "Date" : "Value…"}
                />
              )}
              {meta?.needsValue2 && (
                <input
                  className="filter-val-input"
                  type={meta.category === "number" ? "number" : "text"}
                  value={rule.value2 ?? ""}
                  onChange={(e) => updateRule(rule.id, { value2: e.target.value })}
                  placeholder={rule.operator === "row_range" ? "To row" : "To"}
                />
              )}

              {/* Remove */}
              <button className="filter-rule-remove" onClick={() => removeRule(rule.id)} title="Remove filter">
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Quick-add by category */}
      <div className="filter-add-section">
        <p className="filter-add-title">Add filter:</p>
        <div className="filter-cat-tabs">
          {OPERATOR_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`filter-cat-tab${activeCategory === cat.key ? " filter-cat-tab--active" : ""}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="filter-op-pills">
          {visibleOps.map((op) => (
            <button key={op.value} className="filter-op-pill" onClick={() => addRule(op)}>
              <Plus size={10} />
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      {rules.length > 0 && (
        <div className="filter-panel-footer">
          <button className="filter-clear-btn" onClick={() => onChange([])}>
            <Trash2 size={12} /> Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sort Panel ───────────────────────────────────────────────────────────────

function SortPanel({
  sheet,
  rules,
  onChange,
  onClose,
}: {
  sheet: ImportedSheet;
  rules: SortRule[];
  onChange: (r: SortRule[]) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useClickOutside(panelRef, onClose);

  const headers = sheet.data[0]?.map((c) => c.value || "") ?? [];

  const addSort = () => {
    onChange([...rules, { id: genId(), colIndex: 0, direction: "asc" }]);
  };
  const updateSort = (id: string, patch: Partial<SortRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeSort = (id: string) => onChange(rules.filter((r) => r.id !== id));

  return (
    <div ref={panelRef} className="filter-panel sort-panel">
      <div className="filter-panel-header">
        <span className="filter-panel-title">
          <ArrowUpDown size={13} /> Sort
        </span>
        <button className="filter-panel-close" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="filter-active-rules">
        {rules.length === 0 && (
          <p className="filter-empty-hint">No sort rules. Add one below.</p>
        )}
        {rules.map((rule, idx) => (
          <div key={rule.id} className="filter-rule-row">
            {idx > 0 && <span className="filter-logic-label">then by</span>}
            <select
              className="filter-col-select"
              value={rule.colIndex}
              onChange={(e) => updateSort(rule.id, { colIndex: parseInt(e.target.value, 10) })}
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
              ))}
            </select>
            <select
              className="filter-op-select"
              style={{ maxWidth: 120 }}
              value={rule.direction}
              onChange={(e) => updateSort(rule.id, { direction: e.target.value as "asc" | "desc" })}
            >
              <option value="asc">↑ Ascending</option>
              <option value="desc">↓ Descending</option>
            </select>
            <button className="filter-rule-remove" onClick={() => removeSort(rule.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="filter-panel-footer">
        <button className="filter-op-pill" style={{ marginRight: 8 }} onClick={addSort}>
          <Plus size={10} /> Add sort level
        </button>
        {rules.length > 0 && (
          <button className="filter-clear-btn" onClick={() => onChange([])}>
            <Trash2 size={12} /> Clear sorts
          </button>
        )}
      </div>
    </div>
  );
}

// ─── View Dropdown ─────────────────────────────────────────────────────────────

function ViewDropdown({
  viewType,
  onChange,
  onClose,
}: {
  viewType: ViewType;
  onChange: (v: ViewType) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  return (
    <div ref={ref} className="view-dropdown">
      {VIEW_OPTIONS.map((v) => (
        <button
          key={v.id}
          className={`view-dropdown-item${viewType === v.id ? " view-dropdown-item--active" : ""}`}
          onClick={() => { onChange(v.id); onClose(); }}
        >
          {v.icon}
          <span>{v.label}</span>
          {viewType === v.id && <span className="view-active-dot" />}
        </button>
      ))}
    </div>
  );
}

// ─── Main Toolbar ──────────────────────────────────────────────────────────────

export function FilterToolbar({
  sheet,
  viewType,
  filterRules,
  sortRules,
  searchTerm,
  filteredCount,
  totalRows,
  onViewChange,
  onFilterRulesChange,
  onSortRulesChange,
  onSearchChange,
  kanbanGroupCol,
  onKanbanGroupColChange,
  calendarDateCol,
  onCalendarDateColChange,
  galleryTitleCol,
  onGalleryTitleColChange,
}: FilterToolbarProps) {
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const currentView = VIEW_OPTIONS.find((v) => v.id === viewType)!;
  const hasFilters = filterRules.length > 0;
  const hasSorts = sortRules.length > 0;
  const isFiltering = hasFilters || searchTerm.trim() !== "";
  const headers = sheet?.data[0]?.map((c) => c.value || "") ?? [];

  // Close other panels when one opens
  const openFilter = () => { setShowFilterPanel(true); setShowSortPanel(false); setShowViewDropdown(false); };
  const openSort = () => { setShowSortPanel(true); setShowFilterPanel(false); setShowViewDropdown(false); };
  const openView = () => { setShowViewDropdown(true); setShowFilterPanel(false); setShowSortPanel(false); };

  // In print mode, filter/sort/search controls are irrelevant — hide them
  const isPrintMode = viewType === "print";

  return (
    <div className="filter-toolbar">
      <div className="filter-toolbar-inner">
        {/* ── Left: View Switcher ───────────────── */}
        <div className="filter-toolbar-section" style={{ position: "relative" }}>
          <button
            className={`filter-toolbar-btn filter-toolbar-btn--view${showViewDropdown ? " filter-toolbar-btn--open" : ""}`}
            onClick={() => (showViewDropdown ? setShowViewDropdown(false) : openView())}
            title="Switch view"
          >
            {currentView.icon}
            <span>{currentView.label}</span>
            <ChevronDown size={12} style={{ transform: showViewDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>

          {showViewDropdown && (
            <ViewDropdown
              viewType={viewType}
              onChange={onViewChange}
              onClose={() => setShowViewDropdown(false)}
            />
          )}
        </div>

        {/* Print mode notice — hides all filter/sort/search controls */}
        {isPrintMode && (
          <span style={{ fontSize: 11.5, color: "var(--at-text-muted)", marginLeft: 10, fontStyle: "italic" }}>
            Print mode — use the template editor to define what gets printed
          </span>
        )}

        {!isPrintMode && (
          <>
            <div className="filter-toolbar-divider" />

            {/* ── Center: Filter + Sort ─────────────── */}
            <div className="filter-toolbar-section" style={{ position: "relative", display: "flex", gap: 4 }}>
              {/* Filter split button */}
              <div className={`filter-btn-group${hasFilters ? " filter-btn-group--split" : ""}`}>
                <button
                  className={`filter-toolbar-btn${hasFilters ? " filter-toolbar-btn--active" : ""}${showFilterPanel ? " filter-toolbar-btn--open" : ""}`}
                  onClick={() => (showFilterPanel ? setShowFilterPanel(false) : openFilter())}
                >
                  <Filter size={13} />
                  <span>Filter</span>
                  {hasFilters && <span className="filter-count-badge">{filterRules.length}</span>}
                </button>
                {hasFilters && (
                  <button
                    className="filter-toolbar-btn-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFilterRulesChange([]);
                    }}
                    title="Clear all filters"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sort split button */}
              <div className={`sort-btn-group${hasSorts ? " sort-btn-group--split" : ""}`}>
                <button
                  className={`filter-toolbar-btn${hasSorts ? " filter-toolbar-btn--active" : ""}${showSortPanel ? " filter-toolbar-btn--open" : ""}`}
                  onClick={() => (showSortPanel ? setShowSortPanel(false) : openSort())}
                >
                  <ArrowUpDown size={13} />
                  <span>Sort</span>
                  {hasSorts && <span className="filter-count-badge">{sortRules.length}</span>}
                </button>
                {hasSorts && (
                  <button
                    className="sort-toolbar-btn-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSortRulesChange([]);
                    }}
                    title="Clear sorts"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Panels */}
              {showFilterPanel && sheet && (
                <FilterPanel
                  sheet={sheet}
                  rules={filterRules}
                  onChange={onFilterRulesChange}
                  onClose={() => setShowFilterPanel(false)}
                />
              )}
              {showSortPanel && sheet && (
                <SortPanel
                  sheet={sheet}
                  rules={sortRules}
                  onChange={onSortRulesChange}
                  onClose={() => setShowSortPanel(false)}
                />
              )}
            </div>
          </>
        )}

        {/* View-specific grouping controls — hidden in print mode */}
        {!isPrintMode && viewType === "kanban" && onKanbanGroupColChange !== undefined && kanbanGroupCol !== undefined && (
          <>
            <div className="filter-toolbar-divider" />
            <div className="filter-toolbar-section">
              <span className="toolbar-select-label">Group by:</span>
              <select
                className="toolbar-select"
                value={kanbanGroupCol}
                onChange={(e) => onKanbanGroupColChange(parseInt(e.target.value, 10))}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {!isPrintMode && viewType === "calendar" && onCalendarDateColChange !== undefined && calendarDateCol !== undefined && (
          <>
            <div className="filter-toolbar-divider" />
            <div className="filter-toolbar-section">
              <span className="toolbar-select-label">Date column:</span>
              <select
                className="toolbar-select"
                value={calendarDateCol}
                onChange={(e) => onCalendarDateColChange(parseInt(e.target.value, 10))}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {!isPrintMode && viewType === "gallery" && onGalleryTitleColChange !== undefined && galleryTitleCol !== undefined && (
          <>
            <div className="filter-toolbar-divider" />
            <div className="filter-toolbar-section">
              <span className="toolbar-select-label">Card Title:</span>
              <select
                className="toolbar-select"
                value={galleryTitleCol}
                onChange={(e) => onGalleryTitleColChange(parseInt(e.target.value, 10))}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {!isPrintMode && <div className="filter-toolbar-divider" />}

        {/* ── Right: Search + row count (hidden in print mode) ─────── */}
        {!isPrintMode && (
          <div className="filter-toolbar-section filter-toolbar-section--right">
            <div className={`filter-search-wrap${searchFocused ? " filter-search-wrap--focused" : ""}`}>
              <Search size={13} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search all columns…"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchTerm && (
                <button className="filter-search-clear" onClick={() => onSearchChange("")}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Editor hint text */}
            <span className="filter-toolbar-hint">
              Double-click cells to edit · single-click to format
            </span>

            {/* Row count */}
            <span className="filter-row-count">
              {isFiltering ? (
                <><strong>{filteredCount}</strong> of {totalRows} rows</>
              ) : (
                <><strong>{totalRows}</strong> rows</>
              )}
            </span>
          </div>
        )}
      </div>


      {/* ── Active filter chips row ──────────────── */}
      {(hasFilters || hasSorts) && (
        <div className="filter-chips-row">
          {filterRules.map((rule, idx) => {
            const opMeta = ALL_FILTER_OPERATORS.find((o) => o.value === rule.operator);
            const colName = headers[rule.colIndex] || `Col ${rule.colIndex + 1}`;
            const valStr = opMeta?.needsValue
              ? ` ${rule.value}${opMeta.needsValue2 ? ` → ${rule.value2}` : ""}`
              : "";
            const logic = idx > 0 ? (rule.logic?.toUpperCase() ?? "AND") : "";
            return (
              <React.Fragment key={rule.id}>
                {idx > 0 && <span className="filter-chip-logic">{logic}</span>}
                <span className="filter-chip">
                  <SlidersHorizontal size={10} />
                  <span className="filter-chip-text">
                    <strong>{colName}</strong> {opMeta?.label}{valStr}
                  </span>
                  <button
                    className="filter-chip-remove"
                    onClick={() => onFilterRulesChange(filterRules.filter((r) => r.id !== rule.id))}
                    title="Remove filter"
                  >
                    <X size={10} />
                  </button>
                </span>
              </React.Fragment>
            );
          })}

          {sortRules.map((rule, idx) => {
            const colName = headers[rule.colIndex] || `Col ${rule.colIndex + 1}`;
            return (
              <span key={rule.id} className="filter-chip filter-chip--sort">
                <ArrowUpDown size={10} />
                <span className="filter-chip-text">
                  <strong>{colName}</strong> {rule.direction === "asc" ? "↑ A→Z" : "↓ Z→A"}
                </span>
                <button
                  className="filter-chip-remove"
                  onClick={() => onSortRulesChange(sortRules.filter((r) => r.id !== rule.id))}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {hasFilters && (
              <button
                className="filter-chips-clear-all"
                onClick={() => onFilterRulesChange([])}
                title="Clear active filters only"
              >
                Clear filters
              </button>
            )}
            {hasSorts && (
              <button
                className="filter-chips-clear-all"
                onClick={() => onSortRulesChange([])}
                title="Clear sort rules only"
              >
                Clear sorts
              </button>
            )}
            {hasFilters && hasSorts && (
              <button
                className="filter-chips-clear-all"
                style={{ fontWeight: 600 }}
                onClick={() => { onFilterRulesChange([]); onSortRulesChange([]); }}
                title="Clear both filters and sorts"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
