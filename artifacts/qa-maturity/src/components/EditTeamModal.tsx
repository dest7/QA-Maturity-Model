/**
 * Модальное окно редактирования команды.
 *
 * Позволяет изменить название и описание команды.
 * Использует react-hook-form + Zod для управления формой и валидации:
 *   - name: минимум 3 символа
 *   - description: минимум 5 символов
 *
 * Синхронизация данных формы с пропсами:
 *   useEffect сбрасывает значения полей при каждом открытии модала (open = true).
 *   Это нужно, если пользователь открыл модал одной команды, закрыл, потом открыл другой —
 *   без reset() форма показывала бы данные предыдущей команды.
 *
 * После успешного сохранения:
 *   - Инвалидируются кэши getGetTeamsQueryKey() и getGetTeamQueryKey(team.id)
 *   - Показывается toast с подтверждением (с названием подразделения при перемещении)
 *   - Модал закрывается через onOpenChange(false)
 */

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateTeam, getGetTeamsQueryKey, getGetTeamQueryKey } from "@workspace/api-client-react";
import { Loader2, Pencil, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OrgUnitPicker } from "@/components/OrgUnitPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrgUnitNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children: OrgUnitNode[];
  teamCount: number;
}

const CRITICALITY_INFO: Record<string, { label: string; description: string; color: string }> = {
  "MC": { label: "MC", description: "Mission Critical — Критичные для бизнеса", color: "text-red-400" },
  "BC+": { label: "BC+", description: "Business Critical Plus — Высокая критичность", color: "text-amber-400" },
  "BC": { label: "BC", description: "Business Critical — Критичные для бизнеса", color: "text-blue-400" },
  "BO": { label: "BO", description: "Business Operational — Операционные", color: "text-emerald-400" },
  "OP": { label: "OP", description: "Operational Support — Поддерживающие", color: "text-slate-400" },
};

const TEAM_TYPE_INFO: Record<string, { label: string; description: string; color: string }> = {
  "product": { label: "Продуктовая", description: "Разработка продуктовых фич", color: "text-purple-400" },
  "platform": { label: "Платформенная", description: "Инфраструктура и платформы", color: "text-cyan-400" },
  "service": { label: "Сервисная", description: "QA, Security, DevEx", color: "text-slate-400" },
};

// Zod-схема валидации формы
const formSchema = z.object({
  name: z.string().min(3, "Название должно содержать минимум 3 символа"),
  description: z.string().min(5, "Описание должно содержать минимум 5 символов"),
  orgUnitId: z.number().int().positive().nullable().optional(),
  criticality: z.enum(["MC", "BC+", "BC", "BO", "OP"]).optional().default("BC"),
  teamType: z.enum(["product", "platform", "service"]).optional().default("service"),
});

interface EditTeamModalProps {
  team: { id: number; name: string; description: string; orgUnitId?: number | null; criticality?: string; teamType?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTeamModal({ team, open, onOpenChange }: EditTeamModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);
  const [selectedOrgUnitName, setSelectedOrgUnitName] = useState<string | null>(null);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [isSelectingOrgUnit, setIsSelectingOrgUnit] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: team.name,
      description: team.description,
      orgUnitId: team.orgUnitId ?? null,
      criticality: (team.criticality as "MC" | "BC+" | "BC" | "BO" | "OP") ?? "BC",
      teamType: (team.teamType as "product" | "platform" | "service") ?? "service",
    },
  });

  // Загружаем дерево подразделений для отображения названий в toast
  useEffect(() => {
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${BASE}/api/org-units`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOrgTree(data))
      .catch(() => setOrgTree([]));
  }, []);

  // Сбрасываем форму и selectedOrgUnitName при каждом открытии
  useEffect(() => {
    if (open) {
      form.reset({
        name: team.name,
        description: team.description,
        orgUnitId: team.orgUnitId ?? null,
        criticality: (team.criticality as "MC" | "BC+" | "BC" | "BO" | "OP") ?? "BC",
        teamType: (team.teamType as "product" | "platform" | "service") ?? "service",
      });
      // Находим название подразделения из дерева
      if (team.orgUnitId) {
        function findNodeName(nodes: OrgUnitNode[], id: number): string | null {
          for (const node of nodes) {
            if (node.id === id) return node.name;
            const found = findNodeName(node.children, id);
            if (found) return found;
          }
          return null;
        }
        setSelectedOrgUnitName(findNodeName(orgTree, team.orgUnitId));
      } else {
        setSelectedOrgUnitName(null);
      }
    }
  }, [open, team.name, team.description, team.orgUnitId, team.criticality, team.teamType, orgTree]);

  const { mutate: updateTeam, isPending } = useUpdateTeam({
    mutation: {
      onSuccess: (updatedTeam) => {
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(team.id) });

        // Функция для поиска названия подразделения по ID в дереве
        function findNodeName(nodes: OrgUnitNode[], id: number): string | null {
          for (const node of nodes) {
            if (node.id === id) return node.name;
            const found = findNodeName(node.children, id);
            if (found) return found;
          }
          return null;
        }

        // Проверяем, изменилось ли подразделение
        const orgUnitChanged = team.orgUnitId !== updatedTeam.orgUnitId;
        const orgUnitName = updatedTeam.orgUnitId 
          ? findNodeName(orgTree, updatedTeam.orgUnitId) || `подразделение #${updatedTeam.orgUnitId}`
          : 'без подразделения';

        toast({
          title: "Команда обновлена",
          description: orgUnitChanged
            ? `«${form.getValues("name")}» успешно изменена и перемещена ${orgUnitName}.`
            : `«${form.getValues("name")}» успешно изменена.`
        });
        onOpenChange(false);
      },
      onError: () => {
        toast({ title: "Ошибка", description: "Не удалось обновить команду.", variant: "destructive" });
      },
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateTeam({ teamId: team.id, data: values });
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => { if (!isSelectingOrgUnit) onOpenChange(newOpen); }}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border/60 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="font-display text-xl">Редактировать команду</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Измените название или описание команды.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Название команды</FormLabel>
                  <FormControl>
                    <Input className="bg-background/50 focus-visible:ring-primary/30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Описание</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none bg-background/50 focus-visible:ring-primary/30 min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orgUnitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Подразделение</FormLabel>
                  <FormControl>
                    <OrgUnitPicker
                      selectedId={field.value ?? null}
                      selectedName={selectedOrgUnitName}
                      open={orgPickerOpen}
                      onOpenChange={(isOpen) => {
                        setOrgPickerOpen(isOpen);
                        setIsSelectingOrgUnit(isOpen);
                      }}
                      onSelect={(orgUnitId, name) => {
                        field.onChange(orgUnitId);
                        setSelectedOrgUnitName(name);
                        setOrgPickerOpen(false);
                        setIsSelectingOrgUnit(false);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="criticality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80 flex items-center gap-2">
                    <Shield size={14} />
                    Уровень критичности
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background/50 focus:ring-primary/30">
                        <SelectValue placeholder="Выберите критичность" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {Object.entries(CRITICALITY_INFO).map(([value, info]) => (
                          <SelectItem key={value} value={value}>
                            <span className={info.color}>{info.label}</span> — {info.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="teamType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80 flex items-center gap-2">
                    <Shield size={14} />
                    Тип команды
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background/50 focus:ring-primary/30">
                        <SelectValue placeholder="Выберите тип команды" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {Object.entries(TEAM_TYPE_INFO).map(([value, info]) => (
                          <SelectItem key={value} value={value}>
                            <span className={info.color}>{info.label}</span> — {info.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2 border-t border-border/30 mt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Отмена
              </Button>
              <Button type="submit" disabled={isPending} className="shadow-lg shadow-primary/20">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
