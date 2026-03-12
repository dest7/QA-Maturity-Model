import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateTeam, getGetTeamsQueryKey, getGetTeamQueryKey } from "@workspace/api-client-react";
import { Loader2, Pencil } from "lucide-react";
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

const formSchema = z.object({
  name: z.string().min(3, "Название должно содержать минимум 3 символа"),
  description: z.string().min(5, "Описание должно содержать минимум 5 символов"),
});

interface EditTeamModalProps {
  team: { id: number; name: string; description: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTeamModal({ team, open, onOpenChange }: EditTeamModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: team.name, description: team.description },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: team.name, description: team.description });
    }
  }, [open, team.name, team.description, form]);

  const { mutate: updateTeam, isPending } = useUpdateTeam({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(team.id) });
        toast({ title: "Команда обновлена", description: `«${form.getValues("name")}» успешно изменена.` });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border/60 shadow-2xl shadow-black/50">
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
                    <Textarea className="resize-none bg-background/50 focus-visible:ring-primary/30 min-h-[90px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2">
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
