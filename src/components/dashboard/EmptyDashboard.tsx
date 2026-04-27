import { LayoutGrid, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function EmptyDashboard({ onCustomize }: { onCustomize: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <LayoutGrid className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">Seu painel está vazio</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Escolha quais métricas você quer acompanhar no dia a dia. Você pode mudar isso quando quiser.
      </p>
      <Button onClick={onCustomize} className="mt-6 gap-2">
        <Settings className="h-4 w-4" /> Personalizar Painel
      </Button>
    </motion.div>
  );
}
