import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { businessName } from "@/lib/mock-data";
import { NotificationsPopover } from "@/components/NotificationsPopover";

export function DashboardLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="hidden flex-col md:flex">
              <h1 className="text-sm font-semibold leading-tight">{title}</h1>
              <span className="text-xs text-muted-foreground leading-tight">{businessName}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="h-9 w-64 rounded-full border-border bg-secondary pl-9" />
              </div>
              <NotificationsPopover />
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">VB</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
