/**
 * OrgTree — рекурсивный компонент дерева организационных единиц для сайдбара.
 *
 * Загружает /api/org-units (дерево) + список teams (уже в кэше от useGetTeams).
 * Группирует команды по orgUnitId в соответствующих узлах дерева.
 * Команды без orgUnitId отображаются в секции «Без структуры».
 */

import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { cn } from "@/lib/utils";
import { ChevronRight, Layers, Building2, Network, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STATUS_DOT: Record<string, string> = {
  planned:     "bg-slate-400",
  in_progress: "bg-blue-400",
  completed:   "bg-emerald-400",
  on_hold:     "bg-amber-400",
};

export interface OrgUnitNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children: OrgUnitNode[];
  teamCount: number;
}

interface Team {
  id: number;
  name: string;
  overallLevel: number;
  assessmentStatus: string | null;
  orgUnitId?: number | null;
}

interface TeamRowProps {
  team: Team;
  isAdmin: boolean;
  depth: number;
  onEdit?: (t: Team) => void;
  onDelete?: (id: number) => void;
}

function TeamRow({ team, isAdmin, depth, onEdit, onDelete }: TeamRowProps) {
  const [match, params] = useRoute("/team/:id");
  const isActive = match && params?.id === String(team.id);
  const statusDot = STATUS_DOT[team.assessmentStatus ?? "planned"] ?? "bg-slate-400";

  // Размер иконки команды: 14px для depth=1, 12px для depth=2+
  const teamIconSize = depth <= 1 ? 14 : 12;

  return (
    <div className="relative group/row">
      <Link
        href={`/team/${team.id}`}
        className={cn(
          "flex items-center gap-2.5 py-2 rounded-xl transition-all duration-200 group relative",
          isAdmin ? "pr-16" : "pr-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {isActive && (
          <motion.div
            layoutId="active-indicator"
            className="absolute left-0 w-1 h-5 bg-primary rounded-r-full"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <div className="relative shrink-0">
          <Layers size={teamIconSize} className={cn("transition-colors", isActive ? "text-primary" : "text-muted-foreground/60")} />
          <div className={cn("absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-sidebar", statusDot)} />
        </div>
        <span className="font-medium text-[13px] break-words flex-1">{team.name}</span>
        <span className={cn(
          "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border shrink-0",
          isActive ? "bg-background/80 border-border text-foreground" : "bg-background/30 border-border/40 text-muted-foreground"
        )}>
          L{team.overallLevel}
        </span>
      </Link>
      {isAdmin && onEdit && onDelete && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button onClick={(e) => { e.preventDefault(); onEdit(team); }} className="w-6 h-6 flex items-center justify-center rounded bg-background/70 hover:bg-primary/20 hover:text-primary text-muted-foreground/60 text-[10px] border border-border/30 transition-all">✎</button>
          <button onClick={(e) => { e.preventDefault(); onDelete(team.id); }} className="w-6 h-6 flex items-center justify-center rounded bg-background/70 hover:bg-destructive/20 hover:text-destructive text-muted-foreground/60 text-[10px] border border-border/30 transition-all">✕</button>
        </div>
      )}
    </div>
  );
}

interface OrgNodeProps {
  node: OrgUnitNode;
  teams: Team[];
  isAdmin: boolean;
  depth?: number;
  onEdit?: (t: Team) => void;
  onDelete?: (id: number) => void;
  onAddOrgUnit?: (parentId?: number) => void;
  onEditOrgUnit?: (unit: { id: number; name: string; description: string | null; parentId: number | null }) => void;
  onDeleteOrgUnit?: (id: number) => void;
  defaultOpen?: boolean;
}

function OrgNode({ node, teams, isAdmin, depth = 0, onEdit, onDelete, onAddOrgUnit, onEditOrgUnit, onDeleteOrgUnit, defaultOpen = false }: OrgNodeProps) {
  const [open, setOpen] = useState(defaultOpen);
  const nodeTeams = teams.filter((t) => t.orgUnitId === node.id);
  const hasContent = node.children.length > 0 || nodeTeams.length > 0;
  const Icon = depth === 0 ? Network : Building2;

  // Размеры иконок: Управление 16px, Отдел 15px, Команда+ 12px
  const iconSize = depth === 0 ? 16 : depth === 1 ? 15 : 12;
  const chevronSize = depth === 0 ? 13 : depth === 1 ? 12 : 9;

  // Показываем кнопки управления только для Управлений (depth=0) и Отделов (depth=1)
  const showControls = isAdmin && depth < 2;

  return (
    <div>
      {/* Строка узла с фиксированной высотой для правильного позиционирования кнопок */}
      <div className={cn(
        "relative flex items-center gap-1 rounded-lg transition-colors group/node min-h-[32px]",
        showControls ? "pr-20" : ""
      )}>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex-1 flex items-center gap-1.5 py-1.5 transition-colors text-left rounded-lg",
            "hover:bg-sidebar-accent/30",
            depth === 0 ? "px-2" : "px-2"
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <ChevronRight size={chevronSize} className={cn("shrink-0 text-muted-foreground/40 transition-transform duration-200", open && "rotate-90")} />
          <Icon size={iconSize} className={cn("shrink-0", depth === 0 ? "text-primary/60" : "text-muted-foreground/50")} />
          <span className={cn(
            "font-semibold flex-1 break-words",
            depth === 0 ? "text-[11px] text-sidebar-foreground/70 uppercase tracking-wider" : "text-[11px] text-sidebar-foreground/55"
          )}>
            {node.name}
          </span>
          {hasContent && (
            <span className="text-[9px] text-muted-foreground/30 shrink-0 font-mono">{nodeTeams.length}</span>
          )}
        </button>

        {/* Кнопки управления узлом (только admin, только для Управлений и Отделов) */}
        {showControls && (
          <div className="absolute right-0 top-0 h-full flex items-center pr-1">
            <div className="flex items-center gap-0.5 opacity-0 group-hover/node:opacity-100 transition-opacity shrink-0 bg-sidebar border border-border/30 rounded-md shadow-sm px-0.5 py-0.5">
              {onAddOrgUnit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAddOrgUnit(node.id); }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-primary/20 hover:text-primary text-muted-foreground/60 text-[10px] transition-all"
                  title="Добавить дочернее подразделение"
                >
                  <FolderPlus size={12} />
                </button>
              )}
              {onEditOrgUnit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEditOrgUnit({ id: node.id, name: node.name, description: node.description, parentId: node.parentId }); }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-primary/20 hover:text-primary text-muted-foreground/60 text-[10px] transition-all"
                  title="Редактировать подразделение"
                >
                  <Pencil size={12} />
                </button>
              )}
              {onDeleteOrgUnit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteOrgUnit(node.id); }}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground/60 text-[10px] transition-all"
                  title="Удалить подразделение"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {open && (
        <div>
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} teams={teams} isAdmin={isAdmin} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onAddOrgUnit={onAddOrgUnit} onEditOrgUnit={onEditOrgUnit} onDeleteOrgUnit={onDeleteOrgUnit} />
          ))}
          {nodeTeams.map((team) => (
            <TeamRow key={team.id} team={team} isAdmin={isAdmin} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrgTreeProps {
  teams: Team[];
  isAdmin: boolean;
  onEditTeam?: (t: Team) => void;
  onDeleteTeam?: (id: number) => void;
  onAddOrgUnit?: (parentId?: number) => void;
  onEditOrgUnit?: (unit: { id: number; name: string; description: string | null; parentId: number | null }) => void;
  onDeleteOrgUnit?: (id: number) => void;
}

export function OrgTree({ teams, isAdmin, onEditTeam, onDeleteTeam, onAddOrgUnit, onEditOrgUnit, onDeleteOrgUnit }: OrgTreeProps) {
  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);

  useEffect(() => {
    fetch(`${BASE}/api/org-units`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setOrgTree)
      .catch(() => setOrgTree([]));
  }, []);

  const assignedTeamIds = new Set(teams.filter((t) => t.orgUnitId).map((t) => t.id));
  const unassignedTeams = teams.filter((t) => !assignedTeamIds.has(t.id) || !t.orgUnitId);

  if (orgTree.length === 0) {
    // Фолбэк: плоский список если нет оргструктуры
    return (
      <div className="relative">
        {teams.map((team) => (
          <TeamRow key={team.id} team={team} isAdmin={isAdmin} depth={0} onEdit={onEditTeam} onDelete={onDeleteTeam} />
        ))}
        {isAdmin && onAddOrgUnit && (
          <button
            onClick={() => onAddOrgUnit()}
            className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground transition-colors"
          >
            <FolderPlus size={14} />
            <span>Добавить подразделение</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {orgTree.map((root) => (
        <OrgNode key={root.id} node={root} teams={teams} isAdmin={isAdmin} depth={0} onEdit={onEditTeam} onDelete={onDeleteTeam} onAddOrgUnit={onAddOrgUnit} onEditOrgUnit={onEditOrgUnit} onDeleteOrgUnit={onDeleteOrgUnit} defaultOpen />
      ))}
      {unassignedTeams.length > 0 && (
        <div className="mt-3">
          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">Без структуры</div>
          {unassignedTeams.map((team) => (
            <TeamRow key={team.id} team={team} isAdmin={isAdmin} depth={0} onEdit={onEditTeam} onDelete={onDeleteTeam} />
          ))}
        </div>
      )}
    </div>
  );
}
