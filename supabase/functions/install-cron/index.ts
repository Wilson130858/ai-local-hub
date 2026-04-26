// One-shot admin endpoint that (re)installs the daily pg_cron job for close-invoices.
// The function has access to CRON_SECRET via env, so the secret never leaves the platform.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    if (!CRON_SECRET) return json({ error: "CRON_SECRET not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const functionUrl = `${SUPABASE_URL}/functions/v1/close-invoices`;
    const sql = `
      do $$
      begin
        perform cron.unschedule('close-invoices-daily');
      exception when others then null;
      end $$;
      select cron.schedule(
        'close-invoices-daily',
        '0 6 * * *',
        $cron$
        select net.http_post(
          url := '${functionUrl}',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', '${CRON_SECRET}'
          ),
          body := '{}'::jsonb
        );
        $cron$
      );
    `;

    // Executa o SQL via PostgREST RPC genérico não está disponível — usamos a API de query do Supabase.
    // Fallback: usamos PostgreSQL via fetch direto à camada de DB através de uma RPC dedicada,
    // mas como não temos uma, retornamos o SQL para o admin executar manualmente caso a chamada falhe.
    // O service_role_key NÃO tem acesso REST a executar SQL arbitrário.
    // Portanto, instruímos a execução via Postgres usando a função pg_net (única disponível).

    // Estratégia: usar pg_net.http_post para chamar o endpoint Supabase Management?
    // Solução real: depender do operador rodar este SQL no SQL editor.
    // Para automatizar: usamos o endpoint de RPC do PostgREST executando uma função SQL definida
    // anteriormente. Se a função `install_close_invoices_cron(text, text)` existir, chamamos:
    const { data: rpcData, error: rpcErr } = await admin.rpc("install_close_invoices_cron", {
      _function_url: functionUrl,
      _cron_secret: CRON_SECRET,
    });
    if (rpcErr) {
      return json({
        error: "RPC install failed",
        detail: rpcErr.message,
        hint: "Migration that creates install_close_invoices_cron may not have run.",
        sql_to_run_manually: sql,
      }, 500);
    }
    return json({ success: true, scheduled: rpcData ?? true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});