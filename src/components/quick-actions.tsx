"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Clock, Zap, Target, Calendar, 
  Timer, Coffee, Lightbulb, BookOpen, Dumbbell
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Priority, TaskCategory, TaskDuration, TimeOfDay } from '@/lib/types';

const QUICK_TASK_TEMPLATES = [
  {
    icon: Coffee,
    title: "Take a 15-minute break",
    category: "Personal" as TaskCategory,
    duration: 15 as TaskDuration,
    priority: "Low" as Priority,
    timeOfDay: "Afternoon" as TimeOfDay,
  },
  {
    icon: BookOpen,
    title: "Read for 30 minutes",
    category: "Study" as TaskCategory,
    duration: 30 as TaskDuration,
    priority: "Medium" as Priority,
    timeOfDay: "Evening" as TimeOfDay,
  },
  {
    icon: Dumbbell,
    title: "Quick 15-minute workout",
    category: "Personal" as TaskCategory,
    duration: 15 as TaskDuration,
    priority: "High" as Priority,
    timeOfDay: "Morning" as TimeOfDay,
  },
  {
    icon: Lightbulb,
    title: "Brainstorm new ideas",
    category: "Work" as TaskCategory,
    duration: 30 as TaskDuration,
    priority: "Medium" as Priority,
    timeOfDay: "Morning" as TimeOfDay,
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  const { addTask, taskCategories } = useTasks();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTask, setCustomTask] = useState({
    title: '',
    category: 'Work' as TaskCategory,
    duration: 30 as TaskDuration,
    priority: 'Medium' as Priority,
    timeOfDay: 'Morning' as TimeOfDay,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleQuickAdd = async (template: typeof QUICK_TASK_TEMPLATES[0]) => {
    if (!user?.email) return;

    setIsLoading(true);
    try {
      await addTask({
        title: template.title,
        category: template.category,
        duration: template.duration,
        priority: template.priority,
        timeOfDay: template.timeOfDay,
        userEmail: user.email,
      });

      toast({
        title: "Quick task added!",
        description: `"${template.title}" has been added to your tasks.`,
      });
    } catch (error) {
      toast({
        title: "Failed to add task",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomAdd = async () => {
    if (!user?.email || !customTask.title.trim()) return;

    setIsLoading(true);
    try {
      await addTask({
        ...customTask,
        userEmail: user.email,
      });

      toast({
        title: "Custom task added!",
        description: `"${customTask.title}" has been added to your tasks.`,
      });

      setCustomTask({
        title: '',
        category: 'Work',
        duration: 30,
        priority: 'Medium',
        timeOfDay: 'Morning',
      });
      setIsAddingCustom(false);
    } catch (error) {
      toast({
        title: "Failed to add task",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick Templates - More Compact */}
        <div className="grid grid-cols-1 gap-2">
          {QUICK_TASK_TEMPLATES.map((template, index) => {
            const Icon = template.icon;
            return (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-2 flex items-center justify-start gap-2 text-left"
                onClick={() => handleQuickAdd(template)}
                disabled={isLoading}
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{template.title}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      {template.duration}m
                    </Badge>
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      {template.priority}
                    </Badge>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        {/* Custom Task Toggle - More Compact */}
        {!isAddingCustom ? (
          <Button
            variant="ghost"
            className="w-full border border-dashed h-8 text-xs"
            onClick={() => setIsAddingCustom(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Custom Task
          </Button>
        ) : (
          <div className="space-y-2 p-2 border border-dashed rounded-lg bg-muted/20">
            <Input
              placeholder="Task title..."
              value={customTask.title}
              onChange={(e) => setCustomTask(prev => ({ ...prev, title: e.target.value }))}
              className="h-8 text-xs"
            />
            
            <div className="grid grid-cols-2 gap-1">
              <Select
                value={customTask.category}
                onValueChange={(value: TaskCategory) => 
                  setCustomTask(prev => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger className="text-xs h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskCategories.map(category => (
                    <SelectItem key={category} value={category} className="text-xs">{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={customTask.duration.toString()}
                onValueChange={(value) => 
                  setCustomTask(prev => ({ ...prev, duration: parseInt(value) as TaskDuration }))
                }
              >
                <SelectTrigger className="text-xs h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15" className="text-xs">15 min</SelectItem>
                  <SelectItem value="30" className="text-xs">30 min</SelectItem>
                  <SelectItem value="60" className="text-xs">1 hour</SelectItem>
                  <SelectItem value="90" className="text-xs">1.5 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleCustomAdd}
                disabled={!customTask.title.trim() || isLoading}
                className="flex-1 h-7 text-xs"
              >
                Add Task
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAddingCustom(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
