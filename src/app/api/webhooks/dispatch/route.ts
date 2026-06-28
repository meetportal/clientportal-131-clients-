import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { webhookUrl, payload } = await req.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Missing webhookUrl parameter" },
        { status: 400 }
      );
    }

    console.log(`[Webhook Proxy] Forwarding POST to: ${webhookUrl}`);

    // Call outbound URL with timeout handling (5 seconds)
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Sheet-Manager-Webhook-Dispatcher/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    const responseText = await response.text();

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 1000), // Avoid returning too much data
    });
  } catch (err) {
    console.error("[Webhook Proxy Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to dispatch webhook" },
      { status: 500 }
    );
  }
}
