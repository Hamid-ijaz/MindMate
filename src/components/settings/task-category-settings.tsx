"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTasks } from '@/contexts/task-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  RotateCcw,
  Timer
} from 'lucide-react';

const taskSettingsSchema = z.object({
  categories: z.array(z.object({ 
    value: z.string().min(1, "Category name required").max(50, "Name too long") 
  })),
  durations: z.array(z.object({ 
    value: z.coerce.number().min(1, "Min 1 minute").max(480, "Max 8 hours") 
  }))
});

const defaultCategories = ["Work", "Personal", "Health", "Learning", "Finance", "Home"];
const defaultDurations = [15, 30, 45, 60, 90, 120];

export function TaskCategorySettings() {
  const { taskCategories, setTaskCategories, taskDurations, setTaskDurations, isLoading: tasksLoading } = useTasks();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof taskSettingsSchema>>({
    resolver: zodResolver(taskSettingsSchema),
    defaultValues: {
      categories: [],
      durations: [],
    }
  });

  const { fields: categoryFields, append: appendCategory, remove: removeCategory, replace: replaceCategories } = useFieldArray({
    control: form.control,
    name: "categories"
  });

  const { fields: durationFields, append: appendDuration, remove: removeDuration, replace: replaceDurations } = useFieldArray({
    control: form.control,
    name: "durations"
  });

  useEffect(() => {
    if (!tasksLoading) {
      replaceCategories(taskCategories.map(cat => ({ value: cat })));
      replaceDurations(taskDurations.map(dur => ({ value: dur })));
    }
  }, [taskCategories, taskDurations, tasksLoading, replaceCategories, replaceDurations]);

  const onSubmit = async (data: z.infer<typeof taskSettingsSchema>) => {
    setIsLoading(true);
    try {
      const newCategories = data.categories.map(cat => cat.value);
      const newDurations = data.durations.map(dur => dur.value);
      
      await setTaskCategories(newCategories);
      await setTaskDurations(newDurations);
      
      toast({
        title: "Settings saved",
        description: "Task settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addDefaultCategories = () => {
    const existing = categoryFields.map(field => field.value);
    const toAdd = defaultCategories.filter(cat => !existing.includes(cat));
    toAdd.forEach(cat => appendCategory({ value: cat }));
  };

  const addDefaultDurations = () => {
    const existing = durationFields.map(field => field.value);
    const toAdd = defaultDurations.filter(dur => !existing.includes(dur));
    toAdd.forEach(dur => appendDuration({ value: dur }));
  };

  const resetToDefaults = () => {
    replaceCategories(defaultCategories.map(cat => ({ value: cat })));
    replaceDurations(defaultDurations.map(dur => ({ value: dur })));
  };

  if (tasksLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {categoryFields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`categories.${index}.value`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input {...formField} placeholder="Category name" />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeCategory(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendCategory({ value: "" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDefaultCategories}
                >
                  Add Defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Time Estimates (minutes)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {durationFields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`durations.${index}.value`}
                    render={({ field: formField }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input 
                              {...formField} 
                              type="number" 
                              placeholder="Minutes"
                              min="1"
                              max="480"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeDuration(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendDuration({ value: 30 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Duration
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDefaultDurations}
                >
                  Add Defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={resetToDefaults}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
