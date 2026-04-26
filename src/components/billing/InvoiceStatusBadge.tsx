import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock, FileText } from "lucide-react";
import { type InvoiceDisplayStatus, invoiceStatusLabel } from "@/lib/billing";

export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  const label = invoiceStatusLabel(status);
  if (status === "paid") {
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    );
  }
  if (status === "overdue") {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    );
  }
  if (status === "due_soon") {
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
        <Clock className="mr-1 h-3 w-3" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
      <FileText className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}