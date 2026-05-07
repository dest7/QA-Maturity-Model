/**
 * MetricsPage — сводная аналитика зрелости QA по всей компании.
 * Доступна только для ролей manager и admin.
 *
 * Секции:
 *   1. KPI-карточки: общее число команд, средний уровень, статусы оценки
 *   2. Рейтинг команд по уровню зрелости
 *   3. Тепловая карта навыков (команды × навыки)
 *   4. Топ слабых навыков
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart2, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TeamRow { id: number; name: string; overallLevel: number; assessmentStatus: string | null; }
interface SkillHeatmapEntry { skillId: number; skillName: string; category: string; level: number; }
interface HeatmapTeam { team: { id: number; name: string; overallLevel: number }; skills: SkillHeatmapEntry[]; }
interface SkillAvg { skillId: number; skillName: string; category: string; avgLevel: number; distribution: number[]; }
interface MetricsData {
  teams: TeamRow[];
  heatmap: HeatmapTeam[];
  skillAverages: SkillAvg[];
  categoryAvgs: { category: string; avgLevel: number }[];
  statusSummary: Record<string, number>;
}

const LEVEL_COLORS_CELL: Record<number, string> = {
  0: "bg-slate-800 text-slate-400",
  1: "bg-amber-900/60 text-amber-300",
  2: "bg-blue-900/60 text-blue-300",
  3: "bg-emerald-900/60 text-emerald-300",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planned:     { label: "Запланирована",   color: "text-slate-400 bg-slate-500/10 border-slate-500/30" },
  in_progress: { label: "Идёт оценка",     color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  completed:   { label: "Завершена",        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  on_hold:     { label: "Приостановлена",  color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
};

function LevelBar({ level, max = 3 }: { level: number; max?: number }) {
  const pct = (level / max) * 100;
  const color = level === 0 ? "bg-slate-500" : level === 1 ? "bg-amber-500" : level === 2 ? "bg-blue-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 bg-background/60 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-xs font-bold font-mono w-5 text-right", level === 0 ? "text-slate-400" : level === 1 ? "text-amber-400" : level === 2 ? "text-blue-400" : "text-emerald-400")}>
        {level.toFixed(1)}
      </span>
    </div>
  );
}

export function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/metrics`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить метрики");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-12 h-12 text-destructive/50 mb-4" />
        <p className="text-xl font-bold font-display">Ошибка загрузки</p>
        <p className="text-muted-foreground text-sm mt-2">{error}</p>
      </div>
    );
  }

  const totalTeams = data.teams.length;
  const avgLevel = totalTeams ? data.teams.reduce((s, t) => s + t.overallLevel, 0) / totalTeams : 0;
  const sortedTeams = [...data.teams].sort((a, b) => b.overallLevel - a.overallLevel);
  const weakestSkills = [...data.skillAverages].sort((a, b) => a.avgLevel - b.avgLevel).slice(0, 5);
  const strongestSkills = [...data.skillAverages].sort((a, b) => b.avgLevel - a.avgLevel).slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1800px] mx-auto pb-20">

      {/* Заголовок */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <BarChart2 size={20} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight font-display">Company Metrics</h1>
        </div>
        <p className="text-muted-foreground text-lg">Сводная аналитика зрелости QA по всем командам</p>
      </div>

      {/* KPI карточки */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1">Всего команд</p>
          <p className="text-3xl font-black font-display text-foreground">{totalTeams}</p>
        </div>
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1">Средний уровень</p>
          <p className={cn("text-3xl font-black font-display",
            avgLevel < 1 ? "text-slate-400" : avgLevel < 2 ? "text-amber-400" : avgLevel < 2.5 ? "text-blue-400" : "text-emerald-400"
          )}>
            {avgLevel.toFixed(2)}
          </p>
        </div>
        {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
          <div key={key} className={cn("border rounded-2xl p-5 shadow-sm", color)}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-70">{label}</p>
            <p className="text-3xl font-black font-display">{data.statusSummary[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Рейтинг команд + слабые/сильные навыки */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
        {/* Рейтинг команд */}
        <div className="xl:col-span-1 bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5 flex items-center gap-2">
            <TrendingUp size={14} /> Рейтинг команд
          </h3>
          <div className="flex flex-col gap-3">
            {sortedTeams.map((team, idx) => (
              <div key={team.id} className="flex items-center gap-3">
                <span className="w-5 text-right text-[11px] font-bold text-muted-foreground/40 shrink-0">{idx + 1}</span>
                <span className="text-sm font-medium text-foreground/80 flex-1 truncate">{team.name}</span>
                <LevelBar level={team.overallLevel} />
              </div>
            ))}
          </div>
        </div>

        {/* Слабейшие навыки */}
        <div className="xl:col-span-1 bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5 flex items-center gap-2">
            <TrendingDown size={14} className="text-destructive/60" /> Слабые навыки
          </h3>
          <div className="flex flex-col gap-3">
            {weakestSkills.map((skill) => (
              <div key={skill.skillId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/80 truncate">{skill.skillName}</p>
                  <p className="text-[10px] text-muted-foreground/40">{skill.category}</p>
                </div>
                <LevelBar level={parseFloat(skill.avgLevel.toFixed(2))} />
              </div>
            ))}
          </div>
        </div>

        {/* Сильнейшие навыки */}
        <div className="xl:col-span-1 bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5 flex items-center gap-2">
            <Minus size={14} className="text-emerald-500/60" /> Сильные навыки
          </h3>
          <div className="flex flex-col gap-3">
            {strongestSkills.map((skill) => (
              <div key={skill.skillId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/80 truncate">{skill.skillName}</p>
                  <p className="text-[10px] text-muted-foreground/40">{skill.category}</p>
                </div>
                <LevelBar level={parseFloat(skill.avgLevel.toFixed(2))} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Тепловая карта */}
      <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm overflow-x-auto">
        <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5">
          Тепловая карта: команды × навыки
        </h3>
        <table className="w-full text-xs border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-muted-foreground/50 font-semibold min-w-[140px] sticky left-0 bg-card/80 rounded-lg">Команда</th>
              {data.heatmap[0]?.skills.map((s) => (
                <th key={s.skillId} className="px-1 py-2 text-center font-medium text-muted-foreground/40 min-w-[40px] max-w-[60px]">
                  <div className="writing-mode-vertical [writing-mode:vertical-lr] rotate-180 text-[9px] whitespace-nowrap overflow-hidden h-20 leading-none">
                    {s.skillName}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.heatmap.map(({ team, skills }) => (
              <tr key={team.id}>
                <td className="px-3 py-1.5 font-medium text-foreground/80 sticky left-0 bg-card/80 rounded-l-lg whitespace-nowrap">
                  {team.name}
                  <span className={cn("ml-2 text-[10px] font-bold font-mono",
                    team.overallLevel === 0 ? "text-slate-400" : team.overallLevel === 1 ? "text-amber-400" : team.overallLevel === 2 ? "text-blue-400" : "text-emerald-400"
                  )}>L{team.overallLevel}</span>
                </td>
                {skills.map((s) => (
                  <td key={s.skillId} className={cn("text-center rounded font-bold font-mono", LEVEL_COLORS_CELL[s.level])}>
                    {s.level}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </motion.div>
  );
}
