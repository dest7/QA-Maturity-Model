import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetTeams } from "@workspace/api-client-react";
import { Loader2, Shield, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTeamModal } from "@/components/CreateTeamModal";

export function DashboardView() {
  const { data: teams, isLoading } = useGetTeams();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && teams && teams.length > 0 && location === "/") {
      // Auto-navigate to the first team's dashboard if it exists
      setLocation(`/team/${teams[0].id}`);
    }
  }, [teams, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
      </div>
    );
  }

  if (teams?.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700">
        <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center mb-8 shadow-inner shadow-primary/20">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold font-display text-foreground mb-3 tracking-tight">QA Maturity Model</h2>
        <p className="text-muted-foreground max-w-md mb-10 text-lg leading-relaxed">
          Track, analyze, and systematically improve your Quality Assurance processes across 15 critical skills.
        </p>
        <CreateTeamModal
          trigger={
            <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5">
              <Plus className="mr-2 h-5 w-5" /> Initialize First Team
            </Button>
          }
        />
      </div>
    );
  }

  // Fallback if navigating between states
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground/50 font-medium">
      Select a team from the sidebar to view its dashboard.
    </div>
  );
}
