import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Receipt, Search, AlertCircle, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCredits } from "@/lib/utils";
import { computeCurrentInvoice, isQuoteActiveInPeriod, formatDate, type ServiceQuote } from "@/lib/billing";
import { QuoteDialog } from "./QuoteDialog";
import { UserDetailSheet } from "./UserDetailSheet";

type TenantRow = {
  id: string;
  business_name: string;
  owner_id: string;
  billing_day: number;
};

type ProfileLite = { id: string; full_name: string | null; credits: number; status: string };

type ClientRow = {
  profile: ProfileLite;
  tenant: TenantRow | null;
};

type Filter = "all" | "pending" | "no_services" | "with_proration";

export function BillingOverview() {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [quotes, setQuotes] = useState<ServiceQuote[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteTenant, setQuoteTenant] = useState<TenantRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProfile, setDetailProfile] = useState<ProfileLite | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: tData }, { data: pData }, { data: qData }] = await Promise.all([
      supabase.from("tenants").select("id, business_name, owner_id, billing_day"),
      supabase.from("profiles").select("id, full_name, credits, status").order("created_at", { ascending: false }),
      supabase.from("service_quotes").select("*").order("created_at", { ascending: false }),
    ]);
    setTenants((tData ?? []) as TenantRow[]);
    setProfiles((pData ?? []) as ProfileLite[]);
    setQuotes((qData ?? []) as ServiceQuote[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ref = new Date();
  const today = ref.getDate();

  const aggregates = useMemo(() => {
    const tenantByOwner = new Map<string, TenantRow>();
    for (const t of tenants) tenantByOwner.set(t.owner_id, t);
    return profiles.map((profile) => {
      const tenant = tenantByOwner.get(profile.id) ?? null;
      const tenantQuotes = tenant ? quotes.filter((q) => q.tenant_id === tenant.id) : [];
      const accepted = tenantQuotes.filter((q) => q.status === "accepted");
      const active = accepted.filter((q) => isQuoteActiveInPeriod(q, ref));
      // Total cobrado neste mês (fatura corrente):
      // - mês de aceite com prorata > 0 → cobra apenas o proporcional
      // - demais meses → cobra valor cheio
      const { total } = computeCurrentInvoice(accepted, ref);
      // Mensalidade recorrente (valor cheio dos serviços ativos, informativo)
      const monthly = active.reduce((s, q) => s + q.amount, 0);
      // Quanto desse total veio de prorata neste mês
      const prorataMonth = accepted.reduce((s, q) => {
        if (!q.proration_amount || !q.decided_at) return s;
        const d = new Date(q.decided_at);
        if (d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()) {
          return s + q.proration_amount;
        }
        return s;
      }, 0);
      const pending = tenantQuotes.filter((q) => q.status === "pending").length;
      return {
        tenant,
        profile,
        activeCount: active.length,
        monthly,
        prorataMonth,
        total,
        pending,
      };
    });
  }, [tenants, quotes, profiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = aggregates.filter((row) => {
    const term = search.trim().toLowerCase();
    if (term) {
      const hay = `${row.tenant?.business_name ?? ""} ${row.profile?.full_name ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    if (filter === "pending") return row.pending > 0;
    if (filter === "no_services") return row.activeCount === 0;
    if (filter === "with_proration") return row.prorataMonth > 0;
    return true;
  });

  const totals = useMemo(() => {
    const revenue = aggregates.reduce((s, r) => s + r.total, 0);
    const pendingQuotes = quotes.filter((q) => q.status === "pending").length;
    const upcoming = aggregates.filter((r) => {
      if (!r.tenant) return false;
      const day = r.tenant.billing_day;
      const diff = day >= today ? day - today : 30 - today + day;
      return diff <= 7;
    }).length;
    return { revenue, pendingQuotes, upcoming };
  }, [aggregates, quotes, today]);

  const pendingGlobal = quotes.filter((q) => q.status === "pending");

  const openQuote = (t: TenantRow) => {
    setQuoteTenant(t);
    setQuoteOpen(true);
  };
  const openDetail = (p: ProfileLite) => {
    setDetailProfile(p);
    setDetailOpen(true);
  };

  const quoteTypeBadge = (q: ServiceQuote) => {
    if ((q.billing_type as string) === "billing_change") {
      return <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">Mudança de dia</Badge>;
    }
    if (q.billing_type === "lifetime") return <Badge variant="outline" className="text-[10px]">Único</Badge>;
    return <Badge variant="outline" className="text-[10px]">{q.recurrence_months ?? 1}x</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Receita prevista do mês</CardDescription>
            <CardTitle className="font-mono text-2xl">{formatCredits(totals.revenue)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Soma dos serviços ativos + prorratas do mês corrente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Propostas pendentes</CardDescription>
            <CardTitle className="text-2xl">{totals.pendingQuotes}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Aguardando aprovação dos clientes.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vencimentos em 7 dias</CardDescription>
            <CardTitle className="text-2xl">{totals.upcoming}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Clientes com cobrança próxima.
          </CardContent>
        </Card>
      </div>

      {/* Tabela de clientes */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Clientes & Faturamento
            </CardTitle>
            <CardDescription>Gestão financeira individual por cliente</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-56 pl-8"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Com pendências</SelectItem>
                <SelectItem value="no_services">Sem serviços ativos</SelectItem>
                <SelectItem value="with_proration">Com prorrata no mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Dia cobrança</TableHead>
                    <TableHead>Serviços ativos</TableHead>
                    <TableHead>Total mês</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.profile.id}>
                      <TableCell>
                        <div className="font-medium">{row.profile.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.tenant?.business_name ?? <span className="italic">Sem negócio configurado</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.tenant ? (
                          <Badge variant="outline" className="font-mono">
                            <CalendarClock className="mr-1 h-3 w-3" /> dia {row.tenant.billing_day}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{row.activeCount}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {formatCredits(row.monthly)}/mês
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCredits(row.total)}
                        {row.prorataMonth > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({formatCredits(row.prorataMonth)} prorrata)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {!row.tenant && (
                            <Badge variant="outline" className="text-[10px]">Sem negócio</Badge>
                          )}
                          {row.pending > 0 && (
                            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">
                              <AlertCircle className="mr-1 h-3 w-3" /> {row.pending} pendente{row.pending > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {row.tenant && row.activeCount === 0 && row.pending === 0 && (
                            <Badge variant="outline" className="text-[10px]">Sem serviços</Badge>
                          )}
                          {row.activeCount > 0 && row.pending === 0 && (
                            <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Em dia</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => row.tenant && openQuote(row.tenant)}
                            title={row.tenant ? "Adicionar serviço" : "Cliente sem negócio configurado"}
                            disabled={!row.tenant}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDetail(row.profile)}
                          >
                            Gerenciar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Propostas pendentes globais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Propostas aguardando aprovação
          </CardTitle>
          <CardDescription>Visão consolidada de todos os orçamentos pendentes</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingGlobal.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma proposta pendente no momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Enviado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingGlobal.map((q) => {
                    const tenant = tenants.find((t) => t.id === q.tenant_id);
                    const profile = tenant ? profiles.find((p) => p.id === tenant.owner_id) : undefined;
                    return (
                      <TableRow key={q.id}>
                        <TableCell>
                          <div className="font-medium">{tenant?.business_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{profile?.full_name ?? "—"}</div>
                        </TableCell>
                        <TableCell>{q.name}</TableCell>
                        <TableCell>{quoteTypeBadge(q)}</TableCell>
                        <TableCell className="font-mono">{formatCredits(q.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(q.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {quoteTenant && (
        <QuoteDialog
          open={quoteOpen}
          onOpenChange={setQuoteOpen}
          tenantId={quoteTenant.id}
          tenantName={quoteTenant.business_name}
          onCreated={load}
        />
      )}

      <UserDetailSheet
        open={detailOpen}
        onOpenChange={(v) => { setDetailOpen(v); if (!v) load(); }}
        userId={detailProfile?.id ?? null}
        userName={detailProfile?.full_name ?? null}
        credits={detailProfile?.credits ?? 0}
        status={detailProfile?.status ?? ""}
        defaultTab="billing"
      />
    </div>
  );
}