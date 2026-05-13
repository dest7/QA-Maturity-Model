/**
 * ToolMetricsTab — вкладка метрик использования инструмента QMM.
 * 
 * Метрики Фазы 1 (P0):
 * 1. Количество команд, оценивших себя по модели зрелости
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, Users, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ToolAdoptionData {
  period: "week" | "month" | "quarter" | "year";
  days: number;
  summary: {
    totalTeams: number;
    assessedInPeriod: number;
    statusCounts: {
      planned: number;
      in_progress: number;
      completed: number;
      on_hold: number;
    };
  };
  byPeriod: Array<{ date: string; count: number }>;
}

const STATUS_COLORS = {
  planned: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  in_progress: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  on_hold: "text-amber-400 bg-amber-500/10 border-amber-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланирована",
  in_progress: "В процессе",
  completed: "Завершена",
  on_hold: "Приостановлена",
};

export function ToolMetricsTab({ orgUnitId }: { orgUnitId?: number | null }) {
  const [data, setData] = useState<ToolAdoptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const url = orgUnitId
      ? `${BASE}/api/metrics/tool/adoption?period=${period}&orgUnitId=${orgUnitId}`
      : `${BASE}/api/metrics/tool/adoption?period=${period}`;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить метрики инструмента");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [period, orgUnitId]);

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground/50 text-sm">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Загрузка метрик инструмента...
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

  // Кастомный тултип для графика
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const count = payload[0].value ?? 0;
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
          <p style={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '4px' }}>
            {new Date(label).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p style={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}>
            {count} {count === 1 ? 'команда' : count < 5 ? 'команды' : 'команд'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Форматирование даты для оси X
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const totalTeams = data.summary.totalTeams;
  const assessedInPeriod = data.summary.assessedInPeriod;
  const completionRate = totalTeams > 0 
    ? ((data.summary.statusCounts.completed / totalTeams) * 100).toFixed(1)
    : "0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* KPI карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Всего команд */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Всего команд</p>
          </div>
          <p className="text-3xl font-black font-display text-foreground">{totalTeams}</p>
        </div>

        {/* Оценили за период */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Оценили за период</p>
          </div>
          <p className="text-3xl font-black font-display text-emerald-400">{assessedInPeriod}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {period === "week" ? "за неделю" : period === "month" ? "за месяц" : period === "quarter" ? "за квартал" : "за год"}
          </p>
        </div>

        {/* Завершили оценку */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Завершили оценку</p>
          </div>
          <p className="text-3xl font-black font-display text-foreground">
            {data.summary.statusCounts.completed}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {completionRate}% от всех
          </p>
        </div>

        {/* В процессе */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-muted-foreground/50" />
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">В процессе</p>
          </div>
          <p className="text-3xl font-black font-display text-blue-400">
            {data.summary.statusCounts.in_progress}
          </p>
        </div>
      </div>

      {/* Статусы оценок */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(data.summary.statusCounts).map(([status, count]) => (
          <div key={status} className={cn("border rounded-2xl p-5 shadow-sm", STATUS_COLORS[status as keyof typeof STATUS_COLORS])}>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-70">{STATUS_LABELS[status]}</p>
            <p className="text-3xl font-black font-display">{count}</p>
          </div>
        ))}
      </div>

      {/* График динамики */}
      <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70">
            Динамика завершения оценок
          </h3>
          <div className="flex items-center gap-1.5 bg-background/50 rounded-lg p-0.5 border border-border/50">
            {(["week", "month", "quarter", "year"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                  period === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "week" ? "Неделя" : p === "month" ? "Месяц" : p === "quarter" ? "Квартал" : "Год"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[300px]">
          {data.byPeriod.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.byPeriod}
                margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={({ x, y, payload }: any) => (
                    <text x={x} y={y + 10} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11} transform={`rotate(-45 ${x} ${y})`}>
                      {formatDate(payload.value)}
                    </text>
                  )}
                  height={60}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  allowDecimals={false}
                  label={{
                    value: 'Команд',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 11,
                    fontWeight: 500
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
              Нет данных за выбранный период
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
