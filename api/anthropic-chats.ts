// File: api/anthropic-chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Strict origin allowlist
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3100",
  "https://well-fit-community-daily-com-git-32b23e-maria-leblancs-projects.vercel.app",
  "https://wellfitcommunity.live",
  "https://www.wellfitcommunity.live",
  "https://thewellfitcommunity.org",
  "https://legendary-space-goggles-g46697v595q4c757-3100.app.github.dev",
]);

function cors(res: VercelResponse, origin?: string) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, x-client-info, authorization"
  );
  // If you ever need cookies:
  // res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req.headers.origin);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Server not configured (missing ANTHROPIC_API_KEY)" });
  }

  try {
    const {
      messages,
      model = "claude-3-7-sonnet-20250219",
      max_tokens = 1024,
      system,
    } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages[] in body" });
    }

    // Anthropic Messages API request
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        system,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const text = await anthropicRes.text();
      return res
        .status(anthropicRes.status)
        .json({ error: "Anthropic error", detail: text });
    }

    const data = await anthropicRes.json();
    return res.status(200).json(data);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Proxy error", detail: String(err?.message || err) });
  }
}
