import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, Sparkles, ShieldAlert, HelpCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AIPlayground } from "./AIPlayground";

type FaqItem = { question: string; answer: string };

interface AiConfigState {
  assistant_name: string;
  tone: string;
  use_emojis: boolean;
  golden_rules: string;
  faq: FaqItem[];
}

const DEFAULT_CONFIG: AiConfigState = {
  assistant_name: "Assistente",
  tone: "amigavel",
  use_emojis: true,
  golden_rules: "",
  faq: [],
};

const TONES = [
  { value: "formal", label: "Formal" },
  { value: "amigavel", label: "Amigável" },
  { value: "descontraido", label: "Descontraído" },
  { value: "direto", label: "Direto" },
];

export function AITrainingPanel() {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [config, setConfig] = useState<AiConfigState>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, ai_config")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        setTenantId(data.id);
        const raw = (data.ai_config ?? {}) as Partial<AiConfigState> & { rules?: string };
        setConfig({
          assistant_name: raw.assistant_name ?? "Assistente",
          tone: raw.tone ?? "amigavel",
          use_emojis: raw.use_emojis ?? true,
          golden_rules: raw.golden_rules ?? raw.rules ?? "",
          faq: Array.isArray(raw.faq) ? raw.faq : [],
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    const { error } = await supabase
      .from("tenants")
      // ai_config é jsonb; passamos o objeto como qualquer para satisfazer o tipo gerado.
      .update({ ai_config: config as unknown as never })
      .eq("id", tenantId);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Treinamento salvo! A IA será atualizada em ~30s.");
  };

  const addFaq = () => setConfig((c) => ({ ...c, faq: [...c.faq, { question: "", answer: "" }] }));
  const updFaq = (i: number, field: keyof FaqItem, v: string) =>
    setConfig((c) => ({ ...c, faq: c.faq.map((f, idx) => (idx === i ? { ...f, [field]: v } : f)) }));
  const rmFaq = (i: number) =>
    setConfig((c) => ({ ...c, faq: c.faq.filter((_, idx) => idx !== i) }));

  if (loading) {
    return (
      <Card className="flex h-64 items-center justify-center border-border/60 shadow-soft">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!tenantId) {
    return (
      <Card className="border-border/60 p-6 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">
          Você ainda não possui um negócio configurado. Entre em contato com o suporte para começar.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Coluna esquerda: configurações */}
      <Card className="border-border/60 p-6 shadow-soft">
        <Accordion type="multiple" defaultValue={["personality", "rules", "faq"]} className="space-y-2">
          <AccordionItem value="personality" className="rounded-lg border border-border px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold">Personalidade</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome do assistente</Label>
                <Input
                  value={config.assistant_name}
                  onChange={(e) => setConfig({ ...config, assistant_name: e.target.value })}
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label>Tom de voz</Label>
                <Select value={config.tone} onValueChange={(v) => setConfig({ ...config, tone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-3">
                <div>
                  <p className="text-sm font-medium">Usar emojis</p>
                  <p className="text-xs text-muted-foreground">A IA pode incluir emojis nas respostas.</p>
                </div>
                <Switch
                  checked={config.use_emojis}
                  onCheckedChange={(v) => setConfig({ ...config, use_emojis: v })}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rules" className="rounded-lg border border-border px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold">Regras de Ouro (limites)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <p className="mb-2 text-xs text-muted-foreground">
                Liste o que a IA NUNCA deve fazer. Ex: "Nunca dar descontos", "Nunca diagnosticar".
              </p>
              <Textarea
                value={config.golden_rules}
                onChange={(e) => setConfig({ ...config, golden_rules: e.target.value })}
                rows={6}
                placeholder="- Nunca prometer prazos.&#10;- Nunca dar descontos fora da tabela."
                className="resize-none font-mono text-sm"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq" className="rounded-lg border border-border px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Perguntas Frequentes</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {config.faq.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhuma pergunta cadastrada. Adicione informações como wi-fi, estacionamento, formas de pagamento.
                </p>
              )}
              {config.faq.map((f, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Pergunta {i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => rmFaq(i)} className="h-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={f.question}
                    onChange={(e) => updFaq(i, "question", e.target.value)}
                    placeholder="Ex: Vocês têm estacionamento?"
                  />
                  <Textarea
                    value={f.answer}
                    onChange={(e) => updFaq(i, "answer", e.target.value)}
                    placeholder="Ex: Sim, gratuito para clientes."
                    rows={2}
                    className="resize-none"
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addFaq} className="w-full gap-2">
                <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar treinamento
          </Button>
        </div>
      </Card>

      {/* Coluna direita: playground */}
      <AIPlayground tenantId={tenantId} draftConfig={config as unknown as Record<string, unknown>} />
    </div>
  );
}