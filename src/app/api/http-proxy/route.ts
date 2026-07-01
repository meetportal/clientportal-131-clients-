import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    followRedirects?: boolean;
    timeout?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { url, method = "GET", headers = {}, body: requestBody, followRedirects = true, timeout = 30000 } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const controller = new AbortController();
  const tid = globalThis.setTimeout(() => controller.abort(), Number(timeout));

  try {
    const opts: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      redirect: followRedirects ? "follow" : "manual",
    };

    if (requestBody !== undefined && requestBody !== null && method !== "GET" && method !== "HEAD") {
      opts.body = requestBody;
    }

    const response = await fetch(url, opts);
    globalThis.clearTimeout(tid);

    const responseText = await response.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: responseData,
    });
  } catch (error) {
    globalThis.clearTimeout(tid);
    const message = error instanceof Error ? error.message : "Request failed";
    const isTimeout = message.includes("abort") || message.includes("timeout");
    return NextResponse.json(
      { error: isTimeout ? "Request timed out" : message },
      { status: 500 },
    );
  }
}
