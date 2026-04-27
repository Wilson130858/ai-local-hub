import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RotateCcw } from "lucide-react";
import { DASHBOARD_METRICS, DEFAULT_SELECTED, getMetricsByCategory } from "@/lib/dashboard-metrics";

export function CustomizeSheet({
  open,
  onOpenChange,
  selected,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const groups = getMetricsByCategory();
  const isOn = (key: string) => selected.includes(key);

  const toggle = (key: string, value: boolean) => {
    const next = value ? [...selected, key] : selected.filter((k) => k !== key);
    onChange(next);
  };

  const reset = () => onChange([...DEFAULT_SELECTED]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle>Personalizar Painel</SheetTitle>
          <SheetDescription>
            {selected.length} de {DASHBOARD_METRICS.length} métricas ativas
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.category} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1 rounded-xl border border-border/60 bg-card/40 p-1">
                  {group.items.map((m) => {
                    const Icon = m.icon;
                    return (
                      <label
                        key={m.key}
                        htmlFor={`m-${m.key}`}
                        className="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/60"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.label}</p>
                        </div>
                        <Switch
                          id={`m-${m.key}`}
                          checked={isOn(m.key)}
                          onCheckedChange={(v) => toggle(m.key, v)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />
        <div className="flex items-center justify-between gap-2 p-4">
          <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Concluído
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
