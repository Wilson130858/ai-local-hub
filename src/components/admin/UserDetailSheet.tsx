import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCredits } from "@/lib/utils";
import { QuoteDialog } from "./QuoteDialog";
import { QuotesTimeline } from "./QuotesTimeline";
import type { ServiceQuote } from "@/lib/billing";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userName: string | null;
  credits: number;
  status: string;
};

export function UserDetailSheet({ open, onOpenChange, userId, userName, credits, status }: Props) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [quotes, setQuotes] = useState<ServiceQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data: tenant } = await supabase
      .from("tenants").select("id, business_name").eq("owner_id", userId).maybeSingle();
    if (tenant) {
      setTenantId(tenant.id);
      setTenantName(tenant.business_name);
      const { data: qs } = await supabase
        .from("service_quotes").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
      setQuotes((qs ?? []) as ServiceQuote[]);
    } else {
      setTenantId(null);
      setTenantName("");
      setQuotes([]);
    }
    setLoading(false);
  };

  useEffect(() => { if (open && userId) load(); }, [open, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{userName ?? "Cliente"}</SheetTitle>
          <SheetDescription>Perfil e gestão de faturamento</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="summary" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="billing">Faturamento</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4 space-y-3">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="outline" className="mt-1">{status}</Badge>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs text-muted-foreground">Créditos</p>
              <p className="mt-1 font-mono text-lg font-semibold">{formatCredits(credits)}</p>
            </div>
            {tenantName && (
              <div className="rounded-md border border-border p-4">
                <p className="text-xs text-muted-foreground">Negócio</p>
                <p className="mt-1 font-medium">{tenantName}</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="billing" className="mt-4 space-y-4">
            {!tenantId ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Este usuário ainda não tem um negócio configurado.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Adicionar serviço/orçamento
                  </Button>
                </div>
                {loading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <QuotesTimeline quotes={quotes} />
                )}
                <QuoteDialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  tenantId={tenantId}
                  tenantName={tenantName}
                  onCreated={load}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}