import { useEffect, useMemo, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CalendarDays, Plus, RefreshCw, LinkIcon, Unlink, Trash2 } from "lucide-react";

type GEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

type ViewMode = "day" | "week" | "month";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

const Agenda = () => {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<GEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Date>(new Date());
  const [view, setView] = useState<ViewMode>("week");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", date: "", start: "09:00", end: "10:00" });

  // Carrega tenant do usuário
  useEffect(() => {
    if (!user) return;
    supabase.from("tenants").select("id, google_email, google_refresh_token").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTenantId(data.id);
          setConnected(!!data.google_refresh_token);
          setGoogleEmail(data.google_email ?? null);
        }
      });
  }, [user]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "day") return { rangeStart: startOfDay(selected), rangeEnd: endOfDay(selected) };
    if (view === "week") {
      const day = selected.getDay();
      const s = startOfDay(addDays(selected, -day));
      return { rangeStart: s, rangeEnd: endOfDay(addDays(s, 6)) };
    }
    const s = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const e = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 23, 59, 59, 999);
    return { rangeStart: s, rangeEnd: e };
  }, [selected, view]);

  const loadEvents = useCallback(async () => {
    if (!tenantId || !connected) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: {
        action: "list",
        tenant_id: tenantId,
        time_min: rangeStart.toISOString(),
        time_max: rangeEnd.toISOString(),
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setEvents(data?.events ?? []);
  }, [tenantId, connected, rangeStart, rangeEnd]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Listener para retorno do popup OAuth
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "google-oauth") {
        if (e.data.success) {
          toast.success("Google Calendar conectado!");
          // recarrega estado
          if (user) {
            supabase.from("tenants").select("id, google_email, google_refresh_token").eq("owner_id", user.id).maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setConnected(!!data.google_refresh_token);
                  setGoogleEmail(data.google_email ?? null);
                }
              });
          }
        } else {
          toast.error("Falha ao conectar o Google Calendar");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [user]);

  const connectGoogle = async () => {
    if (!tenantId) return toast.error("Nenhum negócio encontrado para sua conta");
    const { data, error } = await supabase.functions.invoke("google-oauth-start", {
      body: { tenant_id: tenantId },
    });
    if (error || data?.error) return toast.error(error?.message || data.error);
    const w = window.open(data.auth_url, "google_oauth", "width=520,height=640");
    if (!w) toast.error("Permita popups para conectar o Google");
  };

  const disconnectGoogle = async () => {
    if (!tenantId) return;
    const { error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "disconnect", tenant_id: tenantId },
    });
    if (error) return toast.error(error.message);
    setConnected(false); setGoogleEmail(null); setEvents([]);
    toast.success("Google Calendar desconectado");
  };

  const createEvent = async () => {
    if (!tenantId) return;
    if (!form.title || !form.date) return toast.error("Preencha título e data");
    const start = new Date(`${form.date}T${form.start}:00`).toISOString();
    const end = new Date(`${form.date}T${form.end}:00`).toISOString();
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "create", tenant_id: tenantId, summary: form.title, description: form.description, start, end },
    });
    if (error || data?.error) return toast.error(error?.message || data.error);
    toast.success("Agendamento criado!");
    setDialogOpen(false);
    setForm({ title: "", description: "", date: "", start: "09:00", end: "10:00" });
    loadEvents();
  };

  const deleteEvent = async (eventId: string) => {
    if (!tenantId) return;
    const { error, data } = await supabase.functions.invoke("google-calendar-sync", {
      body: { action: "delete", tenant_id: tenantId, event_id: eventId },
    });
    if (error || data?.error) return toast.error(error?.message || data.error);
    toast.success("Evento removido");
    loadEvents();
  };

  // Agrupa eventos por dia
  const grouped = useMemo(() => {
    const map = new Map<string, GEvent[]>();
    events.forEach((e) => {
      const dt = e.start?.dateTime || e.start?.date;
      if (!dt) return;
      const d = new Date(dt);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  return (
    <DashboardLayout title="Agenda">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Agenda
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie seus agendamentos e sincronize com o Google Calendar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                {googleEmail ?? "Conectado"}
              </Badge>
              <Button variant="outline" size="sm" onClick={loadEvents} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={disconnectGoogle}>
                <Unlink className="h-4 w-4 mr-1" /> Desconectar
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo agendamento</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo agendamento</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Título</Label>
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Corte - João" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Descrição</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Início</Label><Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Fim</Label><Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={createEvent}>Criar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Button onClick={connectGoogle}>
              <LinkIcon className="h-4 w-4 mr-2" /> Conectar Google Calendar
            </Button>
          )}
        </div>
      </div>

      {!connected ? (
        <Card className="border-dashed border-border/60 p-10 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h3 className="mt-4 text-lg font-semibold">Conecte seu Google Calendar</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Visualize e gerencie seus agendamentos direto aqui. Seus tokens ficam seguros e só você tem acesso à sua agenda.
          </p>
          <Button className="mt-6" onClick={connectGoogle}>
            <LinkIcon className="h-4 w-4 mr-2" /> Conectar agora
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="border-border/60 p-4 shadow-soft">
            <Calendar mode="single" selected={selected} onSelect={(d) => d && setSelected(d)} className="rounded-md" />
          </Card>

          <Card className="border-border/60 p-4 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {view === "day" && selected.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                {view === "week" && `Semana de ${rangeStart.toLocaleDateString("pt-BR")} a ${rangeEnd.toLocaleDateString("pt-BR")}`}
                {view === "month" && selected.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </h3>
              <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
                <TabsList>
                  <TabsTrigger value="day">Dia</TabsTrigger>
                  <TabsTrigger value="week">Semana</TabsTrigger>
                  <TabsTrigger value="month">Mês</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhum evento no período selecionado.</div>
            ) : (
              <div className="space-y-4">
                {Array.from(grouped.entries())
                  .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                  .map(([dayKey, evs]) => {
                    const dayDate = new Date(dayKey);
                    const isToday = sameDay(dayDate, new Date());
                    return (
                      <div key={dayKey}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {dayDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                          </span>
                          {isToday && <Badge variant="secondary" className="text-xs">Hoje</Badge>}
                        </div>
                        <div className="space-y-2">
                          {evs.map((ev) => {
                            const s = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
                            const e = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
                            return (
                              <div key={ev.id} className="group flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/60 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-10 w-1 shrink-0 rounded-full bg-primary" />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">{ev.summary ?? "(Sem título)"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {s ? s.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Dia todo"}
                                      {e && ` - ${e.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                                    </p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => deleteEvent(ev.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Agenda;