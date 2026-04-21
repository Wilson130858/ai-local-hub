import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { businessName } from "@/lib/mock-data";
import { NotificationsPopover } from "@/components/NotificationsPopover";

export function DashboardLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-xl md:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-sm font-semibold leading-tight">{title}</h1>
              <span className="hidden truncate text-xs text-muted-foreground leading-tight md:inline">{businessName}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationsPopover />
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">VB</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-8">
            <div className="mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
