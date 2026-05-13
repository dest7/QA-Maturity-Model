import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardView } from "@/pages/DashboardView";
import { TeamDashboard } from "@/pages/TeamDashboard";
import { MetricsPage } from "@/pages/MetricsPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary/30" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AppLayout>
        <Switch>
          <Route path="/" component={DashboardView} />
          <Route path="/team/:id">
            {params => <TeamDashboard teamId={parseInt(params.id)} />}
          </Route>
          <Route path="/metrics" component={MetricsPage} />
          <Route path="/analytics/:tab?" component={AnalyticsPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
      <Toaster />
    </WouterRouter>
  );
}

export default function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}
