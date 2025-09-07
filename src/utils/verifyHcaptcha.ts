import { supabase } from '../lib/supabaseClient';

export async function verifyHcaptchaToken(token: string, sitekey?: string) {
  const { data, error } = await supabase.functions.invoke('verify-hcaptcha', {
    body: sitekey ? { token, sitekey } : { token },
  });

  if (error) throw new Error(error.message || 'hCaptcha verify call failed');
  if (!data?.success) throw new Error('hCaptcha failed');

  return true;
}
