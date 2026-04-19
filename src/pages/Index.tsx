import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { PerformanceChart } from "@/components/PerformanceChart";
import { BotStatus } from "@/components/BotStatus";
import { AIInsights } from "@/components/AIInsights";
import { metrics } from "@/lib/mock-data";

const Index = () => {
  return (
    <DashboardLayout title="Visão Geral">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Bom dia, Vinícius 👋</h2>
        <p className="text-sm text-muted-foreground">Aqui está o resumo da sua barbearia hoje.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart />
        </div>
        <BotStatus />
      </div>

      <AIInsights />
    </DashboardLayout>
  );
};

export default Index;
