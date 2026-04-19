export const businessName = "Barbearia Vintage Petrolina";

export const metrics = [
  { label: "Agendamentos Hoje", value: "27", trend: "+12%", trendUp: true },
  { label: "Leads em Espera", value: "8", trend: "+3", trendUp: true },
  { label: "Taxa de Conversão", value: "68%", trend: "+5.2%", trendUp: true },
  { label: "Horas Economizadas", value: "42h", trend: "esta semana", trendUp: true },
];

export const weeklyMessages = [
  { day: "Seg", mensagens: 142, agendamentos: 18 },
  { day: "Ter", mensagens: 168, agendamentos: 22 },
  { day: "Qua", mensagens: 195, agendamentos: 25 },
  { day: "Qui", mensagens: 178, agendamentos: 21 },
  { day: "Sex", mensagens: 240, agendamentos: 32 },
  { day: "Sáb", mensagens: 312, agendamentos: 41 },
  { day: "Dom", mensagens: 88, agendamentos: 9 },
];

export const aiInsights = [
  {
    title: "Horário de pico identificado",
    text: "O horário de pico é às 14h. Considere reforçar a agenda neste período.",
    type: "info" as const,
  },
  {
    title: "Oportunidade de retenção",
    text: "12 clientes não retornam há 45 dias. Sugira uma campanha de reativação.",
    type: "warning" as const,
  },
  {
    title: "Serviço em alta",
    text: "Corte + Barba representa 58% dos agendamentos da semana.",
    type: "success" as const,
  },
];

export type LeadStatus = "Agendado" | "Pendente" | "Cancelado";

export const leads: {
  id: string;
  nome: string;
  telefone: string;
  status: LeadStatus;
  data: string;
  origem: string;
}[] = [
  { id: "1", nome: "João Carvalho", telefone: "(87) 99812-3344", status: "Agendado", data: "19/04/2026 14:30", origem: "Google Maps" },
  { id: "2", nome: "Marcos Silva", telefone: "(87) 99745-2210", status: "Pendente", data: "19/04/2026 16:00", origem: "Instagram" },
  { id: "3", nome: "Pedro Henrique", telefone: "(87) 99888-1102", status: "Agendado", data: "20/04/2026 09:00", origem: "Google Maps" },
  { id: "4", nome: "Lucas Andrade", telefone: "(87) 99654-7788", status: "Cancelado", data: "18/04/2026 11:00", origem: "WhatsApp Direto" },
  { id: "5", nome: "Rafael Souza", telefone: "(87) 99432-5566", status: "Agendado", data: "20/04/2026 15:30", origem: "Google Maps" },
  { id: "6", nome: "Diego Ferreira", telefone: "(87) 99321-9988", status: "Pendente", data: "21/04/2026 10:00", origem: "Indicação" },
  { id: "7", nome: "Bruno Lima", telefone: "(87) 99876-4433", status: "Agendado", data: "21/04/2026 13:00", origem: "Google Maps" },
  { id: "8", nome: "Thiago Mendes", telefone: "(87) 99567-2211", status: "Agendado", data: "22/04/2026 17:00", origem: "Instagram" },
  { id: "9", nome: "Felipe Costa", telefone: "(87) 99445-8877", status: "Pendente", data: "22/04/2026 18:30", origem: "Google Maps" },
  { id: "10", nome: "Gustavo Rocha", telefone: "(87) 99334-6655", status: "Agendado", data: "23/04/2026 08:30", origem: "Google Maps" },
];

export const invoices = [
  { id: "INV-2026-04", date: "01/04/2026", amount: "R$ 297,00", status: "Pago" },
  { id: "INV-2026-03", date: "01/03/2026", amount: "R$ 297,00", status: "Pago" },
  { id: "INV-2026-02", date: "01/02/2026", amount: "R$ 297,00", status: "Pago" },
  { id: "INV-2026-01", date: "01/01/2026", amount: "R$ 297,00", status: "Pago" },
];
