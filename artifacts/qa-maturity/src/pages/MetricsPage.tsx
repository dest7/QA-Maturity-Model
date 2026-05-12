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

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronRight, Network, Building2, X, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrgRadar } from "@/components/OrgRadar";
import { TeamMaturityChart } from "@/components/TeamMaturityChart";
import { SkillMaturityChart } from "@/components/SkillMaturityChart";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TeamRow { id: number; name: string; overallLevel: number; assessmentStatus: string | null; orgUnitId?: number | null; }
interface SkillHeatmapEntry { skillId: number; skillName: string; category: string; level: number; }
interface HeatmapTeam { team: { id: number; name: string; overallLevel: number; orgUnitId?: number | null }; skills: SkillHeatmapEntry[]; }
interface SkillAvg { skillId: number; skillName: string; category: string; avgLevel: number; distribution: number[]; }
interface MetricsData {
  teams: TeamRow[];
  heatmap: HeatmapTeam[];
  skillAverages: SkillAvg[];
  categoryAvgs: { category: string; avgLevel: number }[];
  statusSummary: Record<string, number>;
}

interface SnapshotData {
  date: string;
  teamDistribution: { 0: number; 1: number; 2: number; 3: number };
  skillDistribution: { 0: number; 1: number; 2: number; 3: number };
}

interface OrgUnitNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children: OrgUnitNode[];
  teamCount: number;
}

// ─── Org Unit Picker ─────────────────────────────────────────────────────────

function OrgNodeOption({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: OrgUnitNode;
  selected: number | null;
  onSelect: (id: number | null) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = selected === node.id;
  const Icon = depth === 0 ? Network : Building2;

  return (
    <div>
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 14}px` }}>
        {node.children.length > 0 ? (
          <button onClick={() => setOpen(!open)} className="shrink-0 p-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
            <ChevronRight size={11} className={cn("transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          onClick={() => onSelect(isSelected ? null : node.id)}
          className={cn(
            "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-sm transition-all",
            isSelected
              ? "bg-primary/15 text-primary border border-primary/30"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
          )}
        >
          <Icon size={12} className="shrink-0 opacity-60" />
          <span className="font-medium text-[12px] break-words flex-1">{node.name}</span>
          <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono shrink-0">{node.teamCount}</span>
        </button>
      </div>
      {open && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <OrgNodeOption key={child.id} node={child} selected={selected} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgUnitPicker({
  orgTree,
  selectedId,
  onSelect,
  selectedName,
}: {
  orgTree: OrgUnitNode[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  selectedName: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
          selectedId
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-card/40 border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
        )}
      >
        <Network size={14} />
        <span className="max-w-[200px] break-words">{selectedName ?? "Все подразделения"}</span>
        {selectedId && (
          <X
            size={13}
            className="shrink-0 opacity-60 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onSelect(null); setOpen(false); }}
          />
        )}
        <ChevronRight size={13} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1.5 left-0 z-50 w-72 bg-card border border-border/60 rounded-2xl shadow-2xl shadow-black/30 p-2 max-h-80 overflow-y-auto custom-scrollbar"
          >
            <button
              onClick={() => { onSelect(null); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm mb-1 transition-all",
                !selectedId ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Network size={13} />
              <span className="font-medium">Все подразделения</span>
            </button>
            <div className="border-t border-border/30 my-1.5" />
            {orgTree.map((root) => (
              <OrgNodeOption
                key={root.id}
                node={root}
                selected={selectedId}
                onSelect={(id) => { onSelect(id); setOpen(false); }}
                depth={0}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState<number | null>(null);

  // Гистограмма
  const [histogramPeriod, setHistogramPeriod] = useState<"week" | "month" | "quarter" | "year">("week");
  const [histogramData, setHistogramData] = useState<SnapshotData[]>([]);
  const [isHistogramLoading, setIsHistogramLoading] = useState(false);

  // Кнопка обновления снимка
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);

  // Загрузка дерева подразделений
  useEffect(() => {
    fetch(`${BASE}/api/org-units`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setOrgTree)
      .catch(() => setOrgTree([]));
  }, []);

  const loadMetrics = useCallback((orgUnitId: number | null) => {
    setIsLoading(true);
    setError(null);
    const url = orgUnitId ? `${BASE}/api/metrics?orgUnitId=${orgUnitId}` : `${BASE}/api/metrics`;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить метрики");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadMetrics(selectedOrgUnitId); }, [selectedOrgUnitId, loadMetrics]);

  // Загрузка данных гистограммы
  useEffect(() => {
    setIsHistogramLoading(true);
    fetch(`${BASE}/api/metrics/history?period=${histogramPeriod}`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : Promise.resolve({ snapshots: [] }))
      .then((result) => setHistogramData(result.snapshots || []))
      .catch(() => setHistogramData([]))
      .finally(() => setIsHistogramLoading(false));
  }, [histogramPeriod]);

  // Создание снимка вручную
  const handleCreateSnapshot = useCallback(() => {
    setIsCreatingSnapshot(true);
    setSnapshotSuccess(null);
    fetch(`${BASE}/api/metrics/snapshot`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (res.status === 409) {
          return res.json().then((data) => { throw new Error(data.error || "Снимок уже создан"); });
        }
        if (!res.ok) throw new Error("Не удалось создать снимок");
        return res.json();
      })
      .then((result) => {
        setSnapshotSuccess(`Снимок создан: ${result.teamCount} команд, ${result.message}`);
        // Перезагружаем гистограмму
        setHistogramData([]);
        setTimeout(() => {
          fetch(`${BASE}/api/metrics/history?period=${histogramPeriod}`, { credentials: "include" })
            .then((res) => res.ok ? res.json() : Promise.resolve({ snapshots: [] }))
            .then((result) => setHistogramData(result.snapshots || []));
        }, 500);
      })
      .catch((e) => setSnapshotSuccess(e.message))
      .finally(() => {
        setIsCreatingSnapshot(false);
        setTimeout(() => setSnapshotSuccess(null), 5000);
      });
  }, [histogramPeriod]);

  // Найти имя выбранного узла для отображения в picker
  function findNodeName(nodes: OrgUnitNode[], id: number): string | null {
    for (const n of nodes) {
      if (n.id === id) return n.name;
      const found = findNodeName(n.children, id);
      if (found) return found;
    }
    return null;
  }
  const selectedOrgName = selectedOrgUnitId ? findNodeName(orgTree, selectedOrgUnitId) : null;

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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <BarChart2 size={20} />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight font-display">Company Metrics</h1>
            </div>
            <p className="text-muted-foreground text-lg">Сводная аналитика зрелости QA по всем командам</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {orgTree.length > 0 && (
              <OrgUnitPicker
                orgTree={orgTree}
                selectedId={selectedOrgUnitId}
                onSelect={setSelectedOrgUnitId}
                selectedName={selectedOrgName}
              />
            )}
            {/* Кнопка обновления снимка */}
            <button
              onClick={handleCreateSnapshot}
              disabled={isCreatingSnapshot}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
                isCreatingSnapshot
                  ? "bg-muted/50 border-border/50 text-muted-foreground cursor-not-allowed"
                  : snapshotSuccess
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                  : "bg-card/40 border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {isCreatingSnapshot ? (
                <Loader2 size={16} className="animate-spin" />
              ) : snapshotSuccess ? (
                <CheckCircle2 size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              <span>{isCreatingSnapshot ? "Создание..." : snapshotSuccess || "Обновить снимок"}</span>
            </button>
          </div>
        </div>
        {/* Сообщение об успешном создании снимка */}
        {snapshotSuccess && !isCreatingSnapshot && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-sm text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2"
          >
            {snapshotSuccess}
          </motion.div>
        )}
      </div>

      {/* Радар зрелости + KPI карточки */}
      <div className="grid grid-cols-2 gap-6 mb-10">
        {/* Левая колонка: Радар зрелости */}
        <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <OrgRadar heatmap={data.heatmap} />
        </div>

        {/* Правая колонка: KPI карточки */}
        <div className="flex flex-col gap-4">
          {/* Верхняя строка: Всего команд + Средний уровень */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Нижняя строка: 4 статуса горизонтально */}
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
              <div key={key} className={cn("border rounded-2xl p-5 shadow-sm", color)}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-70">{label}</p>
                <p className="text-3xl font-black font-display">{data.statusSummary[key] ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Гистограмма динамики зрелости — под радаром */}
      <div className="grid grid-cols-2 gap-6 mb-10">
        {/* Левый: Динамика зрелости команд */}
        <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70">
              Динамика зрелости команд
            </h3>
            {/* Переключатель периодов */}
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

        {/* Правый: Динамика зрелости навыков */}
        <div className="bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70">
              Динамика зрелости навыков
            </h3>
            {/* Переключатель периодов */}
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
          <SkillMaturityChart data={histogramData} isLoading={isHistogramLoading} />
        </div>
      </div>

      {/* Рейтинг команд + слабые/сильные навыки */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
        {/* Рейтинг команд */}
        <div className="xl:col-span-1 bg-card/40 border border-border/50 rounded-3xl p-6 shadow-sm">
          <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground/70 mb-5 flex items-center gap-2">
            <TrendingUp size={14} /> Рейтинг команд
          </h3>
          <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto custom-scrollbar">
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
          <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto custom-scrollbar">
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
          <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto custom-scrollbar">
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
