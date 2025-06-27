import { serve } from "https://deno.land/std@0.183.0/http/server.ts";

interface RegisterBody {
  phone: string;
  password: string;
  first_name: string;
  last_name: string;
  email?: string;
  consent?: boolean;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string) {
  const encoder = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    passKey,
    256
  );
  const hash = new Uint8Array(bits);
  return `${toHex(salt)}:${toHex(hash)}`;
}

serve(async (req: Request) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const body: RegisterBody = await req.json();

    for (const field of ["phone", "password", "first_name", "last_name"] as const) {
      const v = body[field];
      if (!v || typeof v !== "string" || !v.trim()) {
        return new Response(
          JSON.stringify({ error: `${field.replace("_", " ")} is required.` }),
          { status: 400, headers }
        );
      }
    }

    const p = body.password;
    const rules = [
      { r: /.{8,}/, m: "at least 8 characters" },
      { r: /[A-Z]/, m: "one uppercase letter" },
      { r: /\d/, m: "one number" },
      { r: /[^A-Za-z0-9]/, m: "one special character" },
    ];
    const bad = rules.filter(x => !x.r.test(p)).map(x => x.m);
    if (bad.length) {
      return new Response(
        JSON.stringify({ error: `Password must contain ${bad.join(", ")}.` }),
        { status: 400, headers }
      );
    }

    // ✅ Secure environment var loading
    const URL = Deno.env.get("SB_URL");
    const KEY = Deno.env.get("SB_SERVICE_ROLE");

    // ✅ Safety tip: don't log keys, just confirm presence
    console.log("✅ SB_URL loaded:", !!URL);
    console.log("✅ SB_SERVICE_ROLE loaded:", !!KEY);

    if (!URL || !KEY) {
      throw new Error("Missing SB_URL or SB_SERVICE_ROLE secret");
    }

    const password_hash = await hashPassword(body.password);

    // 🔍 Check uniqueness
    const check = await fetch(
      `${URL}/rest/v1/profiles?phone=eq.${encodeURIComponent(body.phone)}`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
        },
      }
    );
    if (!check.ok) {
      throw new Error(`Lookup failed: ${await check.text()}`);
    }
    if ((await check.json()).length > 0) {
      return new Response(
        JSON.stringify({ error: "Phone already registered." }),
        { status: 409, headers }
      );
    }

    // ➕ Insert into DB
    const insertRes = await fetch(`${URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        phone: body.phone,
        password_hash,
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email ?? null,
        consent: Boolean(body.consent),
        phone_verified: false,
        email_verified: false,
        created_at: new Date().toISOString(),
      }),
    });

    const inserted = await insertRes.json();

    if (!insertRes.ok) {
      console.error("❌ Insert error:", inserted);
      throw new Error(`Insert failed: ${JSON.stringify(inserted)}`);
    }

    const user_id = inserted[0]?.id;
    return new Response(JSON.stringify({ success: true, user_id }), {
      status: 201,
      headers,
    });

  } catch (err) {
    console.error("❌ register error:", err);
    const errorMessage =
      err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message
        : String(err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: errorMessage }),
      { status: 500, headers }
    );
  }
});
