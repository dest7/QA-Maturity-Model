import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { RoleProvider } from "@/contexts/RoleContext";
import { AppLayout } from "@/components/AppLayout";
import { DashboardView } from "@/pages/DashboardView";
import { TeamDashboard } from "@/pages/TeamDashboard";
import NotFound from "@/pages/not-found";

// Initialize Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RoleProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppLayout>
                <Switch>
                  <Route path="/" component={DashboardView} />
                  <Route path="/team/:id">
                    {params => <TeamDashboard teamId={parseInt(params.id)} />}
                  </Route>
                  <Route component={NotFound} />
                </Switch>
              </AppLayout>
            </WouterRouter>
            <Toaster />
          </RoleProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}
