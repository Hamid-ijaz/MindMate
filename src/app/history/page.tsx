
"use client";

import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isYesterday, startOfDay, subDays, differenceInDays } from 'date-fns';
// ...existing code...
import { Button } from '@/components/ui/button';
import { RotateCcw, ChevronDown, ChevronUp, CornerDownRight, Edit, Trash2, ExternalLink, TrendingUp, Clock, Target, Award, BarChart3, Calendar, Zap } from 'lucide-react';
import { ItemActionsDropdown } from '@/components/item-actions-dropdown';
import { ShareDialog } from '@/components/share-dialog';
import { SubtaskList } from '@/components/subtask-list';
import { useState, useMemo } from 'react';
import type { Task } from '@/lib/types';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { safeDateFormat } from '@/lib/utils';

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

const getGroupTitle = (date: Date): string => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return `On ${format(date, 'EEEE, MMMM d')}`;
};

export default function HistoryPage() {
  const { tasks, uncompleteTask, deleteTask, startEditingTask, isLoading } = useTasks();
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [shareDialogState, setShareDialogState] = useState<{isOpen: boolean; task: Task | null}>({
    isOpen: false, 
    task: null
  });

  const allCompletedTasks = useMemo(() => {
    return tasks.filter(t => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
  }, [tasks]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const completedTasks = allCompletedTasks;
    const totalCompleted = completedTasks.length;
    
    // Today's completions
    const today = new Date();
    const todayCompleted = completedTasks.filter(t => 
      t.completedAt && isToday(new Date(t.completedAt))
    ).length;
    
    // This week's completions
    const weekAgo = subDays(today, 7);
    const weekCompleted = completedTasks.filter(t => 
      t.completedAt && new Date(t.completedAt) >= weekAgo
    ).length;
    
    // Average completion time (in days from creation to completion)
    const completionTimes = completedTasks
      .filter(t => t.completedAt && t.createdAt)
      .map(t => differenceInDays(new Date(t.completedAt!), new Date(t.createdAt)));
    const avgCompletionTime = completionTimes.length > 0 
      ? Math.round(completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length)
      : 0;
    
    // Total time spent (sum of all task durations)
    const totalTimeSpent = completedTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    
    // Category breakdown
    const categoryStats = completedTasks.reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Priority breakdown
    const priorityStats = completedTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Streak calculation (consecutive days with completed tasks)
    let currentStreak = 0;
    let checkDate = new Date();
    while (true) {
      const dayCompleted = completedTasks.some(t => 
        t.completedAt && startOfDay(new Date(t.completedAt)).getTime() === startOfDay(checkDate).getTime()
      );
      if (dayCompleted) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
    
    return {
      totalCompleted,
      todayCompleted,
      weekCompleted,
      avgCompletionTime,
      totalTimeSpent,
      categoryStats,
      priorityStats,
      currentStreak
    };
  }, [allCompletedTasks]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    allCompletedTasks.forEach(task => {
        if (!task.completedAt) return;
        const completionDate = new Date(task.completedAt);
        const groupTitle = getGroupTitle(completionDate);
        if (!groups[groupTitle]) {
            groups[groupTitle] = [];
        }
        groups[groupTitle].push(task);
    });
    return groups;
  }, [allCompletedTasks]);

  const getSubtasks = (parentId: string) => {
    return tasks.filter(t => t.parentId === parentId && t.completedAt);
  }

  const getParentTask = (parentId: string): Task | undefined => {
      return tasks.find(t => t.id === parentId);
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => ({...prev, [taskId]: !prev[taskId]}));
  }

  const renderTaskCard = (task: Task) => {
    const subtasks = getSubtasks(task.id);
    const isExpanded = expandedTasks[task.id];
    const parentTask = task.parentId ? getParentTask(task.parentId) : null;

    return (
      <Card key={task.id} className="bg-card/50 opacity-80 hover:opacity-100 transition-all duration-200">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
        <CardHeader>
          {parentTask && !parentTask.completedAt && (
             <CardDescription className="flex items-center text-xs mb-2">
                <CornerDownRight className="h-4 w-4 mr-2" />
                Part of: <Link href="/pending" className="font-semibold hover:underline ml-1">{parentTask.title}</Link>
             </CardDescription>
          )}
          <CardTitle className="text-xl line-through break-word">{task.title}</CardTitle>
          {task.completedAt && (
              <CardDescription>
              Completed at {safeDateFormat(task.completedAt, "h:mm a", "Invalid time")}
              </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{task.category}</Badge>
            <Badge variant={task.priority === 'Critical' ? 'destructive' : task.priority === 'High' ? 'default' : task.priority === 'Medium' ? 'outline' : 'secondary'}>{task.priority} Priority</Badge>
            <Badge variant="outline">{task.duration} min</Badge>
        </CardContent>
        <CardFooter className="justify-between">
          <div className="flex gap-2">
            {subtasks.length > 0 && !task.parentId && (
              <Button variant="ghost" size="sm" onClick={() => toggleExpand(task.id)}>
                {isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                Subtasks ({subtasks.length})
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => uncompleteTask(task.id)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Redo
            </Button>
          </div>
          
          <div className="flex items-center">
            <ItemActionsDropdown
              item={task}
              itemType="task"
              onShare={() => setShareDialogState({isOpen: true, task})}
              onEdit={() => startEditingTask(task.id)}
              onDelete={() => deleteTask(task.id)}
              showExternalLink={true}
            />
          </div>
        </CardFooter>
        {isExpanded && subtasks.length > 0 && (
          <CardContent>
            <SubtaskList parentTask={task} subtasks={subtasks} isHistoryView={true} />
          </CardContent>
        )}
        </motion.div>
      </Card>
    )
  }

  return (
    <motion.div 
      className="container mx-auto max-w-4xl py-8 md:py-16 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Completed Tasks</h1>
        <p className="mt-2 text-muted-foreground">Review your accomplished tasks and productivity insights.</p>
      </motion.div>

      {/* Analytics Dashboard */}
      {!isLoading && allCompletedTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Productivity Analytics</h2>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Completed */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Completed</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{analytics.totalCompleted}</p>
                  </div>
                  <Target className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            {/* Today's Tasks */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Completed Today</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{analytics.todayCompleted}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            {/* Weekly Progress */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 dark:text-purple-400">This Week</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{analytics.weekCompleted}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            {/* Current Streak */}
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Current Streak</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{analytics.currentStreak} days</p>
                  </div>
                  <Zap className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Time Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5" />
                  Time Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Time Invested</span>
                  <span className="font-semibold">{Math.round(analytics.totalTimeSpent / 60)}h {analytics.totalTimeSpent % 60}m</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg. Completion Time</span>
                  <span className="font-semibold">{analytics.avgCompletionTime} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg. Task Duration</span>
                  <span className="font-semibold">{analytics.totalCompleted > 0 ? Math.round(analytics.totalTimeSpent / analytics.totalCompleted) : 0} min</span>
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.categoryStats).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {category === "Work" && <span>💼</span>}
                          {category === "Personal" && <span>🏠</span>}
                          {category === "Health" && <span>❤️</span>}
                          {category === "Other" && <span>📂</span>}
                          <span className="text-sm">{category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(count / analytics.totalCompleted) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium min-w-[2rem] text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Priority Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.priorityStats).map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          priority === 'Critical' ? 'bg-red-500 animate-pulse' :
                          priority === 'High' ? 'bg-orange-500' :
                          priority === 'Medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                        <span className="text-sm">{priority}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              priority === 'Critical' ? 'bg-red-500' :
                              priority === 'High' ? 'bg-orange-500' :
                              priority === 'Medium' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${(count / analytics.totalCompleted) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium min-w-[2rem] text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
      
      <div className="space-y-12">
        {isLoading ? (
          <HistorySkeleton />
        ) : Object.keys(groupedTasks).length === 0 ? (
            <motion.p 
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              You haven't completed any tasks yet.
            </motion.p>
        ) : (
          <AnimatePresence>
            {Object.entries(groupedTasks).map(([groupTitle, tasksInGroup], groupIndex) => (
              <motion.div 
                key={groupTitle}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ delay: groupIndex * 0.1, duration: 0.5 }}
              >
                <h2 className="text-2xl font-semibold mb-4">{groupTitle}</h2>
                <div className="space-y-4">
                  <AnimatePresence>
                    {tasksInGroup.map((task, taskIndex) => {
                      // Only render root tasks or orphaned subtasks directly
                      // Subtasks of completed parents are rendered recursively within the parent
                      if (!task.parentId) {
                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: taskIndex * 0.05, duration: 0.3 }}
                          >
                            {renderTaskCard(task)}
                          </motion.div>
                        );
                      }
                      const parent = getParentTask(task.parentId!);
                      if (parent && !parent.completedAt) {
                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: taskIndex * 0.05, duration: 0.3 }}
                          >
                            {renderTaskCard(task)}
                          </motion.div>
                        ); // Render orphaned subtask
                      }
                      // If parent is also completed, it will be rendered by the parent's `renderTaskCard`
                      // so we don't render it here to avoid duplication.
                      return null;
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
      
      {/* Share Dialog */}
      <ShareDialog
        isOpen={shareDialogState.isOpen}
        onClose={() => setShareDialogState({isOpen: false, task: null})}
        itemType="task"
        itemTitle={shareDialogState.task?.title || ''}
        itemId={shareDialogState.task?.id || ''}
      />
    </motion.div>
  );
}
