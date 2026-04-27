import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_METRICS, type DashboardMetric } from "@/lib/dashboard-metrics";

export function MetricsGrid({ selected }: { selected: string[] }) {
  const items: DashboardMetric[] = selected
    .map((k) => DASHBOARD_METRICS.find((m) => m.key === k))
    .filter((m): m is DashboardMetric => Boolean(m));

  return (
    <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {items.map((m) => {
          const Icon = m.icon;
          const Trend = m.trendUp ? TrendingUp : TrendingDown;
          return (
            <motion.div
              key={m.key}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Card className="group relative overflow-hidden border-border/60 bg-card p-6 shadow-soft transition-all hover:shadow-elegant">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
                    <p className="text-3xl font-semibold tracking-tight">{m.value}</p>
                    <div className={cn("flex items-center gap-1 text-xs font-medium", m.trendUp ? "text-success" : "text-destructive")}>
                      <Trend className="h-3 w-3" />
                      <span>{m.trend}</span>
                    </div>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
