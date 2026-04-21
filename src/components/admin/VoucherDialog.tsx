import { useEffect, useState } from "react";
import { Loader2, Pause, Play, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatCredits } from "@/lib/utils";

export type VoucherDialogItem = {
  id: string;
  code: string;
  value: number;
  is_used: boolean;
  is_paused: boolean;
  max_uses: number | null;
  uses_count: number;
  created_at: string;
};

type Redemption = {
  redeemed_at: string;
  user_id: string;
  value_at_redemption: number;
  user_name: string | null;
};

export function VoucherDialog({
  voucher,
  open,
  onOpenChange,
  onChanged,
}: {
  voucher: VoucherDialogItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !voucher) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: reds } = await supabase
        .from("voucher_redemptions")
        .select("redeemed_at, user_id, value_at_redemption")
        .eq("voucher_id", voucher.id)
        .order("redeemed_at", { ascending: false });
      const ids = Array.from(new Set((reds ?? []).map((r) => r.user_id)));
      let names: Record<string, string | null> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));
      }
      if (cancelled) return;
      setRedemptions((reds ?? []).map((r) => ({ ...r, user_name: names[r.user_id] ?? null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, voucher]);

  if (!voucher) return null;

  const togglePause = async () => {
    setBusy(true);
    const next = !voucher.is_paused;
    const { error } = await supabase.from("credit_vouchers").update({ is_paused: next }).eq("id", voucher.id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("audit_logs").insert({
        admin_id: user!.id,
        action: next ? "pause_voucher" : "resume_voucher",
        details: { voucher_id: voucher.id, code: voucher.code },
      });
      toast.success(next ? "Voucher pausado" : "Voucher ativado");
      onChanged();
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("credit_vouchers").delete().eq("id", voucher.id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("audit_logs").insert({
        admin_id: user!.id,
        action: "delete_voucher",
        details: { voucher_id: voucher.id, code: voucher.code },
      });
      toast.success("Voucher excluído");
      onOpenChange(false);
      onChanged();
    }
    setBusy(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(voucher.code);
    toast.success("Código copiado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{voucher.code}</code>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {voucher.is_paused && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">Pausado</Badge>}
            {voucher.is_used && <Badge variant="outline">Esgotado</Badge>}
          </DialogTitle>
          <DialogDescription>
            Valor {formatCredits(voucher.value)} · Usos {voucher.uses_count}/{voucher.max_uses ?? "∞"} · Criado em{" "}
            {format(new Date(voucher.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Histórico de resgates</h4>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : redemptions.length === 0 ? (
            <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              Nenhum resgate ainda
            </p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redemptions.map((r, i) => (
                    <TableRow key={`${r.user_id}-${i}`}>
                      <TableCell className="font-medium">{r.user_name ?? r.user_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.redeemed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCredits(r.value_at_redemption)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={busy}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir este voucher?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação remove o código <strong>{voucher.code}</strong> e todo o histórico de resgates dele. Não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={togglePause} disabled={busy}>
              {voucher.is_paused ? (
                <><Play className="mr-1.5 h-4 w-4" /> Ativar</>
              ) : (
                <><Pause className="mr-1.5 h-4 w-4" /> Pausar</>
              )}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}