import { useEffect, useState } from "react";
import { Bell, ArrowLeft, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "system" | "alert";
  is_read: boolean;
  created_at: string;
};

export function NotificationsPopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [selected, setSelected] = useState<Notification | null>(null);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as Notification[]);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel("notifications-" + user.id)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `target_user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openItem = async (n: Notification) => {
    setSelected(n);
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("target_user_id", user.id).eq("is_read", false);
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0">
        {selected ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)} aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                {selected.title && <p className="text-sm font-semibold leading-tight">{selected.title}</p>}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</div>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Notificações</p>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{unreadCount}</Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                  Marcar todas como lidas
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-[420px]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => openItem(n)}
                        className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="mt-1.5 flex h-2 w-2 shrink-0">
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-destructive" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm ${n.is_read ? "text-muted-foreground" : "font-medium"}`}>
                            {n.title || n.message}
                          </p>
                          {n.title && (
                            <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
