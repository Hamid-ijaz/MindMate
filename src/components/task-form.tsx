
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTasks } from "@/contexts/task-context";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  taskCategories,
  energyLevels,
  taskDurations,
  timesOfDay,
  Task,
  TaskCategory,
  EnergyLevel,
  TaskDuration,
  TimeOfDay,
} from "@/lib/types";
import { useState, useTransition } from "react";
import { summarizeUrl } from "@/ai/flows/summarize-url-flow";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().optional(),
  category: z.enum(taskCategories),
  energyLevel: z.enum(energyLevels),
  duration: z.coerce.number().refine((val) => taskDurations.includes(val as TaskDuration)),
  timeOfDay: z.enum(timesOfDay),
});

type TaskFormValues = z.infer<typeof formSchema>;

interface TaskFormProps {
  task?: Task;
  onFinished?: () => void;
  parentId?: string;
  defaultValues?: Partial<TaskFormValues>;
}

const urlRegex = new RegExp(
  /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[-a-z\d_]*)?$/i
);


export function TaskForm({ task, onFinished, parentId, defaultValues: propDefaults }: TaskFormProps) {
  const { addTask, updateTask } = useTasks();
  const [isSummarizing, startTransition] = useTransition();
  const { toast } = useToast();

  const defaultValues: Partial<TaskFormValues> = task ? {
    ...task,
    duration: Number(task.duration) as TaskDuration,
  } : {
    title: "",
    description: "",
    category: "Work",
    energyLevel: "Medium",
    duration: 30,
    timeOfDay: "Afternoon",
    ...propDefaults,
  };

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const title = e.target.value;
    if (urlRegex.test(title)) {
      startTransition(async () => {
        try {
          const result = await summarizeUrl({ url: title });
          if (result.summary) {
            form.setValue("description", result.summary);
             toast({
              title: "Description Updated!",
              description: "AI has summarized the URL for you.",
            });
          }
        } catch (error) {
          console.error("Failed to summarize URL:", error);
          toast({
            title: "AI Error",
            description: "Could not summarize the URL. Please try again.",
            variant: "destructive",
          });
        }
      });
    }
  };

  const onSubmit = (data: TaskFormValues) => {
    if (task) {
      updateTask(task.id, data);
    } else {
      addTask({ ...data, parentId });
    }
    onFinished?.();
    if (!task) {
      form.reset();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Draft the project proposal" {...field} onBlur={handleTitleBlur} />
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
              <FormLabel>Description (Optional)</FormLabel>
               <div className="relative">
                <FormControl>
                  <Textarea placeholder="Add any details or notes here" {...field} />
                </FormControl>
                {isSummarizing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}
               </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {taskCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="energyLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Energy Level</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="How much energy does this require?" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {energyLevels.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Duration</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a duration" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {taskDurations.map((dur) => (
                      <SelectItem key={dur} value={String(dur)}>{dur} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timeOfDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Time of Day</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="When is it best to do this?" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {timesOfDay.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2">
            {onFinished && (
                <Button variant="ghost" type="button" onClick={onFinished}>Cancel</Button>
            )}
            <Button type="submit">{task ? "Save Changes" : parentId ? "Add Sub-task" : "Add Task"}</Button>
        </div>
      </form>
    </Form>
  );
}
