import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card p-6 shadow-soft transition-all hover:shadow-elegant">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendUp ? "text-success" : "text-destructive")}>
          <TrendingUp className="h-3 w-3" />
          <span>{trend}</span>
        </div>
      </div>
    </Card>
  );
}
