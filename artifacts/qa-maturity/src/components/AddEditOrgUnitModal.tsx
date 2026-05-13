/**
 * Модальное окно добавления/редактирования подразделения.
 *
 * Позволяет создать новое подразделение или отредактировать существующее.
 * Поддерживает выбор родительского подразделения для создания иерархии.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, FolderPlus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

// Zod-схема валидации формы
const formSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().nullable().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

interface OrgUnitNode {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children: OrgUnitNode[];
}

interface AddEditOrgUnitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  orgTree?: OrgUnitNode[];
  // Для редактирования
  editUnit?: {
    id: number;
    name: string;
    description: string | null;
    parentId: number | null;
  } | null;
  // Для создания — можно сразу выбрать родителя
  defaultParentId?: number | null;
  onCreate: (data: z.infer<typeof formSchema>) => void;
  onUpdate: (id: number, data: z.infer<typeof formSchema>) => void;
  isPending: boolean;
}

export function AddEditOrgUnitModal({
  open,
  onOpenChange,
  onSuccess,
  orgTree = [],
  editUnit = null,
  defaultParentId = null,
  onCreate,
  onUpdate,
  isPending,
}: AddEditOrgUnitModalProps) {
  const { toast } = useToast();

  const isEdit = !!editUnit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editUnit?.name ?? "",
      description: editUnit?.description ?? "",
      parentId: editUnit?.parentId ?? defaultParentId ?? null,
    },
  });

  // Сбрасываем форму при открытии
  useEffect(() => {
    if (open) {
      form.reset({
        name: editUnit?.name ?? "",
        description: editUnit?.description ?? "",
        parentId: editUnit?.parentId ?? defaultParentId ?? null,
      });
    }
  }, [open, editUnit, defaultParentId, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (isEdit && editUnit) {
      onUpdate(editUnit.id, values);
    } else {
      onCreate(values);
    }
  }

  // Рекурсивный компонент для отображения дерева в select
  function renderTreeOptions(nodes: OrgUnitNode[], depth = 0): React.ReactNode {
    return nodes.flatMap((node) => [
      <option key={node.id} value={node.id} disabled={editUnit?.id === node.id}>
        {"\u00A0".repeat(depth * 2)}{node.name}
      </option>,
      ...renderTreeOptions(node.children, depth + 1),
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border/60 shadow-2xl shadow-black/50">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              {isEdit ? (
                <Pencil className="w-4 h-4 text-primary" />
              ) : (
                <FolderPlus className="w-4 h-4 text-primary" />
              )}
            </div>
            <DialogTitle className="font-display text-xl">
              {isEdit ? "Редактировать подразделение" : "Новое подразделение"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            {isEdit
              ? "Измените название или описание подразделения."
              : "Добавьте новое подразделение в организационную структуру."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Название</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-background/50 focus-visible:ring-primary/30"
                      placeholder="Например: Управление разработки"
                      {...field}
                    />
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
                  <FormLabel className="text-foreground/80">Описание (опционально)</FormLabel>
                  <FormControl>
                    <Textarea
                      className="resize-none bg-background/50 focus-visible:ring-primary/30 min-h-[80px]"
                      placeholder="Краткое описание подразделения"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && (
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Родительское подразделение</FormLabel>
                    <FormControl>
                      <select
                        className={cn(
                          "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        )}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          field.onChange(val);
                        }}
                      >
                        <option value="">Без подразделения (корневой узел)</option>
                        {renderTreeOptions(orgTree)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isEdit && (
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Родительское подразделение</FormLabel>
                    <FormControl>
                      <select
                        className={cn(
                          "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        )}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          field.onChange(val);
                        }}
                        disabled={orgTree.length === 0}
                      >
                        <option value="">Без подразделения (корневой узел)</option>
                        {renderTreeOptions(orgTree)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isPending} className="shadow-lg shadow-primary/20">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isPending ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
