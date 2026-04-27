import {
  DollarSign, Receipt, AlertCircle, TrendingUp,
  Users, Clock, Target, MessageSquare,
  Calendar, CalendarX, Percent, CalendarClock,
  type LucideIcon,
} from "lucide-react";

export type MetricCategory = "financeiro" | "atendimento" | "agenda";

export type DashboardMetric = {
  key: string;
  label: string;
  category: MetricCategory;
  icon: LucideIcon;
  value: string;
  trend: string;
  trendUp: boolean;
};

export const CATEGORY_LABELS: Record<MetricCategory, string> = {
  financeiro: "Financeiro",
  atendimento: "Atendimento (IA)",
  agenda: "Agenda",
};

export const DASHBOARD_METRICS: DashboardMetric[] = [
  // Financeiro
  { key: "faturamento_dia", label: "Faturamento do Dia", category: "financeiro", icon: DollarSign, value: "R$ 1.847", trend: "+18%", trendUp: true },
  { key: "ticket_medio", label: "Ticket Médio", category: "financeiro", icon: Receipt, value: "R$ 68", trend: "+4%", trendUp: true },
  { key: "inadimplencia", label: "Inadimplência", category: "financeiro", icon: AlertCircle, value: "R$ 320", trend: "-12%", trendUp: false },
  { key: "receita_mes", label: "Receita do Mês", category: "financeiro", icon: TrendingUp, value: "R$ 38.4k", trend: "+22%", trendUp: true },
  // Atendimento (IA)
  { key: "leads_gerados", label: "Leads Gerados", category: "atendimento", icon: Users, value: "47", trend: "+9", trendUp: true },
  { key: "tempo_resposta", label: "Tempo de Resposta", category: "atendimento", icon: Clock, value: "~2s", trend: "-0.4s", trendUp: true },
  { key: "conversao_bot", label: "Taxa de Conversão do Bot", category: "atendimento", icon: Target, value: "68%", trend: "+5.2%", trendUp: true },
  { key: "mensagens_hoje", label: "Mensagens Hoje", category: "atendimento", icon: MessageSquare, value: "1.2k", trend: "+14%", trendUp: true },
  // Agenda
  { key: "agendamentos_hoje", label: "Agendamentos Hoje", category: "agenda", icon: Calendar, value: "27", trend: "+12%", trendUp: true },
  { key: "cancelamentos", label: "Cancelamentos", category: "agenda", icon: CalendarX, value: "3", trend: "-2", trendUp: true },
  { key: "ocupacao", label: "Taxa de Ocupação", category: "agenda", icon: Percent, value: "84%", trend: "+6%", trendUp: true },
  { key: "proximo_horario", label: "Próximo Horário Livre", category: "agenda", icon: CalendarClock, value: "15:30", trend: "hoje", trendUp: true },
];

export const DEFAULT_SELECTED: string[] = [
  "faturamento_dia", "leads_gerados", "agendamentos_hoje", "ticket_medio",
];

export function getMetricsByCategory() {
  return (Object.keys(CATEGORY_LABELS) as MetricCategory[]).map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: DASHBOARD_METRICS.filter((m) => m.category === cat),
  }));
}
