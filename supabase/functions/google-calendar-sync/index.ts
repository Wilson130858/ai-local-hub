import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getFreshAccessToken(admin: ReturnType<typeof createClient>, tenantId: string) {
  const { data: tenant, error } = await admin
    .from("tenants")
    .select("google_access_token, google_refresh_token, google_token_expires_at, google_calendar_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !tenant) throw new Error("Tenant não encontrado");
  if (!tenant.google_refresh_token) throw new Error("Google Calendar não conectado");

  const expiresAt = tenant.google_token_expires_at ? new Date(tenant.google_token_expires_at).getTime() : 0;
  if (tenant.google_access_token && expiresAt - Date.now() > 60_000) {
    return { accessToken: tenant.google_access_token, calendarId: tenant.google_calendar_id || "primary" };
  }

  // refresh
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Credenciais Google ausentes");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tenant.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Refresh falhou: ${data.error_description || data.error}`);

  const newExpires = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await admin.from("tenants").update({
    google_access_token: data.access_token,
    google_token_expires_at: newExpires,
  }).eq("id", tenantId);

  return { accessToken: data.access_token as string, calendarId: tenant.google_calendar_id || "primary" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const body = await req.json();
    const { action, tenant_id } = body;
    if (!tenant_id || !action) {
      return new Response(JSON.stringify({ error: "tenant_id e action obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // verifica owner
    const { data: tenant } = await userClient.from("tenants").select("id, owner_id").eq("id", tenant_id).maybeSingle();
    if (!tenant || tenant.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { accessToken, calendarId } = await getFreshAccessToken(admin, tenant_id);
    const calApi = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;

    if (action === "list") {
      const { time_min, time_max } = body;
      const url = new URL(`${calApi}/events`);
      if (time_min) url.searchParams.set("timeMin", time_min);
      if (time_max) url.searchParams.set("timeMax", time_max);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "250");

      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(`Google list falhou: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ events: data.items ?? [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { summary, description, start, end, attendee_phone } = body;
      const res = await fetch(`${calApi}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary, description,
          start: { dateTime: start, timeZone: "America/Sao_Paulo" },
          end: { dateTime: end, timeZone: "America/Sao_Paulo" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Google create falhou: ${JSON.stringify(data)}`);

      await admin.from("appointments").insert({
        tenant_id,
        customer_name: summary,
        customer_phone: attendee_phone ?? null,
        title: summary,
        description: description ?? null,
        start_at: start,
        end_at: end,
        google_event_id: data.id,
        source: "panel",
      });

      return new Response(JSON.stringify({ event: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { event_id, summary, description, start, end } = body;
      const res = await fetch(`${calApi}/events/${event_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary, description,
          start: { dateTime: start, timeZone: "America/Sao_Paulo" },
          end: { dateTime: end, timeZone: "America/Sao_Paulo" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Google update falhou: ${JSON.stringify(data)}`);
      await admin.from("appointments").update({
        title: summary, description, start_at: start, end_at: end,
      }).eq("google_event_id", event_id).eq("tenant_id", tenant_id);
      return new Response(JSON.stringify({ event: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { event_id } = body;
      const res = await fetch(`${calApi}/events/${event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 410) {
        const txt = await res.text();
        throw new Error(`Google delete falhou: ${txt}`);
      }
      await admin.from("appointments").update({ status: "cancelled" }).eq("google_event_id", event_id).eq("tenant_id", tenant_id);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await admin.from("tenants").update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expires_at: null,
        google_email: null,
      }).eq("id", tenant_id);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});