import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
  blockAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, blockAdmin = false }: Props) {
  const { user, isAdmin, status, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Admin bypassa fluxo de aprovação
  if (!isAdmin && status && status !== "approved") {
    const isPending = status === "pending";
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${isPending ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
            {isPending ? <Clock className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
          </div>
          <h1 className="text-xl font-semibold">
            {isPending ? "Aguardando aprovação" : "Cadastro rejeitado"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPending
              ? "Seu cadastro foi recebido e está em análise. Você receberá acesso assim que um administrador aprovar sua conta."
              : "Seu cadastro não foi aprovado. Entre em contato com o suporte para mais informações."}
          </p>
          <Button variant="outline" className="mt-6" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  if (blockAdmin && isAdmin) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}
