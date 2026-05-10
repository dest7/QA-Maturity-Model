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
import { ChevronRight, Layers, Building2, Network } from "lucide-react";
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
          <Layers size={15} className={cn("transition-colors", isActive ? "text-primary" : "text-muted-foreground/60")} />
          <div className={cn("absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-sidebar", statusDot)} />
        </div>
        <span className="font-medium text-[13px] truncate flex-1">{team.name}</span>
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
  defaultOpen?: boolean;
}

function OrgNode({ node, teams, isAdmin, depth = 0, onEdit, onDelete, defaultOpen = false }: OrgNodeProps) {
  const [open, setOpen] = useState(defaultOpen || depth === 0);
  const nodeTeams = teams.filter((t) => t.orgUnitId === node.id);
  const hasContent = node.children.length > 0 || nodeTeams.length > 0;
  const Icon = depth === 0 ? Network : Building2;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-1.5 py-1.5 rounded-lg transition-colors text-left",
          "hover:bg-sidebar-accent/30",
          depth === 0 ? "px-2 mb-0.5" : "px-2"
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <ChevronRight size={11} className={cn("shrink-0 text-muted-foreground/40 transition-transform duration-200", open && "rotate-90")} />
        <Icon size={12} className={cn("shrink-0", depth === 0 ? "text-primary/60" : "text-muted-foreground/50")} />
        <span className={cn(
          "font-semibold truncate flex-1",
          depth === 0 ? "text-[11px] text-sidebar-foreground/70 uppercase tracking-wider" : "text-[11px] text-sidebar-foreground/55"
        )}>
          {node.name}
        </span>
        {hasContent && (
          <span className="text-[9px] text-muted-foreground/30 shrink-0 font-mono">{nodeTeams.length}</span>
        )}
      </button>

      {open && (
        <div>
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} teams={teams} isAdmin={isAdmin} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} defaultOpen={depth < 1} />
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
}

export function OrgTree({ teams, isAdmin, onEditTeam, onDeleteTeam }: OrgTreeProps) {
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
      <>
        {teams.map((team) => (
          <TeamRow key={team.id} team={team} isAdmin={isAdmin} depth={0} onEdit={onEditTeam} onDelete={onDeleteTeam} />
        ))}
      </>
    );
  }

  return (
    <div className="space-y-0.5">
      {orgTree.map((root) => (
        <OrgNode key={root.id} node={root} teams={teams} isAdmin={isAdmin} depth={0} onEdit={onEditTeam} onDelete={onDeleteTeam} defaultOpen />
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
