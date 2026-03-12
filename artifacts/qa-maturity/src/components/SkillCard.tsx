import { useUpdateSkillLevel, getGetTeamQueryKey, getGetTeamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SkillCard({ teamId, skill }: { teamId: number; skill: any }) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useUpdateSkillLevel({
    mutation: {
      onSuccess: () => {
        // Invalidate to fetch fresh stats and overarching level
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
      },
    },
  });

  const handleUpdate = (newLevel: number) => {
    if (newLevel < 0 || newLevel > 3 || isPending) return;
    mutate({ teamId, skillId: skill.skillId, data: { level: newLevel } });
  };

  return (
    <Card className="group border-border/40 hover:border-primary/40 bg-card/30 hover:bg-card/60 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="p-5 pb-3">
        <div className="flex justify-between items-start gap-4">
          <CardTitle className="text-base font-semibold font-display tracking-tight text-foreground/90 group-hover:text-primary transition-colors leading-tight">
            {skill.skillName}
          </CardTitle>
          <div className="flex items-center shrink-0 bg-background/90 rounded-lg p-0.5 border border-border/50 shadow-inner">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md hover:bg-destructive/20 hover:text-destructive text-muted-foreground disabled:opacity-30"
              onClick={() => handleUpdate(skill.level - 1)}
              disabled={skill.level === 0 || isPending}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <div className="w-6 text-center text-xs font-bold font-mono text-foreground">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : skill.level}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md hover:bg-emerald-500/20 hover:text-emerald-500 text-muted-foreground disabled:opacity-30"
              onClick={() => handleUpdate(skill.level + 1)}
              disabled={skill.level === 3 || isPending}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 pt-0 flex flex-col gap-4">
        {/* Segmented Progress Bar */}
        <div className="flex gap-1.5 h-2 w-full">
          {[0, 1, 2, 3].map((l) => {
            let bgClass = "bg-secondary"; // Default empty track
            if (l <= skill.level) {
              if (l === 0) bgClass = "bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.5)]";
              if (l === 1) bgClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
              if (l === 2) bgClass = "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]";
              if (l === 3) bgClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
            }
            return (
              <div
                key={l}
                className={cn(
                  "flex-1 rounded-full transition-all duration-500 ease-out",
                  bgClass,
                  l <= skill.level ? "opacity-100" : "opacity-40"
                )}
              />
            );
          })}
        </div>
        
        <div className="text-xs text-muted-foreground/80 leading-relaxed min-h-[3rem] bg-background/30 p-2.5 rounded-lg border border-border/30">
          {skill.levelDescriptions[skill.level]}
        </div>
      </CardContent>
    </Card>
  );
}
