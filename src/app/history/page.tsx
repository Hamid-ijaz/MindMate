
"use client";

import { useTasks } from '@/contexts/task-context';
import { useOffline } from '@/contexts/offline-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isYesterday, startOfDay, subDays, differenceInDays, startOfWeek, endOfWeek, isThisWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw, ChevronDown, ChevronUp, CornerDownRight, Edit, Trash2, 
  ExternalLink, TrendingUp, Clock, Target, Award, BarChart3, Calendar, 
  Zap, Filter, Search, Trophy, CheckCircle2, Timer, MapPin, Share2,
  WifiOff, Database, AlertCircle
} from 'lucide-react';
import { ItemActionsDropdown } from '@/components/item-actions-dropdown';
import { ShareDialog } from '@/components/share-dialog';
import { SubtaskList } from '@/components/subtask-list';
import { useState, useMemo } from 'react';
import type { Task } from '@/lib/types';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { safeDateFormat, cn } from '@/lib/utils';

function HistorySkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="w-4 h-4 rounded-full mt-1" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-2 pt-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
              <Skeleton className="w-8 h-8 rounded-md" />
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
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
  const { isOnline, isServerReachable, offlineActions } = useOffline();
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [shareDialogState, setShareDialogState] = useState<{isOpen: boolean; task: Task | null}>({
    isOpen: false, 
    task: null
  });

  const allCompletedTasks = useMemo(() => {
    let filtered = tasks.filter(t => t.completedAt).sort((a, b) => b.completedAt! - a.completedAt!);
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(task => task.category === selectedCategory);
    }
    
    return filtered;
  }, [tasks, searchQuery, selectedCategory]);

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
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <Card className={cn(
          "group overflow-hidden transition-all duration-200 hover:shadow-lg",
          "bg-green-50/30 border-green-200/50 dark:bg-green-950/20 dark:border-green-800/30"
        )}>
          {/* Mobile-optimized header */}
          <div className="p-4 pb-2">
            {/* Parent task indicator for subtasks */}
            {parentTask && !parentTask.completedAt && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-md">
                <CornerDownRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Part of:</span>
                <Link 
                  href="/pending" 
                  className="text-xs font-medium text-primary hover:underline truncate"
                >
                  {parentTask.title}
                </Link>
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Completion indicator and category */}
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {task.category}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <span>•</span>
                    <span>Completed</span>
                  </div>
                </div>

                {/* Title with strikethrough */}
                <h3 className="text-base sm:text-lg font-semibold leading-tight mb-1 line-through text-muted-foreground break-words">
                  {task.title}
                </h3>
                
                {/* Description */}
                {task.description && (
                  <p className="text-sm text-muted-foreground/80 line-clamp-2 mb-2">
                    {task.description}
                  </p>
                )}

                {/* Completion time */}
                {task.completedAt && (
                  <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <Clock className="w-3 h-3" />
                    <span>
                      Completed at {safeDateFormat(task.completedAt, "h:mm a", "Invalid time")}
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile-optimized actions - always visible */}
              <div className="flex-shrink-0">
                <ItemActionsDropdown
                  item={task}
                  itemType="task"
                  onShare={() => setShareDialogState({isOpen: true, task})}
                  onEdit={() => startEditingTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  showExternalLink={true}
                />
              </div>
            </div>
          </div>

          {/* Mobile-optimized metadata section */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority badge */}
              <Badge
                variant={
                  task.priority === 'Critical' ? 'destructive' :
                  task.priority === 'High' ? 'default' :
                  task.priority === 'Medium' ? 'outline' : 'secondary'
                }
                className="text-xs font-medium"
              >
                {task.priority}
              </Badge>
              
              {/* Duration */}
              <Badge variant="outline" className="text-xs">
                ⏱️ {task.duration}m
              </Badge>
              
              {/* Time of day */}
              <Badge variant="secondary" className="text-xs">
                🕒 {task.timeOfDay}
              </Badge>

              {/* Completion badge */}
              <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                ✅ Done
              </Badge>
            </div>
          </div>

          {/* Mobile-optimized footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-green-50/50 dark:bg-green-950/50">
            <div className="flex items-center gap-2">
              {/* Subtasks toggle */}
              {subtasks.length > 0 && !task.parentId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => toggleExpand(task.id)}
                  className="h-8 px-2 text-xs"
                >
                  {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                  {subtasks.length} subtasks
                </Button>
              )}
              
              {/* View details button */}
              <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                <Link href={`/task/${task.id}`}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Details
                </Link>
              </Button>
            </div>

            {/* Redo button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => uncompleteTask(task.id)}
              className="h-8 px-3 text-xs font-medium text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Redo
            </Button>
          </div>

          {/* Expanded subtasks */}
          {isExpanded && subtasks.length > 0 && (
            <div className="border-t bg-muted/10">
              <div className="p-4">
                <SubtaskList parentTask={task} subtasks={subtasks} isHistoryView={true} />
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto max-w-6xl py-6 px-4 space-y-6">
        {/* Mobile-optimized header */}
        <motion.div 
          className="text-center sm:text-left"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center sm:justify-start gap-3 mb-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Completed Tasks
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
            Celebrate your achievements and track your productivity journey
          </p>
        </motion.div>

        {/* Offline Status Banner */}
        {(!isOnline || !isServerReachable) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {!isOnline ? (
                    <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  ) : (
                    <Database className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-amber-900 dark:text-amber-100 text-sm">
                      {!isOnline ? 'Viewing Cached History' : 'Server Offline'}
                    </h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {!isOnline 
                        ? 'Showing your locally cached completed tasks. Some recent completions may not appear until you\'re back online.'
                        : 'Displaying cached data. Recent changes will appear when server is available.'
                      }
                      {offlineActions.filter(action => action.type.includes('task')).length > 0 && (
                        <span className="ml-2 font-medium">
                          ({offlineActions.filter(action => action.type.includes('task')).length} pending)
                        </span>
                      )}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800"
                    onClick={() => window.location.href = '/offline'}
                  >
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Search and Filter Controls */}
        {!isLoading && allCompletedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search completed tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              {['all', 'Work', 'Personal', 'Health', 'Other'].map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="whitespace-nowrap h-11 px-4"
                >
                  {category === 'all' ? '🗂️ All' : 
                   category === 'Work' ? '💼 Work' :
                   category === 'Personal' ? '🏠 Personal' :
                   category === 'Health' ? '❤️ Health' : '📂 Other'}
                </Button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Analytics Dashboard - Mobile Optimized */}
        {!isLoading && allCompletedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="space-y-6"
          >
            {/* Quick Stats - Mobile First Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Completed */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="text-center">
                    <Target className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {analytics.totalCompleted}
                    </p>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Total Tasks
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Today's Tasks */}
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="text-center">
                    <Calendar className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {analytics.todayCompleted}
                    </p>
                    <p className="text-xs font-medium text-green-600 dark:text-green-400">
                      Today
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Progress */}
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {analytics.weekCompleted}
                    </p>
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
                      This Week
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Current Streak */}
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4">
                  <div className="text-center">
                    <Zap className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {analytics.currentStreak}
                    </p>
                    <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                      Day Streak
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Analytics - Mobile Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Time Analytics */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Clock className="w-5 h-5" />
                    Time Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Time</span>
                    <span className="font-semibold text-sm">
                      {Math.floor(analytics.totalTimeSpent / 60)}h {analytics.totalTimeSpent % 60}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg. Completion</span>
                    <span className="font-semibold text-sm">{analytics.avgCompletionTime} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg. Duration</span>
                    <span className="font-semibold text-sm">
                      {analytics.totalCompleted > 0 ? Math.round(analytics.totalTimeSpent / analytics.totalCompleted) : 0} min
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg">Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.categoryStats).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {category === "Work" && "💼"}
                            {category === "Personal" && "🏠"}
                            {category === "Health" && "❤️"}
                            {category === "Other" && "📂"}
                          </span>
                          <span className="text-sm font-medium">{category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(count / analytics.totalCompleted) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold min-w-[1.5rem] text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Priority Distribution */}
              <Card className="md:col-span-2 lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg">Priority Mix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.priorityStats).map(([priority, count]) => (
                      <div key={priority} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            priority === 'Critical' ? 'bg-red-500' :
                            priority === 'High' ? 'bg-orange-500' :
                            priority === 'Medium' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`} />
                          <span className="text-sm font-medium">{priority}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
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
                          <span className="text-sm font-bold min-w-[1.5rem] text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
        
        {/* Tasks List */}
        <div className="space-y-8">
          {isLoading ? (
            <HistorySkeleton />
          ) : Object.keys(groupedTasks).length === 0 ? (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No completed tasks yet</h3>
              <p className="text-muted-foreground text-sm">
                Complete some tasks to see your achievements here!
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {Object.entries(groupedTasks).map(([groupTitle, tasksInGroup], groupIndex) => (
                <motion.div 
                  key={groupTitle}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ delay: groupIndex * 0.1, duration: 0.5 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <h2 className="text-lg sm:text-xl font-semibold px-4 py-2 bg-muted/50 rounded-full">
                      {groupTitle}
                    </h2>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  
                  <div className="space-y-3">
                    <AnimatePresence>
                      {tasksInGroup.map((task, taskIndex) => {
                        // Only render root tasks or orphaned subtasks directly
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
                          );
                        }
                        return null;
                      })}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
      
      {/* Share Dialog */}
      <ShareDialog
        isOpen={shareDialogState.isOpen}
        onClose={() => setShareDialogState({isOpen: false, task: null})}
        itemType="task"
        itemTitle={shareDialogState.task?.title || ''}
        itemId={shareDialogState.task?.id || ''}
      />
    </div>
  );
}
