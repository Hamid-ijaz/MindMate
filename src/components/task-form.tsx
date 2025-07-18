
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
  timesOfDay,
  Task,
  TaskCategory,
  EnergyLevel,
  TaskDuration,
  TimeOfDay,
  energyLevels,
} from "@/lib/types";
import { useState, useTransition, useEffect } from "react";
import { summarizeUrl } from "@/ai/flows/summarize-url-flow";
import { enhanceTask } from "@/ai/flows/enhance-task-flow";
import { Loader2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";
import { format, setHours, setMinutes } from "date-fns";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required."),
  energyLevel: z.enum(energyLevels),
  duration: z.coerce.number().min(1, "Duration is required"),
  timeOfDay: z.enum(timesOfDay),
  reminderAt: z.date().optional(),
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
  const { addTask, updateTask, taskCategories, taskDurations } = useTasks();
  const [isSummarizing, startSummarizeTransition] = useTransition();
  const [isEnhancing, startEnhanceTransition] = useTransition();
  const { toast } = useToast();

  const defaultValues: Partial<TaskFormValues> = task ? {
    ...task,
    duration: Number(task.duration) as TaskDuration,
    reminderAt: task.reminderAt ? new Date(task.reminderAt) : undefined,
  } : {
    title: "",
    description: "",
    category: taskCategories[0] || "",
    energyLevel: "Medium",
    duration: taskDurations[1] || 30,
    timeOfDay: "Afternoon",
    reminderAt: undefined,
    ...propDefaults,
  };

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [task, form, taskCategories, taskDurations]);

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const title = e.target.value;
    if (urlRegex.test(title)) {
      startSummarizeTransition(async () => {
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

  const handleEnhanceClick = () => {
    const title = form.getValues("title");
    if (!title || title.length < 3) {
        toast({
            title: "Title is too short",
            description: "Please enter a title to enhance.",
            variant: "destructive"
        })
        return;
    };
    startEnhanceTransition(async () => {
        try {
            const result = await enhanceTask({ title });
            form.setValue("title", result.rephrasedTitle);
            form.setValue("description", result.description);
            form.setValue("category", result.category);
            form.setValue("energyLevel", result.energyLevel);
            form.setValue("duration", result.duration as TaskDuration);
            form.setValue("timeOfDay", result.timeOfDay);

            toast({
                title: "Task Enhanced!",
                description: "The task details have been filled in by AI.",
            });
        } catch (error) {
            console.error("Failed to enhance task:", error);
            toast({
                title: "AI Error",
                description: "Could not enhance the task. Please try again.",
                variant: "destructive",
            });
        }
    });
  }

  const onSubmit = (data: TaskFormValues) => {
    const taskData = {
        ...data,
        reminderAt: data.reminderAt ? data.reminderAt.getTime() : undefined,
    }

    if (task) {
      updateTask(task.id, taskData as Partial<Task>);
    } else {
      addTask({ ...taskData, parentId } as Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt'>);
    }
    onFinished?.();
    if (!task) {
      form.reset(defaultValues);
    }
  };

  const reminder = form.watch('reminderAt');

  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', value: string) => {
    const date = form.getValues('reminderAt');
    if (!date) return;

    let currentHour = date.getHours();
    let newDate;

    if (type === 'minute') {
        newDate = setMinutes(date, parseInt(value, 10));
    } else {
        const isPM = (type === 'ampm' && value === 'PM') || (type !== 'ampm' && currentHour >= 12);
        let hour12 = type === 'hour' ? parseInt(value, 10) : currentHour % 12;
        if (hour12 === 0) hour12 = 12; // Handle midnight/noon

        let hour24 = hour12;
        if (isPM && hour12 < 12) {
            hour24 += 12;
        }
        if (!isPM && hour12 === 12) { // Handle 12 AM
            hour24 = 0;
        }
        newDate = setHours(date, hour24);
    }
    
    form.setValue('reminderAt', newDate, { shouldDirty: true });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                    <Input placeholder="e.g., Draft the project proposal" {...field} onBlur={handleTitleBlur} />
                </FormControl>
                <Button variant="outline" size="icon" type="button" onClick={handleEnhanceClick} disabled={isEnhancing}>
                    {isEnhancing ? <Loader2 className="animate-spin"/> : <Wand2 />}
                </Button>
              </div>
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
               {!parentId && (
                <FormDescription>
                  Use bullet points (e.g., `- item`) to auto-create sub-tasks.
                </FormDescription>
               )}
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
                <Select onValueChange={field.onChange} value={field.value}>
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
                <Select onValueChange={field.onChange} value={field.value}>
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
                <Select onValueChange={field.onChange} value={String(field.value)}>
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
                <Select onValueChange={field.onChange} value={field.value}>
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
        <FormField
            control={form.control}
            name="reminderAt"
            render={({ field }) => (
                <FormItem className="flex flex-col">
                <FormLabel>Reminder / Due Date (Optional)</FormLabel>
                <Popover>
                    <PopoverTrigger asChild>
                    <FormControl>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                        )}
                        >
                        {field.value ? (
                            format(field.value, "PPP, h:mm a")
                        ) : (
                            <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            const originalDate = field.value || new Date();
                            const newDate = date || new Date();
                            newDate.setHours(originalDate.getHours());
                            newDate.setMinutes(originalDate.getMinutes());
                            field.onChange(newDate);
                        }}
                        disabled={(date) =>
                            date < new Date()
                        }
                        initialFocus
                    />
                    {reminder && (
                        <div className="p-3 border-t border-border grid grid-cols-3 gap-2">
                             <Select onValueChange={(value) => handleTimeChange('hour', value)} value={String(reminder.getHours() % 12 === 0 ? 12 : reminder.getHours() % 12)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent position="popper">
                                {[...Array(12).keys()].map(hour => (
                                    <SelectItem key={hour} value={String(hour + 1)}>{String(hour + 1).padStart(2, '0')}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <Select onValueChange={(value) => handleTimeChange('minute', value)} value={String(reminder.getMinutes())}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent position="popper">
                                {[...Array(60).keys()].map(minute => (
                                    <SelectItem key={minute} value={String(minute)}>{String(minute).padStart(2, '0')}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                             <Select onValueChange={(value) => handleTimeChange('ampm', value)} value={reminder.getHours() >= 12 ? 'PM' : 'AM'}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent position="popper">
                                    <SelectItem value="AM">AM</SelectItem>
                                    <SelectItem value="PM">PM</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    </PopoverContent>
                </Popover>
                <FormMessage />
                </FormItem>
            )}
            />
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
