/**
 * appUrl.ts
 *
 * Single source of truth for the application's base URL across all environments.
 *
 * Priority order (client-side):
 *  1. NEXT_PUBLIC_APP_URL         — explicitly set (local dev + Vercel production)
 *  2. NEXT_PUBLIC_VERCEL_URL      — auto-injected by Vercel for preview deployments
 *  3. window.location.origin      — runtime fallback (works in any browser context)
 *
 * Priority order (server-side, e.g. in API route.ts):
 *  1. NEXT_PUBLIC_APP_URL
 *  2. NEXT_PUBLIC_VERCEL_URL      — Vercel injects this as plain hostname (no protocol)
 *  3. "http://localhost:3000"     — hard fallback for local server-side rendering
 *
 * Usage:
 *   import { getAppBaseUrl } from "@/utils/appUrl";
 *   const base = getAppBaseUrl();                    // "https://your-app.vercel.app"
 *   const trackUrl = `${base}/api/track?id=TOKEN`;
 */

/**
 * Returns the canonical base URL of this application.
 * Safe to call from both browser code and server-side API routes.
 */
export function getAppBaseUrl(): string {
  // 1. Explicit env variable — highest priority, works everywhere
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""); // strip trailing slash
  }

  // 2. Vercel preview deployments inject NEXT_PUBLIC_VERCEL_URL as a bare hostname
  //    e.g. "my-app-git-feat-tracking-myorg.vercel.app"
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 3. Runtime browser fallback
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 4. Server-side hard fallback (only hit if none of the above are set)
  return "http://localhost:3000";
}

/**
 * Builds a fully-qualified tracking URL for a given token.
 * This is the URL placed in outgoing emails.
 *
 * Example output: "https://sheet-manager.vercel.app/api/track?id=tl_1719510123_k7m2p"
 */
export function buildTrackingUrl(token: string): string {
  return `${getAppBaseUrl()}/api/track?id=${encodeURIComponent(token)}`;
}
