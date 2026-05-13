/**
 * SkillsMetricsTab — вкладка метрик навыков.
 * 
 * Метрики Фазы 1 (P0):
 * 5. Среднее время перехода по уровням навыков
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TransitionData {
  from: number;
  to: number;
  avgDays: number | null;
  count: number;
}

interface SkillTransitionData {
  skillId: number;
  skillName: string;
  category: string;
  transitions: TransitionData[];
  overallAvgDays: number | null;
}

interface SkillsTransitionTimeData {
  bySkill: SkillTransitionData[];
  overall: {
    avgDays: number | null;
    skillsCount: number;
  };
}

const TRANSITION_COLORS = ["hsl(217, 90%, 50%)", "hsl(38, 90%, 50%)", "hsl(160, 80%, 40%)"];

export function SkillsMetricsTab({ orgUnitId }: { orgUnitId?: number | null }) {
  const [data, setData] = useState<SkillsTransitionTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const url = orgUnitId
      ? `${BASE}/api/metrics/skills/transition-time?orgUnitId=${orgUnitId}`
      : `${BASE}/api/metrics/skills/transition-time`;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить метрики навыков");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [orgUnitId]);

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground/50 text-sm">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Загрузка метрик навыков...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-12 h-12 text-destructive/50 mb-4" />
        <p className="text-xl font-bold font-display">Ошибка загрузки</p>
        <p className="text-muted-foreground text-sm mt-2">{error}</p>
      </div>
    );
  }

  // Подготовка данных для графика
  const chartData = data.bySkill.map((skill) => ({
    name: skill.skillName.length > 20 ? skill.skillName.substring(0, 20) + "..." : skill.skillName,
    transition01: skill.transitions[0]?.avgDays ?? 0,
    transition12: skill.transitions[1]?.avgDays ?? 0,
    transition23: skill.transitions[2]?.avgDays ?? 0,
    category: skill.category,
  }));

  // Кастомный тултип
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            padding: '12px',
            border: '1px solid',
            fontSize: '12px'
          }}
        >
          <p style={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '8px' }}>{label}</p>
          {payload.map((p: any, idx: number) => {
            const transitionNames = ["0 → 1", "1 → 2", "2 → 3"];
            const value = p.value ?? 0;
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                <span style={{ color: p.color }}>{transitionNames[idx]}:</span>
                <span style={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}>
                  {value > 0 ? `${value.toFixed(1)} дн.` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* KPI карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Среднее время по всем навыкам */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Среднее время перехода</p>
          </div>
          {data.overall.avgDays !== null ? (
            <p className="text-3xl font-black font-display text-foreground">
              {data.overall.avgDays.toFixed(1)} <span className="text-lg font-medium text-muted-foreground">дней</span>
            </p>
          ) : (
            <p className="text-xl font-medium text-muted-foreground">Нет данных</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            По {data.overall.skillsCount} навыкам
          </p>
        </div>

        {/* Количество переходов */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Всего переходов</p>
          </div>
          <p className="text-3xl font-black font-display text-foreground">
            {data.bySkill.reduce((sum, skill) => 
              sum + skill.transitions.reduce((s, t) => s + t.count, 0), 0
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            За всю историю
          </p>
        </div>
      </div>

      {/* График по навыкам */}
      <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
        <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5">
          Время перехода по навыкам
        </h3>
        <div className="h-[400px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  label={{
                    value: 'Дней',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                    fontWeight: 500
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                <Bar dataKey="transition01" name="0 → 1" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-0-${index}`} fill={entry.transition01 > 0 ? TRANSITION_COLORS[0] : "hsl(210, 10%, 30%)"} />
                  ))}
                </Bar>
                <Bar dataKey="transition12" name="1 → 2" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-1-${index}`} fill={entry.transition12 > 0 ? TRANSITION_COLORS[1] : "hsl(210, 10%, 30%)"} />
                  ))}
                </Bar>
                <Bar dataKey="transition23" name="2 → 3" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-2-${index}`} fill={entry.transition23 > 0 ? TRANSITION_COLORS[2] : "hsl(210, 10%, 30%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
              Нет данных для отображения
            </div>
          )}
        </div>
      </div>

      {/* Таблица по навыкам */}
      <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm overflow-x-auto">
        <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5">
          Детализация по навыкам
        </h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground/70">Навык</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground/70">Категория</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground/70">0 → 1</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground/70">1 → 2</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground/70">2 → 3</th>
              <th className="text-center py-3 px-4 font-semibold text-muted-foreground/70">Среднее</th>
            </tr>
          </thead>
          <tbody>
            {data.bySkill.map((skill) => (
              <tr key={skill.skillId} className="border-b border-border/30 hover:bg-sidebar-accent/30 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground/80">{skill.skillName}</td>
                <td className="py-3 px-4 text-center text-muted-foreground/60">{skill.category}</td>
                <td className="py-3 px-4 text-center">
                  {skill.transitions[0]?.avgDays !== null && skill.transitions[0]?.avgDays !== undefined ? (
                    <span className="inline-block px-2 py-1 rounded bg-blue-500/10 text-blue-400 font-mono text-xs">
                      {skill.transitions[0].avgDays.toFixed(1)} дн.
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {skill.transitions[1]?.avgDays !== null && skill.transitions[1]?.avgDays !== undefined ? (
                    <span className="inline-block px-2 py-1 rounded bg-amber-500/10 text-amber-400 font-mono text-xs">
                      {skill.transitions[1].avgDays.toFixed(1)} дн.
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {skill.transitions[2]?.avgDays !== null && skill.transitions[2]?.avgDays !== undefined ? (
                    <span className="inline-block px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs">
                      {skill.transitions[2].avgDays.toFixed(1)} дн.
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {skill.overallAvgDays !== null ? (
                    <span className="inline-block px-2 py-1 rounded bg-primary/10 text-primary font-mono text-xs font-bold">
                      {skill.overallAvgDays.toFixed(1)} дн.
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
