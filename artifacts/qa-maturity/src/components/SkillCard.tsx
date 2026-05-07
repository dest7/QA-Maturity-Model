/**
 * Карточка навыка (SkillCard).
 *
 * Отображает один QA-навык с его текущим уровнем и позволяет изменять его.
 *
 * Права (AuthContext):
 *   canEditLevels(teamId)    — кнопки +/− изменения уровня, поле заметок
 *   canAddArtifacts(teamId)  — форма добавления / кнопка удаления / редактирования артефактов
 *
 * Кнопка «i»: SkillInfoModal — полная таблица всех 4 уровней.
 * Артефакты загружаются при раскрытии карточки (enabled: expanded).
 */

import {
  useUpdateSkillLevel,
  useGetArtifacts,
  useCreateArtifact,
  useDeleteArtifact,
  getGetTeamQueryKey,
  getGetTeamsQueryKey,
  getGetArtifactsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Loader2, ChevronDown, ChevronUp, Info, Link2, Trash2, PlusCircle, FileText, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect } from "react";
import { SkillInfoModal } from "@/components/SkillInfoModal";
import { useAuth } from "@/contexts/AuthContext";

const LEVEL_COLORS = {
  0: { bar: "bg-slate-500", glow: "shadow-[0_0_8px_rgba(100,116,139,0.5)]", text: "text-slate-400", badge: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
  1: { bar: "bg-amber-500", glow: "shadow-[0_0_8px_rgba(245,158,11,0.5)]", text: "text-amber-500", badge: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  2: { bar: "bg-blue-500", glow: "shadow-[0_0_8px_rgba(59,130,246,0.5)]", text: "text-blue-500", badge: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  3: { bar: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]", text: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
} as const;

const LEVEL_LABELS = ["Initial", "Developing", "Defined", "Optimized"];

export function SkillCard({ teamId, skill }: { teamId: number; skill: any }) {
  const queryClient = useQueryClient();
  const { canEditLevels, canAddArtifacts } = useAuth();
  const canEdit = canEditLevels(teamId);
  const canArtifact = canAddArtifacts(teamId);

  const [expanded, setExpanded] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Artifact add form
  const [newArtifactName, setNewArtifactName] = useState("");
  const [newArtifactLink, setNewArtifactLink] = useState("");
  const [showArtifactForm, setShowArtifactForm] = useState(false);

  // Artifact inline edit
  const [editingArtifactId, setEditingArtifactId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editLink, setEditLink] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Skill notes
  const [notes, setNotes] = useState<string>(skill.notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Хранит значение, которое ещё не сохранено — используется для flush при размонтировании
  const pendingNotesRef = useRef<string | null>(null);
  const teamSkillKeyRef = useRef({ teamId, skillId: skill.skillId });

  // Синхронизируем локальный стейт при переключении команды/навыка
  useEffect(() => {
    const prev = teamSkillKeyRef.current;
    if (prev.teamId !== teamId || prev.skillId !== skill.skillId) {
      // Сбрасываем pending-таймер предыдущего навыка (он уже сохранён через cleanup ниже)
      if (notesTimer.current) clearTimeout(notesTimer.current);
      notesTimer.current = null;
      pendingNotesRef.current = null;
      teamSkillKeyRef.current = { teamId, skillId: skill.skillId };
    }
    setNotes(skill.notes ?? "");
  }, [teamId, skill.skillId, skill.notes]);

  // При размонтировании — немедленно сохраняем несохранённый текст
  useEffect(() => {
    return () => {
      if (notesTimer.current) clearTimeout(notesTimer.current);
      if (pendingNotesRef.current !== null) {
        const value = pendingNotesRef.current;
        const { teamId: tid, skillId: sid } = teamSkillKeyRef.current;
        const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
        fetch(`${BASE}/api/teams/${tid}/skills/${sid}/notes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ notes: value || null }),
        });
      }
    };
  }, []);

  const { mutate: updateLevel, isPending } = useUpdateSkillLevel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
      },
    },
  });

  const { data: artifacts, isLoading: artifactsLoading } = useGetArtifacts(
    teamId,
    skill.skillId,
    { query: { enabled: expanded } }
  );

  const { mutate: createArtifact, isPending: isCreating } = useCreateArtifact({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArtifactsQueryKey(teamId, skill.skillId) });
        setNewArtifactName("");
        setNewArtifactLink("");
        setShowArtifactForm(false);
      },
    },
  });

  const { mutate: deleteArtifact, isPending: isDeleting } = useDeleteArtifact({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArtifactsQueryKey(teamId, skill.skillId) });
      },
    },
  });

  const handleUpdate = (newLevel: number) => {
    if (newLevel < 0 || newLevel > 3 || isPending || !canEdit) return;
    updateLevel({ teamId, skillId: skill.skillId, data: { level: newLevel } });
  };

  const handleAddArtifact = () => {
    if (!newArtifactName.trim()) return;
    createArtifact({
      teamId,
      skillId: skill.skillId,
      data: { name: newArtifactName.trim(), link: newArtifactLink.trim() || null },
    });
  };

  const startEditArtifact = (artifact: any) => {
    setEditingArtifactId(artifact.id);
    setEditName(artifact.name);
    setEditLink(artifact.link ?? "");
  };

  const cancelEditArtifact = () => {
    setEditingArtifactId(null);
    setEditName("");
    setEditLink("");
  };

  const saveEditArtifact = useCallback(async (artifactId: number) => {
    if (!editName.trim()) return;
    setIsSavingEdit(true);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      await fetch(`${BASE}/api/teams/${teamId}/skills/${skill.skillId}/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName.trim(), link: editLink.trim() || null }),
      });
      queryClient.invalidateQueries({ queryKey: getGetArtifactsQueryKey(teamId, skill.skillId) });
      cancelEditArtifact();
    } finally {
      setIsSavingEdit(false);
    }
  }, [editName, editLink, teamId, skill.skillId, queryClient]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    pendingNotesRef.current = value; // помечаем как несохранённое
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      setIsSavingNotes(true);
      try {
        const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
        await fetch(`${BASE}/api/teams/${teamId}/skills/${skill.skillId}/notes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ notes: value || null }),
        });
        pendingNotesRef.current = null; // сохранено успешно
      } finally {
        setIsSavingNotes(false);
      }
    }, 800);
  };

  const colors = LEVEL_COLORS[skill.level as keyof typeof LEVEL_COLORS];
  const hasNextLevel = skill.level < 3;

  return (
    <>
      <Card className="group border-border/40 hover:border-primary/40 bg-card/30 hover:bg-card/60 backdrop-blur-sm transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-primary/5 flex flex-col">
        <CardHeader className="p-5 pb-3">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <CardTitle className="text-base font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors leading-tight">
                  {skill.skillName}
                </CardTitle>
                {/* Кнопка «i» — информация о навыке */}
                <button
                  onClick={() => setInfoOpen(true)}
                  title="Подробное описание уровней"
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-primary/50 hover:text-primary hover:bg-primary/15 border border-primary/25 hover:border-primary/50 transition-all"
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
              <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", colors.badge)}>
                {LEVEL_LABELS[skill.level]}
              </span>
            </div>

            {/* Контрол изменения уровня */}
            {canEdit ? (
              <div className="flex items-center shrink-0 bg-background/90 rounded-lg p-0.5 border border-border/50 shadow-inner">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-destructive/20 hover:text-destructive text-muted-foreground disabled:opacity-30"
                  onClick={() => handleUpdate(skill.level - 1)}
                  disabled={skill.level === 0 || isPending}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <div className="w-6 text-center text-xs font-bold font-mono text-foreground">
                  {isPending ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : skill.level}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-emerald-500/20 hover:text-emerald-500 text-muted-foreground disabled:opacity-30"
                  onClick={() => handleUpdate(skill.level + 1)}
                  disabled={skill.level === 3 || isPending}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black font-mono border", colors.badge)}>
                {skill.level}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 flex flex-col gap-3 flex-1">
          {/* Сегментированный прогресс-бар */}
          <div className="flex gap-1.5 h-2 w-full">
            {[0, 1, 2, 3].map((l) => {
              const c = LEVEL_COLORS[l as keyof typeof LEVEL_COLORS];
              return (
                <div
                  key={l}
                  className={cn("flex-1 rounded-full transition-all duration-500 ease-out", l <= skill.level ? `${c.bar} ${c.glow}` : "bg-secondary opacity-40")}
                />
              );
            })}
          </div>

          {/* Описание текущего уровня */}
          <div className="text-xs text-muted-foreground/80 leading-relaxed bg-background/30 p-2.5 rounded-lg border border-border/30">
            {skill.levelDescriptions?.[skill.level]}
          </div>

          {/* Кнопка раскрытия */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground/60 hover:text-primary hover:bg-primary/5 gap-1.5 border border-border/20 rounded-lg"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Скрыть детали" : "Показать требования и артефакты"}
          </Button>

          {/* Детальная секция */}
          {expanded && (
            <div className="flex flex-col gap-3">
              {/* Таблица требований / артефактов / рекомендаций */}
              <div className="rounded-xl overflow-hidden border border-border/40 text-xs">
                <div className="grid grid-cols-3 bg-background/60">
                  <div className="px-3 py-2 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px] border-b border-border/30 border-r border-border/30">
                    Требования к уровню {skill.level}
                  </div>
                  <div className="px-3 py-2 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px] border-b border-border/30 border-r border-border/30">
                    Артефакты подтверждения
                  </div>
                  <div className="px-3 py-2 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px] border-b border-border/30">
                    {hasNextLevel ? `Рекомендации к уровню ${skill.level + 1}` : "Практики поддержания"}
                  </div>
                </div>
                <div className="grid grid-cols-3 bg-card/20">
                  <div className="px-3 py-3 text-foreground/75 leading-relaxed border-r border-border/30">
                    {skill.levelRequirements?.[skill.level] || "—"}
                  </div>
                  <div className="px-3 py-3 text-foreground/75 leading-relaxed border-r border-border/30">
                    {skill.levelArtifacts?.[skill.level] || "—"}
                  </div>
                  <div className={cn("px-3 py-3 leading-relaxed", hasNextLevel ? "text-primary/80" : "text-emerald-400/80")}>
                    {skill.levelRecommendations?.[skill.level] || "—"}
                  </div>
                </div>
              </div>

              {/* Блок прикреплённых артефактов команды */}
              <div className="rounded-xl border border-border/40 overflow-hidden">

                {/* Заметки команды по навыку */}
                <div className="px-3 py-2.5 bg-background/50 border-b border-border/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                      Описание улучшений подхода команды
                    </span>
                    {isSavingNotes && <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground/40" />}
                  </div>
                  {canArtifact || canEdit ? (
                    <textarea
                      value={notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Контекст, план действий, препятствия..."
                      rows={2}
                      className="w-full text-xs bg-background/40 border border-border/40 rounded-lg px-2.5 py-2 text-foreground/80 placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/40 focus:bg-background/60 transition-colors leading-relaxed"
                    />
                  ) : (
                    notes
                      ? <p className="text-xs text-foreground/70 leading-relaxed">{notes}</p>
                      : <p className="text-xs text-muted-foreground/30 italic">Нет заметок</p>
                  )}
                </div>

                {/* Заголовок артефактов */}
                <div className="flex items-center justify-between px-3 py-2 bg-background/60 border-b border-border/30">
                  <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3 h-3" />
                    Прикреплённые артефакты команды
                  </span>
                  {canArtifact && !showArtifactForm && (
                    <button
                      onClick={() => setShowArtifactForm(true)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Добавить
                    </button>
                  )}
                </div>

                {/* Форма добавления артефакта */}
                {canArtifact && showArtifactForm && (
                  <div className="p-3 bg-background/40 border-b border-border/30 flex flex-col gap-2">
                    <Input
                      placeholder="Название артефакта *"
                      value={newArtifactName}
                      onChange={(e) => setNewArtifactName(e.target.value)}
                      className="h-7 text-xs bg-background/60 border-border/50"
                    />
                    <Input
                      placeholder="Ссылка (необязательно)"
                      value={newArtifactLink}
                      onChange={(e) => setNewArtifactLink(e.target.value)}
                      className="h-7 text-xs bg-background/60 border-border/50"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={handleAddArtifact}
                        disabled={!newArtifactName.trim() || isCreating}
                      >
                        {isCreating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setShowArtifactForm(false); setNewArtifactName(""); setNewArtifactLink(""); }}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}

                {/* Список артефактов */}
                <div className="p-3 flex flex-col gap-2 bg-card/20 min-h-[48px]">
                  {artifactsLoading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
                    </div>
                  ) : !artifacts || artifacts.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/40 text-center py-1 italic">Артефакты не прикреплены</p>
                  ) : (
                    artifacts.map((artifact) => (
                      <div key={artifact.id} className="flex flex-col gap-1 group/art">
                        {editingArtifactId === artifact.id ? (
                          /* Инлайн-форма редактирования */
                          <div className="flex flex-col gap-1.5 p-2 bg-background/50 rounded-lg border border-primary/20">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Название *"
                              className="h-6 text-xs bg-background/60 border-border/40"
                              autoFocus
                            />
                            <Input
                              value={editLink}
                              onChange={(e) => setEditLink(e.target.value)}
                              placeholder="Ссылка (необязательно)"
                              className="h-6 text-xs bg-background/60 border-border/40"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => saveEditArtifact(artifact.id)}
                                disabled={!editName.trim() || isSavingEdit}
                                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                              >
                                {isSavingEdit ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                                Сохранить
                              </button>
                              <span className="text-muted-foreground/30">·</span>
                              <button
                                onClick={cancelEditArtifact}
                                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Обычное отображение артефакта */
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              {artifact.link ? (
                                <a
                                  href={artifact.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors truncate"
                                >
                                  <Link2 className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{artifact.name}</span>
                                </a>
                              ) : (
                                <span className="flex items-center gap-1.5 text-xs text-foreground/70 truncate">
                                  <FileText className="w-3 h-3 shrink-0 text-muted-foreground/50" />
                                  <span className="truncate">{artifact.name}</span>
                                </span>
                              )}
                              {artifact.note && (
                                <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate pl-4">{artifact.note}</p>
                              )}
                            </div>
                            {canArtifact && (
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/art:opacity-100 transition-all">
                                <button
                                  onClick={() => startEditArtifact(artifact)}
                                  className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all"
                                  title="Редактировать артефакт"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deleteArtifact({ teamId, skillId: skill.skillId, artifactId: artifact.id })}
                                  disabled={isDeleting}
                                  className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
                                  title="Удалить артефакт"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SkillInfoModal open={infoOpen} onOpenChange={setInfoOpen} skill={skill} />
    </>
  );
}
