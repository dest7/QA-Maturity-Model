/**
 * TeamsMetricsTab — вкладка метрик команд.
 * 
 * Метрики Фазы 1 (P0):
 * 1. Распределение команд по уровням зрелости и критичности (MC/BC+/BC)
 * 2. Динамика перехода между уровнями (гистограмма)
 * 4. Pie chart распределения команд по уровням
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, PieChart, TrendingUp, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamMaturityChart } from "@/components/TeamMaturityChart";
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TeamCriticalityData {
  summary: {
    totalTeams: number;
    avgLevel: number;
  };
  byCriticality: Array<{
    criticality: "MC" | "BC+" | "BC";
    count: number;
    distribution: { 0: number; 1: number; 2: number; 3: number };
    avgLevel: number;
    teams: Array<{ id: number; name: string; overallLevel: number }>;
  }>;
}

interface SnapshotData {
  date: string;
  teamDistribution: { 0: number; 1: number; 2: number; 3: number };
  skillDistribution: { 0: number; 1: number; 2: number; 3: number };
}

interface TeamByTypeData {
  type: "product" | "platform" | "service";
  count: number;
  distribution: { 0: number; 1: number; 2: number; 3: number };
  avgLevel: number;
  teams: Array<{ id: number; name: string; overallLevel: number }>;
}

interface TeamsByTypeResponse {
  byType: TeamByTypeData[];
}

const LEVEL_COLORS = {
  0: { fill: "hsl(210, 10%, 50%)", label: "Начальный", bg: "bg-slate-500", text: "text-slate-400" },
  1: { fill: "hsl(38, 90%, 50%)", label: "Развитие", bg: "bg-amber-500", text: "text-amber-400" },
  2: { fill: "hsl(217, 90%, 50%)", label: "Эффективность", bg: "bg-blue-500", text: "text-blue-400" },
  3: { fill: "hsl(160, 80%, 40%)", label: "Оптимизация", bg: "bg-emerald-500", text: "text-emerald-400" },
};

const CRITICALITY_COLORS: Record<"MC" | "BC+" | "BC" | "BO" | "OP", string> = {
  "MC": "text-red-400 bg-red-500/10 border-red-500/30",
  "BC+": "text-amber-400 bg-amber-500/10 border-amber-500/30",
  "BC": "text-blue-400 bg-blue-500/10 border-blue-500/30",
  "BO": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  "OP": "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

export function TeamsMetricsTab({ orgUnitId }: { orgUnitId?: number | null }) {
  const [criticalityData, setCriticalityData] = useState<TeamCriticalityData | null>(null);
  const [isCriticalityLoading, setIsCriticalityLoading] = useState(true);
  const [criticalityError, setCriticalityError] = useState<string | null>(null);

  // Гистограмма
  const [histogramPeriod, setHistogramPeriod] = useState<"week" | "month" | "quarter" | "year">("week");
  const [histogramData, setHistogramData] = useState<SnapshotData[]>([]);
  const [isHistogramLoading, setIsHistogramLoading] = useState(false);

  // Метрики по типам команд
  const [teamsByTypeData, setTeamsByTypeData] = useState<TeamByTypeData[] | null>(null);
  const [isTeamsByTypeLoading, setIsTeamsByTypeLoading] = useState(true);

  // Pie chart
  const [pieData, setPieData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [containerWidth, setContainerWidth] = useState(400);
  const pieRef = useRef<HTMLDivElement>(null);

  // Загрузка данных критичности
  useEffect(() => {
    setIsCriticalityLoading(true);
    setCriticalityError(null);
    const url = orgUnitId
      ? `${BASE}/api/metrics/teams/criticality?orgUnitId=${orgUnitId}`
      : `${BASE}/api/metrics/teams/criticality`;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить метрики критичности");
        return res.json();
      })
      .then(setCriticalityData)
      .catch((e) => setCriticalityError(e.message))
      .finally(() => setIsCriticalityLoading(false));
  }, [orgUnitId]);

  // Загрузка данных гистограммы
  useEffect(() => {
    setIsHistogramLoading(true);
    const url = orgUnitId
      ? `${BASE}/api/metrics/history?period=${histogramPeriod}&orgUnitId=${orgUnitId}`
      : `${BASE}/api/metrics/history?period=${histogramPeriod}`;
    fetch(url, { credentials: "include" })
      .then((res) => res.ok ? res.json() : Promise.resolve({ snapshots: [] }))
      .then((result) => setHistogramData(result.snapshots || []))
      .catch(() => setHistogramData([]))
      .finally(() => setIsHistogramLoading(false));
  }, [histogramPeriod, orgUnitId]);

  // Загрузка данных по типам команд
  useEffect(() => {
    setIsTeamsByTypeLoading(true);
    const url = orgUnitId
      ? `${BASE}/api/metrics/teams/by-type?orgUnitId=${orgUnitId}`
      : `${BASE}/api/metrics/teams/by-type`;
    fetch(url, { credentials: "include" })
      .then((res) => res.ok ? res.json() : Promise.resolve({ byType: [] }))
      .then((result: TeamsByTypeResponse) => setTeamsByTypeData(result.byType || []))
      .catch(() => setTeamsByTypeData(null))
      .finally(() => setIsTeamsByTypeLoading(false));
  }, [orgUnitId]);

  // Подготовка данных для Pie chart
  useEffect(() => {
    if (!criticalityData) return;
    
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const crit of criticalityData.byCriticality) {
      distribution[0] += crit.distribution[0];
      distribution[1] += crit.distribution[1];
      distribution[2] += crit.distribution[2];
      distribution[3] += crit.distribution[3];
    }
    
    setPieData([
      { name: "Начальный", value: distribution[0], color: LEVEL_COLORS[0].fill },
      { name: "Развитие", value: distribution[1], color: LEVEL_COLORS[1].fill },
      { name: "Эффективность", value: distribution[2], color: LEVEL_COLORS[2].fill },
      { name: "Оптимизация", value: distribution[3], color: LEVEL_COLORS[3].fill },
    ]);
  }, [criticalityData]);

  // Отслеживаем размер контейнера для Pie chart
  useEffect(() => {
    if (!pieRef.current) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      setContainerWidth(width);
    });
    observer.observe(pieRef.current);
    return () => observer.disconnect();
  }, []);

  if (isCriticalityLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground/50 text-sm">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Загрузка метрик команд...
      </div>
    );
  }

  if (criticalityError || !criticalityData) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-12 h-12 text-destructive/50 mb-4" />
        <p className="text-xl font-bold font-display">Ошибка загрузки</p>
        <p className="text-muted-foreground text-sm mt-2">{criticalityError}</p>
      </div>
    );
  }

  const totalTeams = criticalityData.summary.totalTeams;
  const avgLevel = criticalityData.summary.avgLevel;

  // Кастомный тултип для Pie chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totalTeams > 0 ? ((data.value / totalTeams) * 100).toFixed(1) : "0";
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
          <p style={{ color: data.color, fontWeight: 'bold', marginBottom: '4px' }}>{data.name}</p>
          <p style={{ color: 'hsl(var(--foreground))' }}>
            <strong>{data.value}</strong> команд ({percentage}%)
          </p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Всего команд */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Всего команд</p>
          </div>
          <p className="text-3xl font-black font-display text-foreground">{totalTeams}</p>
        </div>

        {/* Средний уровень */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Средний уровень</p>
          </div>
          <p className={cn(
            "text-3xl font-black font-display",
            avgLevel < 1 ? "text-slate-400" : avgLevel < 2 ? "text-amber-400" : avgLevel < 2.5 ? "text-blue-400" : "text-emerald-400"
          )}>
            {avgLevel.toFixed(2)}
          </p>
        </div>

        {/* По критичности */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <PieChart className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">По критичности</p>
          </div>
          <div className="flex gap-2">
            {criticalityData.byCriticality.map((crit) => (
              <div key={crit.criticality} className={cn("px-2 py-1 rounded-lg border text-xs font-bold", CRITICALITY_COLORS[crit.criticality])}>
                {crit.criticality}: {crit.count}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Распределение по критичности и уровням */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* MC команды */}
        {criticalityData.byCriticality.map((crit) => (
          <div key={crit.criticality} className={cn("border rounded-2xl p-5 shadow-sm", CRITICALITY_COLORS[crit.criticality])}>
            <h3 className="font-display font-bold text-sm uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>{crit.criticality} — {crit.count} команд</span>
              <span className="text-xs opacity-70">Ср: {crit.avgLevel.toFixed(1)}</span>
            </h3>
            <div className="space-y-2">
              {Object.entries(crit.distribution).map(([level, count]) => {
                const levelNum = parseInt(level);
                const color = LEVEL_COLORS[levelNum as keyof typeof LEVEL_COLORS];
                return (
                  <div key={level} className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium w-24", color.text)}>Уровень {levelNum}</span>
                    <div className="flex-1 h-2 bg-background/60 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", color.bg)} style={{ width: `${crit.count > 0 ? (count / crit.count) * 100 : 0}%` }} />
                    </div>
                    <span className={cn("text-xs font-bold w-6 text-right", color.text)}>{count}</span>
                  </div>
                );
              })}
            </div>
            {/* Список команд */}
            {crit.teams.length > 0 && (
              <div className="mt-4 pt-4 border-t border-current/20">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2">Команды</p>
                <div className="flex flex-wrap gap-1">
                  {crit.teams.slice(0, 10).map((team) => (
                    <span key={team.id} className="text-[10px] px-2 py-1 rounded bg-background/30">
                      {team.name} (L{team.overallLevel})
                    </span>
                  ))}
                  {crit.teams.length > 10 && (
                    <span className="text-[10px] px-2 py-1 opacity-50">+{crit.teams.length - 10} ещё</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Метрики по типам команд */}
      {teamsByTypeData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {teamsByTypeData.map((typeData) => {
            const typeConfig = {
              product: { label: "Продуктовые", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
              platform: { label: "Платформенные", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
              service: { label: "Сервисные", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30" },
            }[typeData.type];
            return (
              <div key={typeData.type} className={cn("border rounded-2xl p-5 shadow-sm", typeConfig.color, typeConfig.bg, typeConfig.border)}>
                <h3 className="font-display font-bold text-sm uppercase tracking-widest mb-4 flex items-center justify-between">
                  <span>{typeConfig.label}</span>
                  <span className="text-xs opacity-70">Ср: {typeData.avgLevel.toFixed(1)}</span>
                </h3>
                <div className="space-y-2">
                  {Object.entries(typeData.distribution).map(([level, count]) => {
                    const levelNum = parseInt(level);
                    const color = LEVEL_COLORS[levelNum as keyof typeof LEVEL_COLORS];
                    return (
                      <div key={level} className="flex items-center gap-2">
                        <span className={cn("text-xs font-medium w-24", color.text)}>Уровень {levelNum}</span>
                        <div className="flex-1 h-2 bg-background/60 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", color.bg)} style={{ width: `${typeData.count > 0 ? (count / typeData.count) * 100 : 0}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold w-6 text-right", color.text)}>{count}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-4 mb-2">Команды: {typeData.count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Гистограмма и Pie chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Гистограмма динамики */}
        <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70">
              Динамика зрелости команд
            </h3>
            <div className="flex items-center gap-1.5 bg-background/50 rounded-lg p-0.5 border border-border/50">
              {(["week", "month", "quarter", "year"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setHistogramPeriod(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                    histogramPeriod === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === "week" ? "Неделя" : p === "month" ? "Месяц" : p === "quarter" ? "Квартал" : "Год"}
                </button>
              ))}
            </div>
          </div>
          <TeamMaturityChart data={histogramData} isLoading={isHistogramLoading} />
        </div>

        {/* Pie chart распределения */}
        <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5">
            Распределение по уровням
          </h3>
          <div ref={pieRef} className="h-[350px]">
            {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={Math.min(containerWidth, 300) * 0.32}
                    label={({ name, value }) => {
                      const percentage = totalTeams > 0 ? ((value / totalTeams) * 100).toFixed(0) : 0;
                      return `${name} (${value}, ${percentage}%)`;
                    }}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, opacity: 0.6 }}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={50}
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{ 
                      paddingTop: '20px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
                Нет данных для отображения
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
