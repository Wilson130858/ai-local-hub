import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { aiInsights } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const iconMap = {
  info: { Icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
  warning: { Icon: AlertCircle, color: "text-warning", bg: "bg-warning/10" },
  success: { Icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
};

export function AIInsights() {
  return (
    <Card className="border-border/60 p-6 shadow-soft">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Insights da IA</h3>
          <p className="text-xs text-muted-foreground">Recomendações personalizadas</p>
        </div>
      </div>
      <div className="space-y-3">
        {aiInsights.map((insight, i) => {
          const { Icon, color, bg } = iconMap[insight.type];
          return (
            <div key={i} className="group flex gap-3 rounded-xl border border-border/60 bg-secondary/40 p-4 transition-all hover:border-border hover:bg-secondary/80">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{insight.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
