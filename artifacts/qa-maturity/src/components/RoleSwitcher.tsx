/**
 * Переключатель роли пользователя (RoleSwitcher).
 *
 * Размещается в подвале боковой панели.
 * Показывает текущую роль и позволяет переключаться между viewer и reviewer.
 *
 * В будущей версии этот компонент будет заменён отображением данных
 * из корпоративного IdP (имя пользователя + роль из токена).
 */

import { useRole } from "@/contexts/RoleContext";
import { Eye, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const { role, toggleRole } = useRole();
  const isReviewer = role === "reviewer";

  return (
    <div className="px-4 pb-4">
      <button
        onClick={toggleRole}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 group",
          isReviewer
            ? "bg-primary/10 border-primary/30 hover:bg-primary/15"
            : "bg-background/30 border-border/40 hover:bg-background/50"
        )}
        title="Нажмите для смены роли"
      >
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          isReviewer ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {isReviewer ? <ShieldCheck className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className={cn("text-xs font-bold leading-none mb-0.5", isReviewer ? "text-primary" : "text-muted-foreground")}>
            {isReviewer ? "Ревьювер" : "Просмотр"}
          </div>
          <div className="text-[10px] text-muted-foreground/50 leading-none">
            {isReviewer ? "Редактирование доступно" : "Только чтение"}
          </div>
        </div>
        <div className={cn(
          "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors",
          isReviewer
            ? "text-primary bg-primary/10 border-primary/20"
            : "text-muted-foreground/40 bg-transparent border-border/20"
        )}>
          {isReviewer ? "ON" : "OFF"}
        </div>
      </button>
    </div>
  );
}
