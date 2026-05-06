/**
 * Модальное окно с полным описанием всех уровней конкретного навыка.
 *
 * Открывается по нажатию кнопки «i» на карточке SkillCard.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const LEVEL_LABELS = ["Initial", "Developing", "Defined", "Optimized"];

const LEVEL_COLORS = {
  0: { header: "text-slate-400", active: "bg-slate-500/10 border-slate-500/30", dot: "bg-slate-400" },
  1: { header: "text-amber-400", active: "bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" },
  2: { header: "text-blue-400", active: "bg-blue-500/10 border-blue-500/30", dot: "bg-blue-400" },
  3: { header: "text-emerald-400", active: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
} as const;

interface SkillInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: {
    skillName: string;
    skillCategory: string;
    skillDescription: string;
    level: number;
    levelDescriptions: string[];
    levelRequirements: string[];
    levelArtifacts: string[];
    levelRecommendations: string[];
  };
}

export function SkillInfoModal({ open, onOpenChange, skill }: SkillInfoModalProps) {
  const rows = [
    { label: "Описание", key: "levelDescriptions" as const },
    { label: "Требования", key: "levelRequirements" as const },
    { label: "Артефакты подтверждения", key: "levelArtifacts" as const },
    { label: "Рекомендации к следующему", key: "levelRecommendations" as const },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card border-border/60 shadow-2xl shadow-black/50 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                {skill.skillCategory}
              </div>
              <DialogTitle className="text-xl font-display font-bold text-foreground leading-tight">
                {skill.skillName}
              </DialogTitle>
              <p className="text-sm text-foreground/70 mt-1 leading-relaxed">
                {skill.skillDescription}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="w-36 pb-3 pr-4 text-left" />
                {[0, 1, 2, 3].map((lvl) => {
                  const colors = LEVEL_COLORS[lvl as keyof typeof LEVEL_COLORS];
                  const isActive = lvl === skill.level;
                  return (
                    <th
                      key={lvl}
                      className={cn(
                        "pb-3 px-4 text-center rounded-t-xl transition-colors",
                        isActive
                          ? cn("border border-b-0", colors.active)
                          : "border border-transparent"
                      )}
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", colors.dot)} />
                        <span className={cn("font-bold text-xs uppercase tracking-wider", isActive ? colors.header : "text-foreground/50")}>
                          Уровень {lvl}
                        </span>
                        <span className={cn("text-[10px] font-semibold", isActive ? colors.header : "text-foreground/40")}>
                          {LEVEL_LABELS[lvl]}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            Текущий
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, key }, rowIdx) => (
                <tr key={key}>
                  <td className={cn(
                    "pr-4 py-4 align-top text-[11px] font-bold text-foreground/50 uppercase tracking-wider whitespace-nowrap",
                    rowIdx < rows.length - 1 ? "border-b border-border/20" : ""
                  )}>
                    {label}
                  </td>
                  {[0, 1, 2, 3].map((lvl) => {
                    const colors = LEVEL_COLORS[lvl as keyof typeof LEVEL_COLORS];
                    const isActive = lvl === skill.level;
                    const isLastRow = rowIdx === rows.length - 1;
                    const text = skill[key]?.[lvl] || "—";
                    return (
                      <td
                        key={lvl}
                        className={cn(
                          "px-4 py-4 align-top text-xs leading-relaxed",
                          isActive ? cn("border-x", colors.active, isLastRow ? "rounded-b-xl border-b" : "") : "",
                          !isActive && rowIdx < rows.length - 1 ? "border-b border-border/20" : "",
                          key === "levelRecommendations" && lvl < 3
                            ? isActive ? "text-primary/90 font-medium" : "text-foreground/55"
                            : isActive ? "text-foreground/90" : "text-foreground/60"
                        )}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
