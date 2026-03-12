import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import {
  useGetTeams,
  useGetDeletedTeams,
  useDeleteTeam,
  useRestoreTeam,
  getGetTeamsQueryKey,
  getGetDeletedTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Target, Layers, Plus, Loader2, BarChart2, Pencil, Trash2, RotateCcw, ChevronDown, ChevronUp, ArchiveX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CreateTeamModal } from "@/components/CreateTeamModal";
import { EditTeamModal } from "@/components/EditTeamModal";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: teams, isLoading } = useGetTeams();
  const { data: deletedTeams } = useGetDeletedTeams();
  const [match, params] = useRoute("/team/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingTeam, setEditingTeam] = useState<{ id: number; name: string; description: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { mutate: deleteTeam, isPending: isDeleting } = useDeleteTeam({
    mutation: {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDeletedTeamsQueryKey() });
        toast({ title: "Команда перемещена в архив", description: "Запись сохранена — её можно восстановить." });
        if (match && params?.id === String(variables.teamId)) {
          setLocation("/");
        }
        setDeleteConfirmId(null);
      },
      onError: () => {
        toast({ title: "Ошибка", description: "Не удалось архивировать команду.", variant: "destructive" });
        setDeleteConfirmId(null);
      },
    },
  });

  const { mutate: restoreTeam, isPending: isRestoring } = useRestoreTeam({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDeletedTeamsQueryKey() });
        toast({ title: "Команда восстановлена", description: `«${data.name}» снова активна.` });
      },
      onError: () => {
        toast({ title: "Ошибка", description: "Не удалось восстановить команду.", variant: "destructive" });
      },
    },
  });

  const teamToDelete = teams?.find((t) => t.id === deleteConfirmId);
  const hasDeletedTeams = (deletedTeams?.length ?? 0) > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-72 flex flex-col bg-sidebar border-r border-sidebar-border z-20 shadow-2xl shadow-black/20">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all shadow-inner">
              <Target size={22} className="group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-sidebar-foreground leading-none tracking-tight">QA Maturity</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1.5 block">Dashboard</span>
            </div>
          </Link>
        </div>

        {/* Teams list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <div className="text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-widest mb-4 px-2 mt-2 flex items-center gap-2">
            <BarChart2 size={12} /> Active Teams
          </div>

          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
            </div>
          ) : teams?.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              Нет активных команд.
            </div>
          ) : (
            teams?.map((team) => {
              const isActive = match && params?.id === String(team.id);
              return (
                <div key={team.id} className="relative group/row">
                  <Link
                    href={`/team/${team.id}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative pr-16",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator"
                        className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <Layers
                      size={18}
                      className={cn(
                        "shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground/80"
                      )}
                    />
                    <span className="font-medium text-sm truncate flex-1">{team.name}</span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-colors shrink-0",
                        isActive
                          ? "bg-background/80 border-border text-foreground shadow-inner"
                          : "bg-background/30 border-border/40 text-muted-foreground group-hover:bg-background/60"
                      )}
                    >
                      L{team.overallLevel}
                    </span>
                  </Link>

                  {/* Edit / Delete action buttons — appear on row hover */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingTeam({ id: team.id, name: team.name, description: team.description });
                      }}
                      title="Редактировать"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-background/70 hover:bg-primary/20 hover:text-primary text-muted-foreground border border-border/40 transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteConfirmId(team.id);
                      }}
                      title="Архивировать"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-background/70 hover:bg-destructive/20 hover:text-destructive text-muted-foreground border border-border/40 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Archived teams section */}
          {hasDeletedTeams && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold text-sidebar-foreground/30 uppercase tracking-widest hover:text-sidebar-foreground/50 transition-colors"
              >
                <ArchiveX size={12} />
                <span>Архив ({deletedTeams?.length})</span>
                <span className="ml-auto">{showArchived ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
              </button>

              <AnimatePresence>
                {showArchived && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mt-1 space-y-1"
                  >
                    {deletedTeams?.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/20 bg-background/20 text-muted-foreground/50"
                      >
                        <ArchiveX size={14} className="shrink-0" />
                        <span className="text-xs truncate flex-1 line-through">{team.name}</span>
                        <button
                          onClick={() => restoreTeam({ teamId: team.id })}
                          disabled={isRestoring}
                          title="Восстановить"
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-background/50 hover:bg-emerald-500/20 hover:text-emerald-400 text-muted-foreground/50 border border-border/30 transition-all"
                        >
                          {isRestoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Add new team */}
        <div className="p-4 border-t border-sidebar-border bg-sidebar/50">
          <CreateTeamModal
            trigger={
              <Button
                variant="outline"
                className="w-full justify-start text-sidebar-foreground/80 hover:text-foreground border-sidebar-border shadow-sm hover:bg-sidebar-accent group h-11 transition-all"
              >
                <Plus className="mr-2 h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />
                Add New Team
              </Button>
            }
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
        <div className="flex-1 overflow-y-auto z-10 p-6 md:p-10 custom-scrollbar">
          {children}
        </div>
      </main>

      {/* Edit modal */}
      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          open={!!editingTeam}
          onOpenChange={(open) => { if (!open) setEditingTeam(null); }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent className="bg-card border-border/60 shadow-2xl shadow-black/50">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle className="font-display text-xl">Архивировать команду?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-muted-foreground leading-relaxed">
              Команда <strong className="text-foreground">«{teamToDelete?.name}»</strong> будет перемещена в архив. 
              Данные не удаляются — команду можно восстановить в любой момент из раздела «Архив» в боковой панели.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="border-border/50">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId !== null && deleteTeam({ teamId: deleteConfirmId })}
              disabled={isDeleting}
              className="bg-destructive/90 hover:bg-destructive text-destructive-foreground border-0"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isDeleting ? "Архивирование..." : "Переместить в архив"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
