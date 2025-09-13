// src/utils/verifyHcaptcha.ts
import { supabase } from "../lib/supabaseClient";

type VerifyResp = { success?: boolean; "error-codes"?: string[] };

export async function verifyHcaptchaToken(token: string, sitekey?: string): Promise<void> {
  if (!token) throw new Error("Please complete the captcha.");

  const { data, error } = await supabase.functions.invoke<VerifyResp>("verify-hcaptcha", {
    body: sitekey ? { token, sitekey } : { token },
  });

  if (error) {
    throw new Error(error.message || "hCaptcha verification failed");
  }
  if (!data?.success) {
    const codes = data?.["error-codes"]?.join(", ") || "";
    throw new Error(codes ? `hCaptcha failed (${codes})` : "hCaptcha failed");
  }
}
