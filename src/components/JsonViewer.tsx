"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check, ChevronsDown, ChevronsUp } from "lucide-react";

// ── Types & constants ──────────────────────────────────────────────────────────

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };

const C = {
  key:  "#6d28d9",  // purple   — object keys
  str:  "#15803d",  // green    — string values
  num:  "#b45309",  // amber    — numbers
  bool: "#0d9488",  // teal     — true / false
  nil:  "#9ca3af",  // gray     — null
  punc: "#6b7280",  // mid-gray — braces, colons, commas
};

const INDENT = 14; // px per depth level

// ── Toolbar button style ───────────────────────────────────────────────────────

const toolBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 8px",
  border: "1px solid var(--at-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--at-surface)",
  color: "var(--at-text-muted)",
  fontSize: "10.5px",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  transition: "all 0.12s ease",
  whiteSpace: "nowrap",
};

// ── Copy helper ────────────────────────────────────────────────────────────────

function copyText(val: JsonVal) {
  const text = typeof val === "string" ? val : JSON.stringify(val, null, 2);
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Primitive value renderer ───────────────────────────────────────────────────

function PrimVal({ v }: { v: JsonVal }) {
  if (v === null)
    return <span style={{ color: C.nil, fontStyle: "italic" }}>null</span>;
  if (typeof v === "boolean")
    return <span style={{ color: C.bool }}>{String(v)}</span>;
  if (typeof v === "number")
    return <span style={{ color: C.num }}>{v}</span>;
  const s = v as string;
  const display = s.length > 150 ? s.slice(0, 150) + "…" : s;
  return <span style={{ color: C.str }}>"{display}"</span>;
}

// ── Single JSON node (recursive) ───────────────────────────────────────────────

interface NodeProps {
  label?:        string | number; // key name or array index
  value:         JsonVal;
  depth:         number;
  last:          boolean;
  expandDefault: boolean;         // driven by Expand All / Collapse All
}

function JsonNode({ label, value, depth, last, expandDefault }: NodeProps) {
  const isArr = Array.isArray(value);
  const isObj = !isArr && typeof value === "object" && value !== null;
  const expandable = isArr || isObj;

  const [open, setOpen]       = useState(expandDefault);
  const [hover, setHover]     = useState(false);
  const [copied, setCopied]   = useState(false);

  const pl = depth * INDENT;

  const doCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  // Label part ("key": )
  const labelEl =
    label !== undefined ? (
      <>
        <span
          style={{
            color: typeof label === "number" ? C.punc : C.key,
            fontWeight: 600,
            fontFamily: "monospace",
          }}
        >
          {typeof label === "number" ? label : `"${label}"`}
        </span>
        <span style={{ color: C.punc, fontFamily: "monospace" }}>:&thinsp;</span>
      </>
    ) : null;

  // Copy button (shown on hover)
  const copyBtn = hover ? (
    <button
      onClick={doCopy}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 3px",
        color: "var(--at-text-muted)",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        borderRadius: "3px",
        marginLeft: "4px",
      }}
      title="Copy value"
    >
      {copied ? <Check size={10} color="#16a34a" /> : <Copy size={10} />}
    </button>
  ) : null;

  // ── Primitive leaf ───────────────────────────────────────────────────────────
  if (!expandable) {
    return (
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft:  `${pl + 20}px`,
          paddingRight: "6px",
          paddingTop:    "1px",
          paddingBottom: "1px",
          borderRadius: "3px",
          background: hover ? "rgba(0,0,0,0.028)" : "transparent",
          minHeight: "22px",
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: "11.5px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: "20px",
          }}
        >
          {labelEl}
          <PrimVal v={value} />
          {!last && <span style={{ color: C.punc, fontFamily: "monospace" }}>,</span>}
        </span>
        {copyBtn}
      </div>
    );
  }

  // ── Expandable (object / array) ──────────────────────────────────────────────
  const entries: [string | number, JsonVal][] = isArr
    ? (value as JsonVal[]).map((v, i) => [i, v])
    : Object.entries(value as Record<string, JsonVal>);

  const count   = entries.length;
  const ob      = isArr ? "[" : "{";
  const cb      = isArr ? "]" : "}";
  const summary = `${count} ${isArr ? (count === 1 ? "item" : "items") : (count === 1 ? "key" : "keys")}`;

  return (
    <div>
      {/* Expand / collapse header row */}
      <div
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display:       "flex",
          alignItems:    "center",
          gap:           "2px",
          paddingLeft:   `${pl + 4}px`,
          paddingRight:  "6px",
          paddingTop:    "1px",
          paddingBottom: "1px",
          cursor:        "pointer",
          borderRadius:  "3px",
          background:    hover ? "rgba(0,0,0,0.028)" : "transparent",
          minHeight:     "22px",
          userSelect:    "none",
        }}
      >
        {/* Chevron */}
        <span
          style={{
            color:     C.punc,
            display:   "flex",
            alignItems:"center",
            flexShrink: 0,
          }}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>

        {/* Label + brace */}
        <span
          style={{
            flex:       1,
            fontSize:   "11.5px",
            display:    "flex",
            alignItems: "center",
            overflow:   "hidden",
            lineHeight: "20px",
          }}
        >
          {labelEl}
          <span style={{ color: C.punc, fontFamily: "monospace" }}>{ob}</span>

          {/* Collapsed summary badge */}
          {!open && (
            <>
              <span
                style={{
                  fontSize:     "10px",
                  color:        "#6b7280",
                  padding:      "1px 5px",
                  background:   "var(--at-surface-2)",
                  borderRadius: "3px",
                  border:       "1px solid var(--at-border-light)",
                  margin:       "0 4px",
                  fontFamily:   "var(--font-body)",
                  fontWeight:   500,
                  flexShrink:    0,
                }}
              >
                {summary}
              </span>
              <span style={{ color: C.punc, fontFamily: "monospace" }}>{cb}</span>
              {!last && <span style={{ color: C.punc, fontFamily: "monospace" }}>,</span>}
            </>
          )}
        </span>

        {/* Copy button (only when collapsed — copying the whole sub-tree) */}
        {!open && copyBtn}
      </div>

      {/* Children */}
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={String(k)}
              label={k}
              value={v}
              depth={depth + 1}
              last={i === entries.length - 1}
              // auto-expand one more level while parent is expanding
              expandDefault={expandDefault && depth < 1}
            />
          ))}

          {/* Closing brace */}
          <div
            style={{
              paddingLeft:  `${pl + 20}px`,
              fontSize:     "11.5px",
              color:         C.punc,
              fontFamily:   "monospace",
              minHeight:    "22px",
              lineHeight:   "22px",
            }}
          >
            {cb}
            {!last && ","}
          </div>
        </>
      )}
    </div>
  );
}

// ── Public component ───────────────────────────────────────────────────────────

interface JsonViewerProps {
  rawJson: string;
}

export function JsonViewer({ rawJson }: JsonViewerProps) {
  // Parse once — if invalid we show an error message, no hooks affected
  let parsed: JsonVal | undefined;
  let parseError = false;
  try {
    parsed = JSON.parse(rawJson) as JsonVal;
  } catch {
    parseError = true;
  }

  // version key forces tree to re-mount on Expand All / Collapse All
  const [version,       setVersion]     = useState(0);
  const [expandDefault, setExpandDefault] = useState(true);
  const [copiedAll,     setCopiedAll]   = useState(false);

  const expandAll   = () => { setExpandDefault(true);  setVersion((v) => v + 1); };
  const collapseAll = () => { setExpandDefault(false); setVersion((v) => v + 1); };

  const copyAll = () => {
    if (parsed !== undefined) {
      copyText(parsed);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1400);
    }
  };

  if (parseError || parsed === undefined) {
    return (
      <div
        style={{
          fontSize: "12px",
          color:    "var(--clr-error)",
          padding:  "4px 8px",
          background: "var(--clr-error-bg)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid #fca5a5",
        }}
      >
        Unable to parse as JSON
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
        <button
          onClick={expandAll}
          style={toolBtn}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--at-accent)"; e.currentTarget.style.color = "var(--at-accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--at-border)"; e.currentTarget.style.color = "var(--at-text-muted)"; }}
          title="Expand all nodes"
        >
          <ChevronsDown size={11} />
          Expand all
        </button>
        <button
          onClick={collapseAll}
          style={toolBtn}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--at-accent)"; e.currentTarget.style.color = "var(--at-accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--at-border)"; e.currentTarget.style.color = "var(--at-text-muted)"; }}
          title="Collapse all nodes"
        >
          <ChevronsUp size={11} />
          Collapse all
        </button>
        <button
          onClick={copyAll}
          style={{ ...toolBtn, marginLeft: "auto" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--at-accent)"; e.currentTarget.style.color = "var(--at-accent)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--at-border)"; e.currentTarget.style.color = "var(--at-text-muted)"; }}
          title="Copy full JSON"
        >
          {copiedAll ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
          {copiedAll ? "Copied!" : "Copy JSON"}
        </button>
      </div>

      {/* Tree */}
      <div
        style={{
          background:   "var(--at-surface-2)",
          border:       "1px solid var(--at-border-light)",
          borderRadius: "var(--radius-md)",
          padding:      "8px 4px 8px 2px",
          maxHeight:    "420px",
          overflowY:    "auto",
          overflowX:    "auto",
        }}
      >
        <JsonNode
          key={version}
          value={parsed}
          depth={0}
          last={true}
          expandDefault={expandDefault}
        />
      </div>
    </div>
  );
}
