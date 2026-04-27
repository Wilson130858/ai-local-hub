// Edge function: Playground de teste do assistente do tenant.
// Usa Lovable AI Gateway (google/gemini-2.5-flash) para responder com o prompt construído a partir das configurações do tenant.
// CORS público; o JWT do usuário é validado e usado para garantir que o tenant pertence ao chamador.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMsg = { role: "user" | "assistant"; content: string };

interface AiConfig {
  assistant_name?: string;
  tone?: string;
  use_emojis?: boolean;
  golden_rules?: string;
  faq?: { question: string; answer: string }[];
  rules?: string;
}

function buildSystemPrompt(businessName: string, cfg: AiConfig): string {
  const name = cfg.assistant_name?.trim() || "Assistente";
  const tone = cfg.tone || "amigavel";
  const emojis = cfg.use_emojis ? "Use emojis com moderação." : "Não use emojis.";
  const golden = (cfg.golden_rules || cfg.rules || "").trim();
  const faq = Array.isArray(cfg.faq) ? cfg.faq.filter((f) => f?.question && f?.answer) : [];

  const faqBlock = faq.length
    ? faq.map((f, i) => `${i + 1}. P: ${f.question}\n   R: ${f.answer}`).join("\n")
    : "(nenhum item cadastrado)";

  return [
    `Você é "${name}", o atendente virtual de "${businessName}".`,
    `Tom de voz: ${tone}. ${emojis}`,
    `Responda sempre em português do Brasil, de forma curta e objetiva, como em uma conversa de WhatsApp.`,
    golden ? `\nREGRAS DE OURO (NUNCA QUEBRE):\n${golden}` : "",
    `\nBASE DE CONHECIMENTO (FAQ):\n${faqBlock}`,
    `\nSe não souber a resposta, diga que vai verificar com a equipe. Nunca invente preços, horários ou políticas que não estejam acima.`,
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const { tenant_id, messages, draft_config } = await req.json() as {
      tenant_id: string;
      messages: ChatMsg[];
      draft_config?: AiConfig;
    };

    if (!tenant_id || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Busca o tenant respeitando RLS (usa o JWT do usuário).
    const tRes = await fetch(`${SUPABASE_URL}/rest/v1/tenants?id=eq.${tenant_id}&select=business_name,ai_config`, {
      headers: { apikey: ANON, Authorization: authHeader },
    });
    if (!tRes.ok) {
      return new Response(JSON.stringify({ error: "tenant_fetch_failed" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const rows = await tRes.json() as { business_name: string; ai_config: AiConfig }[];
    if (!rows.length) {
      return new Response(JSON.stringify({ error: "tenant_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cfg = { ...(rows[0].ai_config || {}), ...(draft_config || {}) };
    const system = buildSystemPrompt(rows[0].business_name, cfg);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...messages.slice(-20)],
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(JSON.stringify({ error: "ai_failed", detail: text }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", detail: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});