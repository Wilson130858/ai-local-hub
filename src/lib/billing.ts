import type { Database } from "@/integrations/supabase/types";

export type ServiceQuote = Database["public"]["Tables"]["service_quotes"]["Row"] & {
  proration_amount?: number | null;
  proposed_billing_day?: number | null;
};

/** Próxima data de vencimento dada o dia de fechamento (1-28). */
export function computeNextDueDate(closingDay: number, ref: Date = new Date()): Date {
  const day = Math.min(Math.max(closingDay, 1), 28);
  const due = new Date(ref.getFullYear(), ref.getMonth(), day);
  if (ref.getDate() > day) due.setMonth(due.getMonth() + 1);
  return due;
}

/** Mostra "DD/MM/YYYY". */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
}

/**
 * Verifica se um quote aceito ainda contribui para a fatura corrente.
 * - lifetime: cobra apenas no mês em que foi aceito.
 * - recurring: cobra por `recurrence_months` meses a partir do mês de aceite.
 */
export function isQuoteActiveInPeriod(quote: ServiceQuote, ref: Date = new Date()): boolean {
  if (quote.status !== "accepted" || !quote.decided_at) return false;
  if ((quote.billing_type as string) === "billing_change") return false;
  const decided = new Date(quote.decided_at);
  const monthsElapsed =
    (ref.getFullYear() - decided.getFullYear()) * 12 + (ref.getMonth() - decided.getMonth());
  if (monthsElapsed < 0) return false;
  if (quote.billing_type === "lifetime") return monthsElapsed === 0;
  const total = quote.recurrence_months ?? 1;
  return monthsElapsed < total;
}

export type InvoiceLine = { description: string; amount: number; kind: "base" | "extra" };

export function computeCurrentInvoice(
  acceptedQuotes: ServiceQuote[],
  ref: Date = new Date(),
): { lines: InvoiceLine[]; total: number } {
  const lines: InvoiceLine[] = [];
  for (const q of acceptedQuotes) {
    if (!isQuoteActiveInPeriod(q, ref)) continue;
    lines.push({ description: q.name, amount: q.amount, kind: "extra" });
    // prorata só conta no mês em que foi aceito
    if (q.proration_amount && q.decided_at) {
      const decided = new Date(q.decided_at);
      const sameMonth =
        decided.getFullYear() === ref.getFullYear() && decided.getMonth() === ref.getMonth();
      if (sameMonth) {
        lines.push({
          description: `${q.name} (proporcional do mês)`,
          amount: q.proration_amount,
          kind: "extra",
        });
      }
    }
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total };
}

/** Calcula prévia de prorata para um quote ainda pendente. */
export function previewProration(
  amount: number,
  billingDay: number,
  ref: Date = new Date(),
): { prorata: number; daysRemaining: number; nextDue: Date } {
  const day = Math.min(Math.max(billingDay, 1), 28);
  const next = new Date(ref.getFullYear(), ref.getMonth(), day);
  if (ref.getDate() >= day) next.setMonth(next.getMonth() + 1);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(
    0,
    Math.round((next.getTime() - new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime()) / msPerDay),
  );
  const prorata = daysRemaining > 0 && daysRemaining < 30 ? Math.floor((amount * daysRemaining) / 30) : 0;
  return { prorata, daysRemaining, nextDue: next };
}