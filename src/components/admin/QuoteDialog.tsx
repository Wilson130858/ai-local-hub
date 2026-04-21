import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { parseReaisToCents } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  tenantName: string;
  onCreated: () => void;
};

export function QuoteDialog({ open, onOpenChange, tenantId, tenantName, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [billingType, setBillingType] = useState<"recurring" | "lifetime">("recurring");
  const [months, setMonths] = useState("12");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(""); setDescription(""); setAmount("");
    setBillingType("recurring"); setMonths("12");
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    const cents = parseReaisToCents(amount);
    if (!cents || cents <= 0) return toast.error("Valor inválido");
    let recurrence_months: number | null = null;
    if (billingType === "recurring") {
      recurrence_months = parseInt(months);
      if (!recurrence_months || recurrence_months < 1 || recurrence_months > 60) {
        return toast.error("Meses deve ser entre 1 e 60");
      }
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-actions", {
      body: {
        action: "create_quote",
        tenant_id: tenantId,
        name: name.trim(),
        description: description.trim() || null,
        amount: cents,
        billing_type: billingType,
        recurrence_months,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if ((data as { error?: string })?.error) return toast.error((data as { error: string }).error);
    toast.success("Orçamento enviado ao cliente");
    reset();
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
          <DialogDescription>Para {tenantName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do serviço</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Setup avançado" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="100,00" />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup value={billingType} onValueChange={(v) => setBillingType(v as "recurring" | "lifetime")} className="grid grid-cols-2 gap-2">
              <Label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 hover:bg-muted/40 [&:has([data-state=checked])]:border-primary">
                <RadioGroupItem value="recurring" /> <span className="text-sm">Recorrência</span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 hover:bg-muted/40 [&:has([data-state=checked])]:border-primary">
                <RadioGroupItem value="lifetime" /> <span className="text-sm">Vitalício</span>
              </Label>
            </RadioGroup>
          </div>
          {billingType === "recurring" && (
            <div className="space-y-1.5">
              <Label>Quantidade de meses</Label>
              <Input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}