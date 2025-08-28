"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Clock, Zap, Target, Calendar, 
  Timer, Coffee, Lightbulb, BookOpen, Dumbbell, Sparkles
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { Priority, TaskCategory, TaskDuration } from '@/lib/types';

const QUICK_TASK_TEMPLATES = [
  {
    icon: Coffee,
    title: "Take a 15-minute break",
    category: "Personal" as TaskCategory,
    duration: 15 as TaskDuration,
    priority: "Low" as Priority,
  },
  {
    icon: BookOpen,
    title: "Read for 30 minutes",
    category: "Study" as TaskCategory,
    duration: 30 as TaskDuration,
    priority: "Medium" as Priority,
  },
  {
    icon: Dumbbell,
    title: "Quick 15-minute workout",
    category: "Personal" as TaskCategory,
    duration: 15 as TaskDuration,
    priority: "High" as Priority,
  },
  {
    icon: Lightbulb,
    title: "Brainstorm new ideas",
    category: "Work" as TaskCategory,
    duration: 30 as TaskDuration,
    priority: "Medium" as Priority,
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className={cn(
        "h-fit shadow-lg border-0 bg-gradient-to-br from-card via-card/95 to-muted/30",
        "ring-1 ring-border/50 hover:ring-primary/30 transition-all duration-300",
        className
      )}>
        <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Quick Actions
            </span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
          {/* Enhanced Quick Templates - Mobile Optimized */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Popular Templates</span>
            </div>
            
            <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
              {QUICK_TASK_TEMPLATES.map((template, index) => {
                const Icon = template.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Button
                      variant="outline"
                      className={cn(
                        "h-auto p-2.5 sm:p-3 flex items-center justify-start gap-2 sm:gap-3 text-left transition-all duration-300",
                        "hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5",
                        "hover:border-primary/30 hover:shadow-md group",
                        "border-border/50 touch-manipulation"
                      )}
                      onClick={() => handleQuickAdd(template)}
                      disabled={isLoading}
                    >
                      <div className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                        "bg-gradient-to-br from-muted to-muted/50 group-hover:from-primary/10 group-hover:to-accent/10",
                        "group-hover:scale-110 flex-shrink-0"
                      )}>
                        <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {template.title}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground mt-0.5 sm:mt-1">
                          <Badge 
                            variant="secondary" 
                            className="text-xs px-1 py-0 sm:px-1.5 bg-primary/10 text-primary border-primary/20"
                          >
                            {template.duration}m
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className="text-xs px-1 py-0 sm:px-1.5 border-border/30 hidden xs:inline-flex"
                          >
                            {template.category}
                          </Badge>
                        </div>
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Enhanced Custom Task Section - Mobile First */}
          <div className="border-t border-border/30 pt-3 sm:pt-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Create Custom</span>
            </div>
            
            {!isAddingCustom ? (
              <Button
                variant="outline"
                className={cn(
                  "w-full border-2 border-dashed border-primary/30 h-9 sm:h-10 text-xs sm:text-sm",
                  "hover:bg-primary/5 hover:border-primary/50 transition-all duration-300",
                  "text-primary font-medium touch-manipulation"
                )}
                onClick={() => setIsAddingCustom(true)}
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                <span className="hidden xs:inline">Add Custom Task</span>
                <span className="xs:hidden">Add Task</span>
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2.5 sm:space-y-3 p-3 sm:p-4 border-2 border-dashed border-primary/30 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5"
              >
                <Input
                  placeholder="Enter task title..."
                  value={customTask.title}
                  onChange={(e) => setCustomTask(prev => ({ ...prev, title: e.target.value }))}
                  className="h-8 sm:h-9 text-xs sm:text-sm border-primary/20 focus:border-primary/40"
                />
                
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <Select
                    value={customTask.category}
                    onValueChange={(value: TaskCategory) => 
                      setCustomTask(prev => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger className="text-xs sm:text-sm h-7 sm:h-8 border-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskCategories.map(category => (
                        <SelectItem key={category} value={category} className="text-xs sm:text-sm">{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={customTask.duration.toString()}
                    onValueChange={(value) => 
                      setCustomTask(prev => ({ ...prev, duration: parseInt(value) as TaskDuration }))
                    }
                  >
                    <SelectTrigger className="text-xs sm:text-sm h-7 sm:h-8 border-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15" className="text-xs sm:text-sm">15 min</SelectItem>
                      <SelectItem value="30" className="text-xs sm:text-sm">30 min</SelectItem>
                      <SelectItem value="60" className="text-xs sm:text-sm">1 hour</SelectItem>
                      <SelectItem value="90" className="text-xs sm:text-sm">1.5 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-1.5 sm:gap-2">
                  <Button
                    size="sm"
                    onClick={handleCustomAdd}
                    disabled={!customTask.title.trim() || isLoading}
                    className="flex-1 h-7 sm:h-8 text-xs sm:text-sm bg-primary hover:bg-primary/90 touch-manipulation"
                  >
                    {isLoading ? "Adding..." : "Add Task"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddingCustom(false)}
                    className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 touch-manipulation"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
