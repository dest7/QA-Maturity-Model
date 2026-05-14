/**
 * SkillHeatmap — тепловая карта навыков.
 * 
 * Отображает средний уровень навыков по категориям.
 * Цвет ячейки: средний уровень (0-3) с градиентом.
 * Размер/интенсивность: количество команд с level > 0.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SkillHeatmapData {
  skillId: number;
  skillName: string;
  category: string;
  avgLevel: number;
  teamCount: number;
  levelDistribution: { 0: number; 1: number; 2: number; 3: number };
}

interface SkillHeatmapProps {
  data: SkillHeatmapData[];
  isLoading?: boolean;
}

// Цвета для уровней (от 0 до 3)
const LEVEL_COLORS = [
  "bg-slate-500",      // Уровень 0
  "bg-amber-500",      // Уровень 1
  "bg-blue-500",       // Уровень 2
  "bg-emerald-500",    // Уровень 3
];

const LEVEL_BG_COLORS = [
  "bg-slate-500/10",
  "bg-amber-500/10",
  "bg-blue-500/10",
  "bg-emerald-500/10",
];

const LEVEL_TEXT_COLORS = [
  "text-slate-400",
  "text-amber-400",
  "text-blue-400",
  "text-emerald-400",
];

// Группировка навыков по категориям
function groupByCategory(data: SkillHeatmapData[]) {
  const groups = new Map<string, SkillHeatmapData[]>();
  for (const item of data) {
    if (!groups.has(item.category)) {
      groups.set(item.category, []);
    }
    groups.get(item.category)!.push(item);
  }
  return groups;
}

// Получение цвета на основе среднего уровня
function getLevelColor(avgLevel: number): string {
  const rounded = Math.round(avgLevel);
  return LEVEL_COLORS[Math.min(3, Math.max(0, rounded))];
}

function getLevelBgColor(avgLevel: number): string {
  const rounded = Math.round(avgLevel);
  return LEVEL_BG_COLORS[Math.min(3, Math.max(0, rounded))];
}

function getLevelTextColor(avgLevel: number): string {
  const rounded = Math.round(avgLevel);
  return LEVEL_TEXT_COLORS[Math.min(3, Math.max(0, rounded))];
}

export function SkillHeatmap({ data, isLoading }: SkillHeatmapProps) {
  const groupedData = useMemo(() => groupByCategory(data), [data]);
  const categories = Array.from(groupedData.keys());

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground/50 text-sm">
        Загрузка тепловой карты...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground/50 text-sm">
        Нет данных для отображения
      </div>
    );
  }

  // Находим максимальное количество команд для масштабирования интенсивности
  const maxTeamCount = Math.max(...data.map((d) => d.teamCount), 1);

  return (
    <div className="space-y-6">
      {/* Легенда */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">Уровень:</span>
        {["Начальный (0)", "Развитие (1)", "Эффективность (2)", "Оптимизация (3)"].map((label, idx) => (
          <div key={label} className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded", LEVEL_COLORS[idx])} />
            <span className="text-xs text-muted-foreground/70">{label}</span>
          </div>
        ))}
      </div>

      {/* Тепловая карта */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Заголовки категорий */}
          <div className="flex border-b border-border/50">
            <div className="w-48 flex-shrink-0 p-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest sticky left-0 bg-card">
              Навык
            </div>
            {categories.map((category) => (
              <div
                key={category}
                className="flex-1 p-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest text-center border-l border-border/30"
              >
                {category}
              </div>
            ))}
          </div>

          {/* Ячейки навыков */}
          {data.map((skill) => {
            const categoryIndex = categories.indexOf(skill.category);
            return (
              <div
                key={skill.skillId}
                className="flex items-center border-b border-border/20 hover:bg-sidebar-accent/20 transition-colors"
              >
                {/* Название навыка */}
                <div className="w-48 flex-shrink-0 p-3 text-xs font-medium text-foreground/80 sticky left-0 bg-card border-r border-border/30">
                  {skill.skillName}
                </div>

                {/* Ячейки по категориям */}
                {categories.map((cat, idx) => {
                  const isCurrentCategory = idx === categoryIndex;
                  const intensity = skill.teamCount / maxTeamCount;

                  return (
                    <div
                      key={cat}
                      className={cn(
                        "flex-1 p-3 text-center border-l border-border/30",
                        isCurrentCategory ? getLevelBgColor(skill.avgLevel) : "bg-transparent"
                      )}
                      style={{
                        opacity: isCurrentCategory ? 0.7 + intensity * 0.3 : 0.3,
                      }}
                    >
                      {isCurrentCategory && (
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={cn("w-8 h-8 rounded-lg flex items-center justify-center", getLevelColor(skill.avgLevel))}
                          >
                            <span className="text-sm font-black text-white">
                              {skill.avgLevel.toFixed(1)}
                            </span>
                          </div>
                          <span className={cn("text-[10px] font-medium", getLevelTextColor(skill.avgLevel))}>
                            {skill.teamCount} ком.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
