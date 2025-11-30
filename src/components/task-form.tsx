
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
import { Task, Priority, TaskDuration, priorities, recurrenceFrequencies, RecurrenceFrequency } from "@/lib/types";
import { getDefaultPriority } from "@/lib/utils";
// ...existing code...
import { useState, useTransition, useEffect } from "react";
import { summarizeUrl } from "@/ai/flows/summarize-url-flow";
import { enhanceTask } from "@/ai/flows/enhance-task-flow";
import { Loader2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGoogleTasksSync } from "@/hooks/use-google-tasks-sync";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";
import { format, setHours, setMinutes, startOfDay } from "date-fns";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required."),
  priority: z.enum(priorities),
  duration: z.coerce.number().min(1, "Duration is required"),
  reminderAt: z.date().optional(),
  onlyNotifyAtReminder: z.boolean().optional().default(false),
  isArchived: z.boolean().optional().default(false),
  location: z.string().optional(),
  isAllDay: z.boolean().optional().default(true), // Always true in background
  recurrence: z.object({
      frequency: z.enum(['none', 'daily', 'weekly', 'monthly']),
      endDate: z.date().optional(),
  }).optional(),
}).refine(data => {
    // If recurrence is set and not 'none', endDate must be after reminderAt if both exist.
    if (data.recurrence && data.recurrence.frequency !== 'none' && data.reminderAt && data.recurrence.endDate) {
        return data.recurrence.endDate >= data.reminderAt;
    }
    return true;
}, {
    message: "Recurrence end date must be on or after the reminder date.",
    path: ["recurrence", "endDate"],
});


type TaskFormValues = z.infer<typeof formSchema>;

interface TaskFormProps {
  task?: Task;
  onFinished?: () => void;
  parentId?: string;
  defaultValues?: Partial<TaskFormValues>;
  customSaveHandler?: (taskData: Partial<Task>) => Promise<void>;
  customAddHandler?: (taskData: Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt' | 'notifiedAt'>) => Promise<void>;
}

const urlRegex = new RegExp(
  /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[-a-z\d_]*)?$/i
);


export function TaskForm({ task, onFinished, parentId, defaultValues: propDefaults, customSaveHandler, customAddHandler }: TaskFormProps) {
  const { addTask, updateTask, taskCategories, taskDurations, preFilledData, setPreFilledData } = useTasks();
  const [isSummarizing, startSummarizeTransition] = useTransition();
  const [isEnhancing, startEnhanceTransition] = useTransition();
  const { toast } = useToast();

  // Add Google Tasks sync hooks
  const { syncTaskChange } = useGoogleTasksSync({
    onSyncError: (error) => {
      console.error('Google Tasks sync error:', error);
      toast({
        title: "Sync Warning",
        description: "Task saved locally but couldn't sync to Google Tasks.",
        variant: "destructive"
      });
    },
    onSyncComplete: (result) => {
      console.log('Google Tasks sync complete:', result);
    }
  });

  const defaultValues: Partial<TaskFormValues> = task ? {
    ...task,
    duration: Number(task.duration) as TaskDuration,
    location: task.location || "",
    isAllDay: true, // Always true
    reminderAt: task.reminderAt ? (() => {
      try {
        const date = new Date(task.reminderAt);
        if (isNaN(date.getTime())) {
          return undefined;
        }
        return date;
      } catch (error) {
        console.error('Date parsing error:', error);
        return undefined;
      }
    })() : undefined,
    recurrence: task.recurrence ? {
        ...task.recurrence,
        endDate: task.recurrence.endDate ? (() => {
          try {
            const date = new Date(task.recurrence.endDate);
            if (isNaN(date.getTime())) {
              return undefined;
            }
            return date;
          } catch (error) {
            console.error('Date parsing error:', error);
            return undefined;
          }
        })() : undefined,
    } : { frequency: 'none' },
  } : {
    title: preFilledData?.title || "",
    description: preFilledData?.description || "",
    category: preFilledData?.category || taskCategories[0] || "",
    priority: preFilledData?.priority || (typeof getDefaultPriority === 'function' ? getDefaultPriority() : "Medium"),
    duration: preFilledData?.duration || taskDurations[1] || 30,
    reminderAt: undefined,
    location: "",
    isAllDay: true, // Always true
    onlyNotifyAtReminder: false,
    isArchived: false,
    recurrence: { frequency: 'none', endDate: undefined },
    ...propDefaults,
  };

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [task, form, taskCategories, taskDurations]);

  // Effect to reset form when preFilledData changes
  useEffect(() => {
    if (preFilledData && !task) {
      const newDefaultValues: Partial<TaskFormValues> = {
        title: preFilledData?.title || "",
        description: preFilledData?.description || "",
        category: preFilledData?.category || taskCategories[0] || "",
        priority: preFilledData?.priority || (typeof getDefaultPriority === 'function' ? getDefaultPriority() : "Medium"),
        duration: preFilledData?.duration || taskDurations[1] || 30,
        reminderAt: undefined,
        location: "",
        isAllDay: true,
        recurrence: { frequency: 'none', endDate: undefined },
        ...propDefaults,
      };

      form.reset(newDefaultValues);
      
      // Clear preFilledData after using it to avoid reusing stale data
      setTimeout(() => {
        setPreFilledData(null);
      }, 100);
    }
  }, [preFilledData, task, taskCategories, taskDurations, propDefaults, form, setPreFilledData]);

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // No summarization. Just leave the title as-is. If it's a URL, it will be rendered as a clickable link in the task card.
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
            form.setValue("title", typeof result.rephrasedTitle === 'string' ? result.rephrasedTitle : "");
            form.setValue("description", typeof result.description === 'string' ? result.description : "");
            form.setValue("category", typeof result.category === 'string' ? result.category : "");
            form.setValue("priority", priorities.includes(result.priority) ? result.priority : "Medium");
            form.setValue("duration", typeof result.duration === 'number' ? result.duration : 30);

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

  const onSubmit = async (data: TaskFormValues) => {
    const taskData = {
        ...data,
        isAllDay: true, // Always set to true
        reminderAt: data.reminderAt ? data.reminderAt.getTime() : undefined,
        onlyNotifyAtReminder: data.onlyNotifyAtReminder || false,
        syncToGoogleTasks: true, // Enable Google Tasks sync for all new tasks
        recurrence: data.recurrence && data.recurrence.frequency !== 'none' ? {
            ...data.recurrence,
            endDate: data.recurrence.endDate ? data.recurrence.endDate.getTime() : undefined,
        } : undefined,
    }

    try {
      let savedTaskId = task?.id;
      
      if (task) {
        // Update existing task
        if (customSaveHandler) {
          await customSaveHandler(taskData as Partial<Task>);
        } else {
          await updateTask(task.id, taskData as Partial<Task>);
        }
        savedTaskId = task.id;
      } else {
        // Add new task
        if (customAddHandler) {
          const newTask = await customAddHandler({ ...taskData, parentId } as Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt' | 'notifiedAt'>);
          savedTaskId = (newTask as any)?.id; // Assuming the handler returns the task with ID
        } else {
          const newTask = await addTask({ ...taskData, parentId } as Omit<Task, 'id' | 'createdAt' | 'rejectionCount' | 'isMuted' | 'completedAt' | 'lastRejectedAt' | 'notifiedAt'>);
          savedTaskId = (newTask as any)?.id;
        }
      }

      // Task saved successfully
      toast({
        title: task ? "Task Updated" : "Task Created",
        description: task ? "Task has been updated successfully." : "Task has been created successfully.",
      });

      // Sync to Google Tasks after successful save
      if (savedTaskId) {
        try {
          await syncTaskChange(savedTaskId);
        } catch (syncError) {
          // Sync error is handled by the sync hook's onSyncError callback
          console.error('Failed to sync to Google Tasks:', syncError);
        }
      }
      
      onFinished?.();
      if (!task) {
        form.reset(defaultValues);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Failed to save the task. Please try again.",
        variant: "destructive"
      });
    }
  };

  const reminder = form.watch('reminderAt');
  const recurrenceFrequency = form.watch('recurrence.frequency');

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
        {/* Move Add Task Button to Top */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/30">
          {/* Hide on mobile (show only on sm and up) */}
          <div className="w-full sm:w-auto hidden sm:block">
            <h2 className="text-xl font-semibold">
              {task ? "Edit Task" : parentId ? "Add Sub-task" : "Add New Task"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {task ? "Update your task details" : "Create a new task to stay organized"}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {onFinished && (
              <Button 
                variant="ghost" 
                type="button" 
                onClick={onFinished}
                className="flex-1 sm:flex-none h-10 text-sm touch-manipulation"
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit"
              className="flex-1 sm:flex-none h-10 text-sm font-medium touch-manipulation bg-primary hover:bg-primary/90"
            >
              {task ? "Save Changes" : parentId ? "Add Sub-task" : "Add Task"}
            </Button>
          </div>
        </div>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                    <Input 
                      placeholder="e.g., Draft the project proposal" 
                      {...field} 
                      onBlur={handleTitleBlur}
                      className="text-sm sm:text-base" 
                    />
                </FormControl>
                <Button 
                  variant="outline" 
                  size="icon" 
                  type="button" 
                  onClick={handleEnhanceClick} 
                  disabled={isEnhancing}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                >
                    {isEnhancing ? <Loader2 className="animate-spin h-3 w-3 sm:h-4 sm:w-4"/> : <Wand2 className="h-3 w-3 sm:h-4 sm:w-4" />}
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
                  <Textarea 
                    placeholder="Add any details or notes here" 
                    {...field} 
                    className="min-h-[80px] sm:min-h-[100px] text-sm sm:text-base resize-none"
                  />
                </FormControl>
                {isSummarizing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
                        <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
                    </div>
                )}
               </div>
               {!parentId && (
                <FormDescription className="text-xs sm:text-sm">
                  Use bullet points (e.g., `- item`) to auto-create sub-tasks.
                </FormDescription>
               )}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm sm:text-base">Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {taskCategories.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-sm sm:text-base">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm sm:text-base">Priority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                      <SelectValue placeholder="How urgent is this task?" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorities.map((level) => (
                      <SelectItem key={level} value={level} className="text-sm sm:text-base">{level}</SelectItem>
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
                <FormLabel className="text-sm sm:text-base">Estimated Duration</FormLabel>
                <Select onValueChange={field.onChange} value={String(field.value)}>
                  <FormControl>
                    <SelectTrigger className="h-9 sm:h-10 text-sm sm:text-base">
                      <SelectValue placeholder="Select a duration" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {taskDurations.map((dur) => (
                      <SelectItem key={dur} value={String(dur)} className="text-sm sm:text-base">{dur} minutes</SelectItem>
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
                        {field.value ? format(field.value, "PPP, h:mm a") : (
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
                            date < startOfDay(new Date())
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

        <FormField
          control={form.control}
          name="onlyNotifyAtReminder"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Switch checked={!!field.value} onCheckedChange={(val) => field.onChange(val)} />
                </FormControl>
                <div className="space-y-0">
                  <FormLabel className="text-sm font-normal cursor-pointer">Only notify at exact reminder time</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">When enabled, the task will only send a reminder at the specified time and won't generate overdue notifications.</FormDescription>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isArchived"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Switch checked={!!field.value} onCheckedChange={(val) => field.onChange(val)} />
                </FormControl>
                <div className="space-y-0">
                  <FormLabel className="text-sm font-normal cursor-pointer">Archive task</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">Archived tasks are hidden from the main view but notifications will still be sent.</FormDescription>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />
        
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Recurrence</h3>
                <p className="text-sm text-muted-foreground">Set this task to repeat on a schedule.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="recurrence.frequency"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Never" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {recurrenceFrequencies.map(freq => (
                                    <SelectItem key={freq} value={freq} className="capitalize">{freq}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="recurrence.endDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Date (Optional)</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        disabled={!recurrenceFrequency || recurrenceFrequency === 'none'}
                                    >
                                        {field.value ? format(field.value, "PPP") : <span>No end date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={date => date < (reminder || startOfDay(new Date()))}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            
        <Separator />

        </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {onFinished && (
              <Button 
                variant="ghost" 
                type="button" 
                onClick={onFinished}
                className="flex-1 sm:flex-none h-10 text-sm touch-manipulation"
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit"
              className="flex-1 sm:flex-none h-10 text-sm font-medium touch-manipulation bg-primary hover:bg-primary/90"
            >
              {task ? "Save Changes" : parentId ? "Add Sub-task" : "Add Task"}
            </Button>
          </div>

      </form>
    </Form>
  );
}
