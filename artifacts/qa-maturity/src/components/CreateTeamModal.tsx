import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateTeam, getGetTeamsQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
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

const formSchema = z.object({
  name: z.string().min(3, "Team name must be at least 3 characters"),
  description: z.string().min(10, "Provide a brief description (min 10 chars)"),
  orgUnitId: z.number().int().positive().nullable().optional(),
});

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
    },
  });

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border/60 shadow-2xl shadow-black/50">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Create New Team</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Initialize a new team to track their QA Maturity progress.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
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
                      className="resize-none bg-background/50 focus-visible:ring-primary/30 min-h-[100px]"
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
                      value={field.value ?? null}
                      onChange={(orgUnitId) => field.onChange(orgUnitId)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
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
