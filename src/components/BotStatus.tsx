import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

export function BotStatus() {
  return (
    <Card className="border-border/60 p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Status do Bot</h3>
          <p className="text-sm text-muted-foreground">Atendimento WhatsApp</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
          <MessageCircle className="h-5 w-5 text-success" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-4">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-success">Online</p>
          <p className="text-xs text-muted-foreground">Respondendo em ~2s</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-lg font-semibold">99.8%</p>
          <p className="text-xs text-muted-foreground">Uptime</p>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-lg font-semibold">1.2k</p>
          <p className="text-xs text-muted-foreground">Msg hoje</p>
        </div>
      </div>
    </Card>
  );
}
