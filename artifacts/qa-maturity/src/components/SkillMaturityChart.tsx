/**
 * SkillMaturityChart — динамика зрелости навыков.
 *
 * Показывает распределение количества всех навыков по уровням зрелости (0/1/2/3)
 * в разрезе дат за выбранный период.
 *
 * Данные: skillDistribution из GET /api/metrics/history
 */

import { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

interface SkillDistribution {
  0: number;
  1: number;
  2: number;
  3: number;
}

interface SnapshotData {
  date: string;
  teamDistribution: { 0: number; 1: number; 2: number; 3: number };
  skillDistribution: SkillDistribution;
}

interface SkillMaturityChartProps {
  data: SnapshotData[];
  isLoading: boolean;
}

// Форматирование даты для оси X
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// Форматирование даты для тултипа
function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

// Цвета для уровней
const LEVEL_COLORS = {
  0: { fill: "hsl(210, 10%, 50%)", label: "Уровень 0" },
  1: { fill: "hsl(38, 90%, 50%)", label: "Уровень 1" },
  2: { fill: "hsl(217, 90%, 50%)", label: "Уровень 2" },
  3: { fill: "hsl(160, 80%, 40%)", label: "Уровень 3" },
};

export function SkillMaturityChart({ data, isLoading }: SkillMaturityChartProps) {
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  // Отслеживаем размер контейнера
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      setContainerWidth(width);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Адаптивные размеры
  const fontSize = Math.min(Math.max(containerWidth * 0.025, 11), 16);
  const barMinWidth = Math.max(Math.round(containerWidth * 0.008), 4);
  const barMaxWidth = Math.max(Math.round(containerWidth * 0.02), 12);

  if (isLoading) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground/50 text-sm">
        Загрузка данных...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground/50 text-sm">
        Нет данных за выбранный период
      </div>
    );
  }

  // Кастомный тултип
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const tooltipFontSize = Math.max(Math.round(fontSize * 0.75), 10);

      // Считаем общее количество навыков
      const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);

      return (
        <div
          style={{
            backgroundColor: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            padding: `${Math.round(fontSize * 0.75)}px`,
            border: '1px solid',
            minWidth: `${fontSize * 12}px`,
            fontSize: `${tooltipFontSize}px`
          }}
        >
          <p style={{
            color: 'hsl(var(--foreground))',
            marginBottom: `${Math.round(fontSize * 0.5)}px`,
            fontWeight: 'bold',
            borderBottom: '1px solid hsl(var(--border))',
            paddingBottom: `${Math.round(fontSize * 0.4)}px`,
            fontSize: `${Math.round(fontSize * 0.9)}px`
          }}>
            {formatDateLong(label)}
          </p>
          <div style={{ display: 'grid', gap: `${Math.round(fontSize * 0.3)}px` }}>
            {payload.map((p: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: `${Math.round(fontSize * 0.8)}px`, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(fontSize * 0.3)}px` }}>
                  <div style={{ width: `${Math.round(fontSize * 0.6)}px`, height: `${Math.round(fontSize * 0.6)}px`, borderRadius: '50%', backgroundColor: p.color }} />
                  <span style={{ color: p.color, fontWeight: 500 }}>{p.name}</span>
                </div>
                <span style={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}>{p.value} нав.</span>
              </div>
            ))}
          </div>
          <p style={{
            color: 'hsl(var(--muted-foreground))',
            marginTop: `${Math.round(fontSize * 0.5)}px`,
            paddingTop: `${Math.round(fontSize * 0.4)}px`,
            borderTop: '1px dashed hsl(var(--border))',
            fontSize: `${Math.round(fontSize * 0.7)}px`,
            fontWeight: 'bold'
          }}>
            Всего: {total} нав.
          </p>
        </div>
      );
    }
    return null;
  };

  // Кастомные тики для оси X с углом
  const CustomXAxisTick = ({ x, y, payload }: any) => {
    if (!x || !y || !payload) return null;
    return (
      <text
        x={x}
        y={y + 10}
        textAnchor="end"
        fill="hsl(var(--muted-foreground))"
        fontSize={Math.round(fontSize * 0.7)}
        transform={`rotate(-45 ${x} ${y})`}
        style={{ pointerEvents: 'none' }}
      >
        {formatDate(payload.value)}
      </text>
    );
  };

  // Подготовка данных для графика
  const chartData = data.map(d => ({
    date: d.date,
    level0: d.skillDistribution[0],
    level1: d.skillDistribution[1],
    level2: d.skillDistribution[2],
    level3: d.skillDistribution[3],
  }));

  return (
    <div ref={containerRef} className="flex flex-col h-[400px]">
      {/* График */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
            />
            <XAxis
              dataKey="date"
              tick={<CustomXAxisTick />}
              height={60}
              stroke="hsl(var(--muted-foreground))"
              fontSize={Math.round(fontSize * 0.7)}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={Math.round(fontSize * 0.8)}
              allowDecimals={false}
              label={{
                value: 'Навыков',
                angle: -90,
                position: 'insideLeft',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: Math.round(fontSize * 0.75),
                fontWeight: 500
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                fontSize: `${Math.round(fontSize * 0.8)}px`,
                paddingTop: `${Math.round(fontSize * 0.5)}px`
              }}
            />
            <Bar
              dataKey="level0"
              name="Уровень 0"
              fill={LEVEL_COLORS[0].fill}
              radius={[4, 4, 0, 0]}
              minPointSize={barMinWidth}
              maxBarSize={barMaxWidth}
              stackId="levels"
            />
            <Bar
              dataKey="level1"
              name="Уровень 1"
              fill={LEVEL_COLORS[1].fill}
              radius={[4, 4, 0, 0]}
              minPointSize={barMinWidth}
              maxBarSize={barMaxWidth}
              stackId="levels"
            />
            <Bar
              dataKey="level2"
              name="Уровень 2"
              fill={LEVEL_COLORS[2].fill}
              radius={[4, 4, 0, 0]}
              minPointSize={barMinWidth}
              maxBarSize={barMaxWidth}
              stackId="levels"
            />
            <Bar
              dataKey="level3"
              name="Уровень 3"
              fill={LEVEL_COLORS[3].fill}
              radius={[4, 4, 0, 0]}
              minPointSize={barMinWidth}
              maxBarSize={barMaxWidth}
              stackId="levels"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
