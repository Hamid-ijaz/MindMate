"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTasks } from '@/contexts/task-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Timer, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  RotateCcw,
  Clock,
  Zap
} from 'lucide-react';

const durationSchema = z.object({
  durations: z.array(z.object({ 
    value: z.coerce.number().min(1, "Duration must be at least 1 minute").max(480, "Duration cannot exceed 8 hours") 
  }))
});

const defaultDurations = [15, 30, 45, 60, 90, 120, 180, 240];
const quickDurations = [5, 10, 15, 30, 45, 60, 90, 120];

export function TaskDurationSettings() {
  const { taskDurations, setTaskDurations, isLoading: tasksLoading } = useTasks();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof durationSchema>>({
    resolver: zodResolver(durationSchema),
    defaultValues: {
      durations: [],
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "durations"
  });

  useEffect(() => {
    if (!tasksLoading && taskDurations.length > 0) {
      form.reset({
        durations: taskDurations.map(d => ({ value: d })),
      });
    }
  }, [tasksLoading, taskDurations, form]);

  const onSubmit = async (data: z.infer<typeof durationSchema>) => {
    setIsLoading(true);
    try {
      const newDurations = data.durations
        .map(d => Number(d.value))
        .filter(d => d > 0)
        .sort((a, b) => a - b);
      
      // Remove duplicates
      const uniqueDurations = [...new Set(newDurations)];
      
      if (uniqueDurations.length === 0) {
        toast({
          title: "Invalid Durations",
          description: "Please add at least one valid duration.",
          variant: "destructive",
        });
        return;
      }

      await setTaskDurations(uniqueDurations as [number, ...number[]]);
      
      toast({
        title: "Durations Updated",
        description: `Successfully updated ${uniqueDurations.length} duration options.`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update durations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addDuration = () => {
    append({ value: 30 });
  };

  const removeDuration = (index: number) => {
    remove(index);
  };

  const resetToDefaults = () => {
    replace(defaultDurations.map(dur => ({ value: dur })));
    toast({
      title: "Reset to Defaults",
      description: "Durations have been reset to default values.",
    });
  };

  const addQuickDuration = (duration: number) => {
    append({ value: duration });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else if (minutes % 60 === 0) {
      return `${minutes / 60}h`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const { isDirty, isValid } = form.formState;
  const currentDurations = form.watch('durations') || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Time Estimates</h1>
        <p className="text-muted-foreground mt-1">
          Set up duration options for task time estimates. These help you plan your day and track productivity.
        </p>
      </div>

      {/* Duration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Duration Options
          </CardTitle>
          <CardDescription>
            Configure the time estimate options available when creating tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Duration List (in minutes)</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetToDefaults}
                      disabled={isLoading}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset to Defaults
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addDuration}
                      disabled={isLoading}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Duration
                    </Button>
                  </div>
                </div>

                <FormDescription>
                  Set time estimates in minutes. These will be automatically sorted from shortest to longest.
                </FormDescription>

                {fields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No durations configured. Add duration options to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <FormField
                        key={field.id}
                        control={form.control}
                        name={`durations.${index}.value`}
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Input 
                                  type="number"
                                  placeholder="Duration in minutes"
                                  min="1"
                                  max="480"
                                  {...field} 
                                  disabled={isLoading}
                                />
                              </FormControl>
                              <div className="min-w-[60px] text-sm text-muted-foreground">
                                {field.value && Number(field.value) > 0 ? formatDuration(Number(field.value)) : ""}
                              </div>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeDuration(index)}
                                disabled={isLoading}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {isDirty ? "You have unsaved changes" : "All changes saved"}
                  {currentDurations.length > 0 && (
                    <> • {currentDurations.length} duration options</>
                  )}
                </div>
                <Button 
                  type="submit" 
                  disabled={!isDirty || !isValid || isLoading || currentDurations.length === 0}
                  className="min-w-[140px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Durations
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Quick Add */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Add Durations
          </CardTitle>
          <CardDescription>
            Common duration options you can add with one click.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {quickDurations.map((duration) => {
                const isAlreadyAdded = currentDurations.some(
                  dur => Number(dur.value) === duration
                );
                
                return (
                  <Badge
                    key={duration}
                    variant={isAlreadyAdded ? "secondary" : "outline"}
                    className={`cursor-pointer transition-colors ${
                      isAlreadyAdded 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-primary hover:text-primary-foreground"
                    }`}
                    onClick={() => !isAlreadyAdded && addQuickDuration(duration)}
                  >
                    {formatDuration(duration)}
                    {!isAlreadyAdded && <Plus className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Click on a duration to add it to your list. Durations already in your list are grayed out.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Duration Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Duration Guidelines</CardTitle>
          <CardDescription>
            Best practices for setting up task duration estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Short Tasks (5-30 minutes)</h4>
              <p className="text-sm text-muted-foreground">
                Quick actions like emails, calls, or small administrative tasks. Perfect for filling gaps in your schedule.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Medium Tasks (30-90 minutes)</h4>
              <p className="text-sm text-muted-foreground">
                Focused work sessions, meetings, or moderate complexity tasks that require sustained attention.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Long Tasks (2+ hours)</h4>
              <p className="text-sm text-muted-foreground">
                Deep work sessions, project phases, or complex tasks that need extended focus time.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Estimation Tips</h4>
              <p className="text-sm text-muted-foreground">
                Start with common durations, add buffer time, and adjust based on your actual completion times.
              </p>
            </div>
          </div>

          <Separator />

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-900/30">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 Pro Tip
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Use the Pomodoro Technique: Set durations like 25, 50, and 75 minutes for focused work sessions with built-in breaks.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
