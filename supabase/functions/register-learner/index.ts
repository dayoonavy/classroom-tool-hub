import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (Number(request.headers.get("content-length") || 0) > 2048) return reply(413, { error: "request_too_large" });

  let payload: { username?: unknown; password?: unknown };
  try { payload = await request.json(); }
  catch { return reply(400, { error: "invalid_request" }); }

  const username = typeof payload.username === "string" ? payload.username.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!/^[a-z0-9._-]{3,20}$/.test(username) || password.length < 8 || password.length > 128) {
    return reply(400, { error: "invalid_credentials_format" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(500, { error: "registration_unavailable" });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.auth.admin.createUser({
    email: `${username}@students.mathplay.invalid`,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) {
    const duplicate = /already|registered|exists/i.test(error.message);
    return reply(duplicate ? 409 : 400, { error: duplicate ? "username_unavailable" : "registration_failed" });
  }
  return reply(201, { ok: true });
});
