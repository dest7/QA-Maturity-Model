import { Link, useRoute } from "wouter";
import { useGetTeams } from "@workspace/api-client-react";
import { Target, Layers, Plus, Loader2, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CreateTeamModal } from "@/components/CreateTeamModal";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: teams, isLoading } = useGetTeams();
  const [match, params] = useRoute("/team/:id");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-72 flex flex-col bg-sidebar border-r border-sidebar-border z-20 shadow-2xl shadow-black/20">
        <div className="p-6 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all shadow-inner">
              <Target size={22} className="group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-sidebar-foreground leading-none tracking-tight">QA Maturity</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1.5 block">Dashboard</span>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <div className="text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-4 px-2 mt-2 flex items-center gap-2">
            <BarChart2 size={12} /> Active Teams
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
            </div>
          ) : teams?.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No teams available.
            </div>
          ) : (
            teams?.map((team) => {
              const isActive = match && params?.id === String(team.id);
              return (
                <Link
                  key={team.id}
                  href={`/team/${team.id}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Layers
                    size={18}
                    className={cn(
                      "transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground/80"
                    )}
                  />
                  <span className="font-medium text-sm truncate flex-1">{team.name}</span>
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors",
                      isActive
                        ? "bg-background/80 border-border text-foreground shadow-inner"
                        : "bg-background/30 border-border/40 text-muted-foreground group-hover:bg-background/60"
                    )}
                  >
                    L{team.overallLevel}
                  </span>
                </Link>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
          <CreateTeamModal
            trigger={
              <Button
                variant="outline"
                className="w-full justify-start text-sidebar-foreground/80 hover:text-foreground border-sidebar-border shadow-sm hover:bg-sidebar-accent group h-11 transition-all"
              >
                <Plus className="mr-2 h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                Add New Team
              </Button>
            }
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
        <div className="flex-1 overflow-y-auto z-10 p-6 md:p-10 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
