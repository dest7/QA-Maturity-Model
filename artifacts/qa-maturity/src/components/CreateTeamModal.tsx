import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTeam, getGetTeamsQueryKey } from "@workspace/api-client-react";
import { Loader2, Shield } from "lucide-react";
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
  DialogTrigger,
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

const formSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters"),
  description: z.string().min(10, "Provide a brief description (min 10 chars)"),
  orgUnitId: z.number().int().positive().nullable().optional(),
  criticality: z.enum(["MC", "BC+", "BC", "BO", "OP"]).optional().default("BC"),
  teamType: z.enum(["product", "platform", "service"]).optional().default("service"),
});

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

export function CreateTeamModal({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      orgUnitId: null,
      criticality: "BC",
      teamType: "service",
    },
  });

  const [selectedOrgUnitName, setSelectedOrgUnitName] = useState<string | null>(null);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [isSelectingOrgUnit, setIsSelectingOrgUnit] = useState(false);

  const { mutate: createTeam, isPending } = useCreateTeam({
    mutation: {
      onSuccess: (newTeam) => {
        queryClient.invalidateQueries({ queryKey: getGetTeamsQueryKey() });
        toast({
          title: "Team Created Successfully",
          description: `Navigating to ${newTeam.name} dashboard...`,
        });
        setOpen(false);
        form.reset();
        setLocation(`/team/${newTeam.id}`);
      },
      onError: (err: any) => {
        toast({
          title: "Failed to create team",
          description: err.message || "An unexpected error occurred",
          variant: "destructive",
        });
      },
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createTeam({ data: values });
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => { if (!isSelectingOrgUnit) setOpen(newOpen); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-border/60 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Create New Team</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Initialize a new team to track their QA Maturity progress.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/80">Team Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Engineering Squad Alpha" className="bg-background/50 focus-visible:ring-primary/30" {...field} />
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
                  <FormLabel className="text-foreground/80">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Briefly describe this team's focus..."
                      className="resize-none bg-background/50 focus-visible:ring-primary/30 min-h-[80px]"
                      {...field}
                    />
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
            <DialogFooter className="pt-4 border-t border-border/30 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isPending ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
