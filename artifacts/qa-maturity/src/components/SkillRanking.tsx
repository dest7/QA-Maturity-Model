/**
 * SkillRanking — рейтинг навыков.
 * 
 * Отображает топ-3 навыка в категориях:
 * - Самые развитые (по среднему уровню)
 * - Самые отсталые (по мин. среднему уровню)
 * - Самые популярные в изучении (по кол-ву изменений за период)
 */

import { Trophy, TrendingDown, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface RankedSkill {
  skillId: number;
  skillName: string;
  category: string;
  avgLevel: number;
  teamCount: number;
  changesCount?: number;
}

interface SkillRankingProps {
  topSkills: RankedSkill[];
  bottomSkills: RankedSkill[];
  trendingSkills: RankedSkill[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Технические": "bg-purple-500/10 text-purple-400 border-purple-500/30",
  "Процессы": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Люди": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "Продукт": "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] || "bg-slate-500/10 text-slate-400 border-slate-500/30";
}

function SkillCard({ 
  skill, 
  rank, 
  variant 
}: { 
  skill: RankedSkill; 
  rank: number; 
  variant: "top" | "bottom" | "trending" 
}) {
  const categoryStyle = getCategoryStyle(skill.category);
  
  const variantConfig = {
    top: {
      icon: Trophy,
      iconColor: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      label: "Сильный",
      value: `${skill.avgLevel.toFixed(1)} ур.`,
      subtext: `${skill.teamCount} команд развивают`,
    },
    bottom: {
      icon: Target,
      iconColor: "text-red-400",
      bgColor: "bg-red-500/10",
      label: "Слабый",
      value: `${skill.avgLevel.toFixed(1)} ур.`,
      subtext: `${skill.teamCount} команд требуют внимания`,
    },
    trending: {
      icon: TrendingUp,
      iconColor: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      label: "Активно изучается",
      value: `${skill.changesCount} изменений`,
      subtext: `За последний период`,
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className="border border-border/50 rounded-xl p-4 bg-card/40 hover:bg-card/60 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", config.bgColor)}>
            <Icon className={cn("w-4 h-4", config.iconColor)} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
              {config.label}
            </p>
            <p className="text-xs font-medium text-muted-foreground/70">{skill.category}</p>
          </div>
        </div>
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
          rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
          rank === 2 ? "bg-slate-400/20 text-slate-400" :
          "bg-amber-600/20 text-amber-600"
        )}>
          {rank}
        </div>
      </div>
      
      <h4 className="text-sm font-bold text-foreground mb-2 line-clamp-2">
        {skill.skillName}
      </h4>
      
      <div className="space-y-1">
        <p className="text-lg font-black text-foreground">{config.value}</p>
        <p className="text-[10px] text-muted-foreground/60">{config.subtext}</p>
      </div>
    </div>
  );
}

export function SkillRanking({ topSkills, bottomSkills, trendingSkills }: SkillRankingProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Самые сильные навыки */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-yellow-400">
            Самые сильные
          </h3>
        </div>
        <div className="space-y-3">
          {topSkills.length > 0 ? (
            topSkills.map((skill, idx) => (
              <SkillCard key={skill.skillId} skill={skill} rank={idx + 1} variant="top" />
            ))
          ) : (
            <p className="text-xs text-muted-foreground/50 text-center py-4">Нет данных</p>
          )}
        </div>
      </div>

      {/* Самые слабые навыки */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-red-400" />
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-red-400">
            Самые слабые (≤ 1.5)
          </h3>
        </div>
        <div className="space-y-3">
          {bottomSkills.length > 0 ? (
            bottomSkills.map((skill, idx) => (
              <SkillCard key={skill.skillId} skill={skill} rank={idx + 1} variant="bottom" />
            ))
          ) : (
            <p className="text-xs text-muted-foreground/50 text-center py-4">
              Нет навыков с уровнем ≤ 1.5
            </p>
          )}
        </div>
      </div>

      {/* Активно изучаемые навыки */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-emerald-400">
            Активно изучаемые
          </h3>
        </div>
        <div className="space-y-3">
          {trendingSkills.length > 0 && trendingSkills[0]?.changesCount > 0 ? (
            trendingSkills.map((skill, idx) => (
              <SkillCard key={skill.skillId} skill={skill} rank={idx + 1} variant="trending" />
            ))
          ) : (
            <p className="text-xs text-muted-foreground/50 text-center py-4">
              Нет изменений за период
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
