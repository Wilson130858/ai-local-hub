import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Send, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  tenantId: string | null;
  draftConfig: Record<string, unknown>;
}

export function AIPlayground({ tenantId, draftConfig }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!tenantId) {
      toast.error("Configure seu negócio antes de testar.");
      return;
    }
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-playground", {
        body: { tenant_id: tenantId, messages: next, draft_config: draftConfig },
      });
      if (error) throw error;
      const result = data as { reply?: string; error?: string };
      if (result.error === "rate_limited") return toast.error("Muitas mensagens. Aguarde alguns segundos.");
      if (result.error === "credits_exhausted") return toast.error("Créditos de IA esgotados.");
      if (!result.reply) return toast.error("Sem resposta da IA.");
      setMessages([...next, { role: "assistant", content: result.reply }]);
    } catch (e) {
      toast.error("Falha ao consultar a IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-[600px] flex-col overflow-hidden border-border/60 shadow-soft">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Testar Assistente</p>
          <p className="text-[11px] text-muted-foreground">Simula como a IA responderá no WhatsApp.</p>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-[hsl(var(--muted))]/30" viewportRef={scrollRef}>
        <div className="flex flex-col gap-3 p-4">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Envie uma mensagem para testar seu assistente.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "rounded-br-sm bg-success/90 text-white"
                    : "rounded-bl-sm bg-card text-foreground border border-border"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10">
                  <UserIcon className="h-3.5 w-3.5 text-success" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Assistente digitando...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-background p-3">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Digite uma mensagem..."
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          As respostas aqui simulam como a IA agirá no WhatsApp baseada nas regras salvas ao lado.
        </p>
      </div>
    </Card>
  );
}