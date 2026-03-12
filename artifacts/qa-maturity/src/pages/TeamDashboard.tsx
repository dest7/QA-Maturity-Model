import { useGetTeam } from "@workspace/api-client-react";
import { MaturityRadar } from "@/components/MaturityRadar";
import { SkillCard } from "@/components/SkillCard";
import { Loader2, Info } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Helper to style the overarching badge visually
const getMaturityConfig = (level: number) => {
  switch (level) {
    case 0: return { label: "Level 0: Initial", color: "text-slate-400 border-slate-500/30 bg-slate-500/10 shadow-[0_0_15px_rgba(100,116,139,0.15)]" };
    case 1: return { label: "Level 1: Developing", color: "text-amber-500 border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]" };
    case 2: return { label: "Level 2: Defined", color: "text-blue-500 border-blue-500/30 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]" };
    case 3: return { label: "Level 3: Optimized", color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]" };
    default: return { label: "Unknown", color: "text-slate-400 border-slate-500/30 bg-slate-500/10" };
  }
};

export function TeamDashboard({ teamId }: { teamId: number }) {
  const { data: team, isLoading, error } = useGetTeam(teamId);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4">
          <Info className="w-8 h-8 text-destructive" />
        </div>
        <p className="text-xl font-bold font-display">Failed to load team data</p>
        <p className="text-muted-foreground text-sm mt-2">The team might have been deleted or a network error occurred.</p>
      </div>
    );
  }

  // Group skills by category for the grid
  const skillsByCategory = team.skillLevels.reduce((acc, skill) => {
    if (!acc[skill.skillCategory]) acc[skill.skillCategory] = [];
    acc[skill.skillCategory].push(skill);
    return acc;
  }, {} as Record<string, typeof team.skillLevels>);

  const badgeConfig = getMaturityConfig(team.overallLevel);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1400px] mx-auto pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground font-display mb-2 drop-shadow-sm">{team.name}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">{team.description}</p>
        </div>
        <div className={cn("px-5 py-2.5 rounded-full border-2 font-bold tracking-wide flex items-center shrink-0", badgeConfig.color)}>
          {badgeConfig.label}
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-12">
        {/* Radar Chart */}
        <div className="xl:col-span-1 bg-card/40 border border-border/50 rounded-3xl p-5 shadow-sm backdrop-blur-md min-h-[380px] flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <h3 className="font-display font-bold text-sm text-foreground/80 mb-2 px-2 uppercase tracking-widest flex items-center gap-2">
            Maturity Radar
          </h3>
          <div className="flex-1 min-h-[300px] -mx-4">
            <MaturityRadar skills={team.skillLevels} />
          </div>
        </div>

        {/* Stats Summary */}
        <div className="xl:col-span-2 bg-card/40 border border-border/50 rounded-3xl p-8 shadow-sm backdrop-blur-md flex flex-col justify-center relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <h3 className="font-display font-bold text-2xl mb-3 text-foreground tracking-tight">Current Posture</h3>
          <p className="text-muted-foreground mb-8 max-w-2xl leading-relaxed text-base">
            This team currently holds an overall maturity level of <strong className="text-foreground font-bold">{team.overallLevel}</strong>. 
            The overall level progresses when at least <strong>85%</strong> (13 out of 15) of skills meet or exceed the target level milestone.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            {[0, 1, 2, 3].map(l => {
              const count = team.skillLevels.filter(s => s.level === l).length;
              return (
                <div key={l} className="bg-background/60 border border-border/60 rounded-2xl p-4 text-center shadow-inner">
                  <div className={cn(
                    "text-3xl font-black font-display mb-1 drop-shadow-sm",
                    l === 0 ? "text-slate-400" : l === 1 ? "text-amber-500" : l === 2 ? "text-blue-500" : "text-emerald-500"
                  )}>
                    {count}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Level {l}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Skills Grid by Category */}
      <div className="space-y-12">
        {Object.entries(skillsByCategory).map(([category, skills], i) => (
          <motion.div 
            key={category} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <h3 className="text-xl font-display font-bold text-foreground/90 whitespace-nowrap">
                {category}
              </h3>
              <div className="h-px bg-border/80 flex-1 w-full shadow-[0_1px_0_rgba(255,255,255,0.02)]" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {skills.map(skill => (
                <SkillCard key={skill.skillId} teamId={team.id} skill={skill} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

    </motion.div>
  );
}
