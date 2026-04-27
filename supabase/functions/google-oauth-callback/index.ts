import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlResponse(title: string, message: string, success: boolean) {
  const color = success ? "#16a34a" : "#dc2626";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{max-width:420px;text-align:center;padding:32px;background:#16161d;border-radius:16px;border:1px solid #26262e}
h1{color:${color};margin:0 0 12px;font-size:22px}p{color:#a1a1aa;line-height:1.5}</style></head>
<body><div class="box"><h1>${title}</h1><p>${message}</p><p style="margin-top:24px;font-size:13px">Você já pode fechar esta janela.</p></div>
<script>setTimeout(()=>{try{window.opener&&window.opener.postMessage({type:'google-oauth',success:${success}},'*');window.close()}catch(e){}},800)</script>
</body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return htmlResponse("Conexão cancelada", `O Google retornou: ${error}`, false);
    }
    if (!code || !state) {
      return htmlResponse("Parâmetros inválidos", "Faltam code ou state.", false);
    }

    let parsed: { tenant_id: string; user_id: string };
    try {
      parsed = JSON.parse(atob(state));
    } catch {
      return htmlResponse("State inválido", "Não foi possível validar o state.", false);
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return htmlResponse("Configuração ausente", "Google Client ID/Secret não configurados.", false);
    }

    const projectId = Deno.env.get("SUPABASE_URL")!.split("//")[1].split(".")[0];
    const redirectUri = `https://${projectId}.functions.supabase.co/google-oauth-callback`;

    // Troca code por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return htmlResponse("Falha ao trocar tokens", tokenData.error_description || "Erro Google.", false);
    }

    const accessToken: string = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn: number = tokenData.expires_in ?? 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Busca email
    let email: string | null = null;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userInfoRes.ok) {
        const info = await userInfoRes.json();
        email = info.email ?? null;
      }
    } catch { /* ignore */ }

    // Salva no tenant via service role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const updatePayload: Record<string, unknown> = {
      google_access_token: accessToken,
      google_token_expires_at: expiresAt,
      google_email: email,
    };
    if (refreshToken) updatePayload.google_refresh_token = refreshToken;

    const { error: updErr } = await admin
      .from("tenants")
      .update(updatePayload)
      .eq("id", parsed.tenant_id)
      .eq("owner_id", parsed.user_id);

    if (updErr) {
      return htmlResponse("Erro ao salvar", updErr.message, false);
    }

    return htmlResponse("Google Calendar conectado!", `Conta ${email ?? ""} ligada com sucesso.`, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return htmlResponse("Erro inesperado", msg, false);
  }
});