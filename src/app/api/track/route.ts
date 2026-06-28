/**
 * /api/track/route.ts
 *
 * Two-purpose tracking endpoint:
 *
 * GET  /api/track?id=TOKEN
 *   — Public redirect handler. Called when a certificate recipient clicks
 *     their link in the email.
 *   — Records a ClickEvent against the TrackedLink in the DB.
 *   — Returns a 302 redirect to the real Drive URL.
 *   — NEVER exposes the Drive URL in a client-readable response body.
 *
 * POST /api/track
 *   — Registration endpoint. Called by CertificateMerge before sending email.
 *   — Creates a new TrackedLink record with empty clicks[].
 *   — Returns { trackingUrl: "/api/track?id=TOKEN" }
 *
 * DELETE /api/track?id=TOKEN
 *   — Removes a single TrackedLink record (admin action from ClickAnalyticsPanel).
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { TrackedLink, ClickEvent } from "@/types/tracking";

// ── Shared DB helpers (mirrors pattern from /api/db/route.ts) ─────────────────

const SCRATCH_DIR = path.join(process.cwd(), "scratch");
const DB_FILE = path.join(SCRATCH_DIR, "sheet_db.json");

async function ensureScratchDir() {
  try {
    await fs.mkdir(SCRATCH_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

/**
 * Loads the full DB state and returns the trackedLinks array.
 * Falls back to empty array if not found.
 */
async function loadTrackedLinks(): Promise<{ dbState: Record<string, unknown>; links: TrackedLink[] }> {
  // 1. Upstash Redis
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/sheet_db_state`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result) {
          const state = JSON.parse(json.result) as Record<string, unknown>;
          return { dbState: state, links: (state.trackedLinks as TrackedLink[]) ?? [] };
        }
      }
    } catch (err) {
      console.error("[/api/track] Upstash load failed:", err);
    }
  }

  // 2. Local file
  try {
    await ensureScratchDir();
    const raw = await fs.readFile(DB_FILE, "utf-8");
    const state = JSON.parse(raw) as Record<string, unknown>;
    return { dbState: state, links: (state.trackedLinks as TrackedLink[]) ?? [] };
  } catch {
    // file not found — first run
  }

  return { dbState: {}, links: [] };
}

/**
 * Saves the full DB state back, updating only the trackedLinks field.
 */
async function saveTrackedLinks(
  dbState: Record<string, unknown>,
  links: TrackedLink[]
): Promise<void> {
  const nextState = { ...dbState, trackedLinks: links };

  // 1. Upstash Redis
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const res = await fetch(kvUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kvToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["SET", "sheet_db_state", JSON.stringify(nextState)]),
      });
      if (res.ok) return;
    } catch (err) {
      console.error("[/api/track] Upstash save failed:", err);
    }
  }

  // 2. Local file fallback
  try {
    await ensureScratchDir();
    await fs.writeFile(DB_FILE, JSON.stringify(nextState, null, 2), "utf-8");
  } catch (err) {
    console.error("[/api/track] Local file save failed:", err);
    // In-memory state is lost after request — acceptable for this edge case
  }
}

// ── GET /api/track?id=TOKEN ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("id");

  if (!token) {
    return NextResponse.json({ error: "Missing tracking token" }, { status: 400 });
  }

  const { dbState, links } = await loadTrackedLinks();
  const linkIdx = links.findIndex((l) => l.token === token);

  if (linkIdx === -1) {
    // Token not found — could be expired, tampered, or from an old DB
    // Return a generic 404 page rather than exposing token details
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>Link not found</h2>
        <p>This certificate link may have expired or is no longer valid.</p>
       </body></html>`,
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  const link = links[linkIdx];

  // Record the click event
  const clickEvent: ClickEvent = {
    clickedAt: new Date().toISOString(),
    userAgent: req.headers.get("user-agent") ?? "unknown",
  };

  const updatedLink: TrackedLink = {
    ...link,
    clicks: [...link.clicks, clickEvent],
  };

  const updatedLinks = [...links];
  updatedLinks[linkIdx] = updatedLink;

  // Fire-and-forget save — redirect must not wait for DB write to succeed
  // If save fails, click is lost but UX is not harmed (redirect still happens)
  saveTrackedLinks(dbState, updatedLinks).catch((err) =>
    console.error("[/api/track] Click save failed (redirect still succeeded):", err)
  );

  // 302 redirect to the real Drive URL
  return NextResponse.redirect(link.driveUrl, { status: 302 });
}

// ── POST /api/track ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      token: string;
      recipientName: string;
      recipientEmail: string;
      rowIndex: number;
      driveUrl: string;
      sentAt: string;
    };

    // Validate required fields
    if (!body.token || !body.recipientEmail || !body.driveUrl) {
      return NextResponse.json(
        { error: "Missing required fields: token, recipientEmail, driveUrl" },
        { status: 400 }
      );
    }

    const { dbState, links } = await loadTrackedLinks();

    // Prevent duplicate token registration (idempotent)
    if (links.some((l) => l.token === body.token)) {
      return NextResponse.json(
        { trackingUrl: `/api/track?id=${encodeURIComponent(body.token)}` },
        { status: 200 }
      );
    }

    const newLink: TrackedLink = {
      token: body.token,
      recipientName: body.recipientName,
      recipientEmail: body.recipientEmail,
      rowIndex: body.rowIndex,
      driveUrl: body.driveUrl,
      sentAt: body.sentAt,
      clicks: [],
    };

    await saveTrackedLinks(dbState, [...links, newLink]);

    return NextResponse.json({
      trackingUrl: `/api/track?id=${encodeURIComponent(body.token)}`,
    });
  } catch (err) {
    console.error("[/api/track] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to register tracking link" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/track?id=TOKEN ────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("id");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const { dbState, links } = await loadTrackedLinks();
  const filtered = links.filter((l) => l.token !== token);

  if (filtered.length === links.length) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await saveTrackedLinks(dbState, filtered);
  return NextResponse.json({ success: true, removed: token });
}
