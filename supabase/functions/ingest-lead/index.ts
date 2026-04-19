// Public endpoint for n8n to POST leads.
// Auth: header `x-api-key` must equal env N8N_INGEST_API_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    const expected = Deno.env.get("N8N_INGEST_API_KEY");
    if (!expected || apiKey !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { tenant_id, name, phone, status, origin, original_query } = body ?? {};

    if (!tenant_id || !name || !phone) {
      return new Response(JSON.stringify({ error: "tenant_id, name, phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (status && !["pendente", "agendado", "cancelado"].includes(status)) {
      return new Response(JSON.stringify({ error: "invalid status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("leads")
      .insert({
        tenant_id,
        name,
        phone,
        status: status ?? "pendente",
        origin: origin ?? "n8n",
        original_query: original_query ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, lead: data }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
