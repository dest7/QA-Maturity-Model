/**
 * UserMenu — блок в подвале сайдбара.
 * Показывает имя, роль и кнопку выхода.
 */

import { useAuth } from "@/contexts/AuthContext";
import { LogOut, ShieldCheck, Eye, GitMerge, Users, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  viewer:      { label: "Просмотр",     icon: Eye,        color: "text-slate-400" },
  contributor: { label: "Участник",     icon: GitMerge,   color: "text-blue-400" },
  reviewer:    { label: "Ревьювер",     icon: ShieldCheck, color: "text-primary" },
  manager:     { label: "Менеджер",     icon: BarChart2,  color: "text-violet-400" },
  admin:       { label: "Администратор",icon: Users,      color: "text-amber-400" },
};

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const meta = ROLE_META[user.role] ?? ROLE_META.viewer;
  const Icon = meta.icon;

  return (
    <div className="px-4 pb-4 border-t border-sidebar-border pt-3">
      <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-background/20">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-background/40 border border-border/30", meta.color)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground/80 truncate leading-none mb-0.5">{user.name}</div>
          <div className={cn("text-[10px] font-bold leading-none", meta.color)}>{meta.label}</div>
        </div>
        <button
          onClick={logout}
          title="Выйти"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 border border-border/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
