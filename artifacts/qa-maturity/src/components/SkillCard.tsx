/**
 * Карточка навыка (SkillCard).
 *
 * Отображает один QA-навык с его текущим уровнем и позволяет изменять его.
 *
 * Взаимодействие с сервером:
 *   При нажатии + или − вызывается хук useUpdateSkillLevel (PUT /api/teams/:id/skills/:skillId).
 *   После успешного ответа инвалидируются два React Query кэша:
 *     - getGetTeamQueryKey(teamId)  — чтобы обновился overallLevel и radar chart
 *     - getGetTeamsQueryKey()       — чтобы обновился бейдж Lx в сайдбаре
 *   Во время запроса (isPending) кнопки заблокированы, цифра заменяется спиннером.
 *
 * Визуальная система уровней (LEVEL_COLORS):
 *   0 — серый    (slate)   — Initial
 *   1 — жёлтый   (amber)   — Developing
 *   2 — синий    (blue)    — Defined
 *   3 — зелёный  (emerald) — Optimized
 *
 * Сегментированный прогресс-бар:
 *   4 сегмента (по одному на уровень). Сегменты с индексом <= currentLevel подсвечиваются
 *   цветом соответствующего уровня с glow-эффектом (box-shadow).
 *
 * Таблица деталей (раскрываемая):
 *   Показывает данные для ТЕКУЩЕГО уровня навыка из массивов levelRequirements/Artifacts/Recommendations.
 *   Третья колонка — "Рекомендации к следующему уровню", если уровень < 3, иначе "Практики поддержания".
 */

import { useUpdateSkillLevel, getGetTeamQueryKey, getGetTeamsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Цветовая система уровней: цвет полоски прогресса, свечения, текста и бейджа
const LEVEL_COLORS = {
  0: { bar: "bg-slate-500", glow: "shadow-[0_0_8px_rgba(100,116,139,0.5)]", text: "text-slate-400", badge: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
  1: { bar: "bg-amber-500", glow: "shadow-[0_0_8px_rgba(245,158,11,0.5)]", text: "text-amber-500", badge: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  2: { bar: "bg-blue-500", glow: "shadow-[0_0_8px_rgba(59,130,246,0.5)]", text: "text-blue-500", badge: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  3: { bar: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]", text: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
} as const;

const LEVEL_LABELS = ["Initial", "Developing", "Defined", "Optimized"];

export function SkillCard({ teamId, skill }: { teamId: number; skill: any }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { mutate, isPending } = useUpdateSkillLevel({
    mutation: {
      onSuccess: () => {
        // Инвалидируем оба кэша, чтобы данные обновились везде на странице
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
      },
    },
  });

  const handleUpdate = (newLevel: number) => {
    // Защита от выхода за границы (0–3) и от двойного клика во время запроса
    if (newLevel < 0 || newLevel > 3 || isPending) return;
    mutate({ teamId, skillId: skill.skillId, data: { level: newLevel } });
  };

  const colors = LEVEL_COLORS[skill.level as keyof typeof LEVEL_COLORS];
  const hasNextLevel = skill.level < 3;

  return (
    <Card className="group border-border/40 hover:border-primary/40 bg-card/30 hover:bg-card/60 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/5 flex flex-col">
      <CardHeader className="p-5 pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors leading-tight mb-1">
              {skill.skillName}
            </CardTitle>
            <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", colors.badge)}>
              {LEVEL_LABELS[skill.level]}
            </span>
          </div>
          {/* Контрол изменения уровня: − [цифра] + */}
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

      <CardContent className="p-5 pt-0 flex flex-col gap-3 flex-1">
        {/* Сегментированный прогресс-бар: 4 сегмента, активны те, что <= currentLevel */}
        <div className="flex gap-1.5 h-2 w-full">
          {[0, 1, 2, 3].map((l) => {
            const c = LEVEL_COLORS[l as keyof typeof LEVEL_COLORS];
            const active = l <= skill.level;
            return (
              <div
                key={l}
                className={cn(
                  "flex-1 rounded-full transition-all duration-500 ease-out",
                  active ? `${c.bar} ${c.glow}` : "bg-secondary opacity-40"
                )}
              />
            );
          })}
        </div>

        {/* Описание текущего уровня из массива levelDescriptions[currentLevel] */}
        <div className="text-xs text-muted-foreground/80 leading-relaxed bg-background/30 p-2.5 rounded-lg border border-border/30">
          {skill.levelDescriptions?.[skill.level]}
        </div>

        {/* Кнопка раскрытия детальной таблицы */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground/60 hover:text-primary hover:bg-primary/5 gap-1.5 border border-border/20 rounded-lg"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Скрыть детали" : "Показать требования и рекомендации"}
        </Button>

        {/* Детальная таблица: требования / артефакты / рекомендации для текущего уровня */}
        {expanded && (
          <div className="rounded-xl overflow-hidden border border-border/40 text-xs">
            <div className="grid grid-cols-3 bg-background/60">
              <div className="px-3 py-2 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px] border-b border-border/30 border-r border-border/30">
                Требования к уровню {skill.level}
              </div>
              <div className="px-3 py-2 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px] border-b border-border/30 border-r border-border/30">
                Артефакты подтверждения
              </div>
              <div className="px-3 py-2 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px] border-b border-border/30">
                {hasNextLevel ? `Рекомендации к уровню ${skill.level + 1}` : "Практики поддержания"}
              </div>
            </div>
            <div className="grid grid-cols-3 bg-card/20">
              <div className="px-3 py-3 text-foreground/75 leading-relaxed border-r border-border/30">
                {skill.levelRequirements?.[skill.level] || "—"}
              </div>
              <div className="px-3 py-3 text-foreground/75 leading-relaxed border-r border-border/30">
                {skill.levelArtifacts?.[skill.level] || "—"}
              </div>
              <div className={cn("px-3 py-3 leading-relaxed", hasNextLevel ? "text-primary/80" : "text-emerald-400/80")}>
                {skill.levelRecommendations?.[skill.level] || "—"}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
