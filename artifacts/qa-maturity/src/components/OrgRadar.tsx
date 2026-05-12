/**
 * OrgRadar — радар зрелости для страницы Company Metrics.
 *
 * Два режима:
 * - "average" (по умолчанию): одна паутинка — среднее по всем командам
 * - "range": среднее + стандартное отклонение + распределение по уровням
 *
 * Все размеры адаптивные — масштабируются пропорционально контейнеру.
 *
 * Данные: heatmap из /api/metrics — массив команд с навыками и уровнями.
 */

import { useState, useEffect, useRef } from "react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

interface SkillLevel {
  skillId: number;
  skillName: string;
  category: string;
  level: number;
}

interface TeamHeatmap {
  team: { id: number; name: string; overallLevel: number; orgUnitId?: number | null };
  skills: SkillLevel[];
}

interface OrgRadarProps {
  heatmap: TeamHeatmap[];
}

// Вычисление стандартного отклонения
function calculateStdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

// Оценка консистентности по стандартному отклонению
function getConsistency(stdDev: number): { label: string; icon: string; color: string } {
  if (stdDev < 0.5) {
    return { label: "Высокая", icon: "🟢", color: "text-emerald-500" };
  } else if (stdDev <= 1.0) {
    return { label: "Средняя", icon: "🟡", color: "text-amber-500" };
  } else {
    return { label: "Низкая", icon: "🔴", color: "text-red-500" };
  }
}

// Кастомный тик для PolarAngleAxis с отступом от паутинки
interface CustomAngleTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  textAnchor?: string;
  fontSize: number;
}

const CustomAngleTick: React.FC<CustomAngleTickProps> = ({ x, y, payload, textAnchor, fontSize }) => {
  if (!x || !y || !payload) return null;
  
  // Отступ от края паутинки (в пикселях)
  const offset = 8;
  
  // Вычисляем угол относительно центра (предполагаем центр ~150,150 для расчёта направления)
  // На самом деле recharts уже дал нам финальные координаты, нужно просто сдвинуть от центра
  // Используем нормализацию: сдвиг на offset пикселей от центра наружу
  const centerX = 150; // условный центр, recharts сам позиционирует
  const centerY = 150;
  
  const dx = (x - centerX);
  const dy = (y - centerY);
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Нормализуем и применяем отступ
  const offsetX = distance > 0 ? (dx / distance) * offset : 0;
  const offsetY = distance > 0 ? (dy / distance) * offset : 0;
  
  return (
    <text
      x={x + offsetX}
      y={y + offsetY}
      textAnchor={textAnchor}
      fill="hsl(var(--muted-foreground))"
      fontSize={fontSize}
      fontWeight={500}
      style={{ pointerEvents: 'none' }}
    >
      {payload.value}
    </text>
  );
};

export function OrgRadar({ heatmap }: OrgRadarProps) {
  const [mode, setMode] = useState<"average" | "range">("average");
  const [containerWidth, setContainerWidth] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  // Отслеживаем размер контейнера для адаптивных расчётов
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      setContainerWidth(width);
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Адаптивные размеры на основе ширины контейнера
  const fontSize = Math.min(Math.max(containerWidth * 0.035, 12), 20);  // 12-20px
  const axisFontSize = Math.round(fontSize * 0.75);  // ~75% от основного
  const outerRadiusPercent = Math.min(Math.max(containerWidth * 0.08, 65), 80);  // 65-80%
  const activeDotRadius = Math.round(fontSize * 0.5);  // пропорционально шрифту
  const strokeWidth = Math.max(Math.round(fontSize * 0.18), 2);  // толщина линии

  if (!heatmap || heatmap.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground/50 text-sm">
        Нет данных для отображения
      </div>
    );
  }

  // Получаем список всех навыков (берём из первой команды, предполагается что у всех одинаковые навыки)
  const allSkills = heatmap[0]?.skills ?? [];

  // Режим "average": одна паутинка — среднее по всем командам
  const averageData = allSkills.map((skill) => {
    const levels = heatmap.map((h) => h.skills.find((s) => s.skillId === skill.skillId)?.level ?? 0);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    return {
      subject: skill.skillName,
      value: Math.round(avg * 100) / 100,
      fullMark: 3
    };
  });

  // Режим "range": среднее + стандартное отклонение + распределение по уровням
  const rangeData = allSkills.map((skill) => {
    const levels = heatmap.map((h) => h.skills.find((s) => s.skillId === skill.skillId)?.level ?? 0);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const stdDev = calculateStdDev(levels, avg);
    
    // Распределение по уровням [L0, L1, L2, L3]
    const distribution = [0, 1, 2, 3].map(lvl => levels.filter(l => l === lvl).length);
    
    const consistency = getConsistency(stdDev);
    
    return {
      subject: skill.skillName,
      average: Math.round(avg * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      distribution,
      consistency,
      fullMark: 3
    };
  });

  // Кастомный тултип с адаптивным шрифтом
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;

      const tooltipFontSize = Math.max(Math.round(fontSize * 0.7), 10);

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
            {label}
          </p>
          {mode === "average" ? (
            <p style={{ 
              color: 'hsl(var(--primary))', 
              fontWeight: 'bold', 
              fontSize: `${Math.round(fontSize * 0.85)}px` 
            }}>
              Среднее: {data.value?.toFixed(2) ?? '0'} / 3
            </p>
          ) : (
            <div style={{ fontSize: `${tooltipFontSize}px` }}>
              {/* Среднее ± стандартное отклонение */}
              <div style={{ marginBottom: `${Math.round(fontSize * 0.6)}px` }}>
                <p style={{ 
                  color: 'hsl(var(--foreground))', 
                  fontWeight: 'bold', 
                  marginBottom: `${Math.round(fontSize * 0.3)}px`, 
                  fontSize: `${Math.round(fontSize * 0.85)}px` 
                }}>
                  {data.average?.toFixed(2) ?? '0'} / 3  ±  {data.stdDev?.toFixed(2) ?? '0'}
                  <span style={{ marginLeft: `${Math.round(fontSize * 0.4)}px` }}>{data.consistency?.icon}</span>
                </p>
                <p style={{ 
                  color: 'hsl(var(--muted-foreground))', 
                  fontSize: `${Math.round(fontSize * 0.7)}px` 
                }}>
                  Консистентность: <span className={data.consistency?.color}>{data.consistency?.label}</span>
                </p>
              </div>
              
              {/* Распределение по уровням */}
              <div>
                <p style={{ 
                  color: 'hsl(var(--muted-foreground))', 
                  fontWeight: 'bold', 
                  marginBottom: `${Math.round(fontSize * 0.3)}px`, 
                  fontSize: `${Math.round(fontSize * 0.65)}px`, 
                  textTransform: 'uppercase' 
                }}>
                  Распределение
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${Math.round(fontSize * 0.3)}px` }}>
                  {data.distribution?.map((count: number, idx: number) => {
                    const maxCount = Math.max(...data.distribution);
                    const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(fontSize * 0.25)}px` }}>
                        <span style={{ 
                          color: 'hsl(var(--muted-foreground))', 
                          fontSize: `${Math.round(fontSize * 0.6)}px`, 
                          width: `${fontSize * 1.8}px` 
                        }}>L{idx}:</span>
                        <div style={{ 
                          flex: 1, 
                          height: `${Math.round(fontSize * 0.5)}px`, 
                          backgroundColor: 'hsl(var(--border))', 
                          borderRadius: '2px', 
                          overflow: 'hidden' 
                        }}>
                          <div 
                            style={{ 
                              width: `${barWidth}%`, 
                              height: '100%',
                              backgroundColor: idx === 0 ? 'hsl(210, 10%, 50%)' : 
                                             idx === 1 ? 'hsl(38, 90%, 50%)' : 
                                             idx === 2 ? 'hsl(217, 90%, 50%)' : 
                                             'hsl(160, 80%, 40%)'
                            }} 
                          />
                        </div>
                        <span style={{ 
                          color: 'hsl(var(--foreground))', 
                          fontSize: `${Math.round(fontSize * 0.6)}px`, 
                          width: `${fontSize * 1.5}px`, 
                          textAlign: 'right' 
                        }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div ref={containerRef} className="flex flex-col h-[400px]">
      {/* Тумблер режима */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">Профиль зрелости</span>
        <div className="flex items-center gap-2 bg-background/50 rounded-lg p-0.5 border border-border/50">
          <button
            onClick={() => setMode("average")}
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
              mode === "average"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Среднее
          </button>
          <button
            onClick={() => setMode("range")}
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
              mode === "range"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Диапазон
          </button>
        </div>
      </div>

      {/* Радар */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart 
            key={mode} 
            cx="50%" 
            cy="50%" 
            outerRadius={`${outerRadiusPercent}%`} 
            data={mode === "average" ? averageData : rangeData}
          >
            <PolarGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <PolarAngleAxis
              dataKey="subject"
              tick={<CustomAngleTick fontSize={axisFontSize} />}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 3]}
              tick={{ 
                fill: 'hsl(var(--foreground))', 
                fontSize: Math.round(axisFontSize * 0.85), 
                fontWeight: 'bold' 
              }}
              tickCount={4}
            />

            {mode === "average" ? (
              // Одна паутинка — среднее
              <Radar
                name="Среднее"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                fill="hsl(var(--primary))"
                fillOpacity={0.25}
                activeDot={{ 
                  r: activeDotRadius, 
                  fill: "hsl(var(--primary))", 
                  stroke: "hsl(var(--background))", 
                  strokeWidth: Math.max(Math.round(strokeWidth * 0.6), 1) 
                }}
              />
            ) : (
              // Режим "Диапазон": среднее с отклонением
              <Radar
                name="Среднее"
                dataKey="average"
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                activeDot={{ 
                  r: activeDotRadius, 
                  fill: "hsl(var(--primary))", 
                  stroke: "hsl(var(--background))", 
                  strokeWidth: Math.max(Math.round(strokeWidth * 0.6), 1) 
                }}
              />
            )}

            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
