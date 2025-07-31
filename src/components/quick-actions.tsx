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
        rejectionCount: 0,
        isMuted: false,
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
        rejectionCount: 0,
        isMuted: false,
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Templates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_TASK_TEMPLATES.map((template, index) => {
            const Icon = template.icon;
            return (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-3 flex flex-col items-start gap-2"
                onClick={() => handleQuickAdd(template)}
                disabled={isLoading}
              >
                <div className="flex items-center gap-2 w-full">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium truncate">{template.title}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    {template.duration}m
                  </Badge>
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    {template.priority}
                  </Badge>
                </div>
              </Button>
            );
          })}
        </div>

        {/* Custom Task Toggle */}
        {!isAddingCustom ? (
          <Button
            variant="ghost"
            className="w-full border-2 border-dashed"
            onClick={() => setIsAddingCustom(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Task
          </Button>
        ) : (
          <div className="space-y-3 p-3 border-2 border-dashed rounded-lg">
            <Input
              placeholder="Task title..."
              value={customTask.title}
              onChange={(e) => setCustomTask(prev => ({ ...prev, title: e.target.value }))}
            />
            
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={customTask.category}
                onValueChange={(value: TaskCategory) => 
                  setCustomTask(prev => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={customTask.duration.toString()}
                onValueChange={(value) => 
                  setCustomTask(prev => ({ ...prev, duration: parseInt(value) as TaskDuration }))
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCustomAdd}
                disabled={!customTask.title.trim() || isLoading}
                className="flex-1"
              >
                Add Task
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAddingCustom(false)}
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
