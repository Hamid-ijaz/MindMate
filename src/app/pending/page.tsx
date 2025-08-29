
"use client";

import { useState, useTransition, useEffect, useRef, Suspense, useMemo } from 'react';
import { useTasks } from '@/contexts/task-context';
// ...existing code...
import { TaskItem } from '@/components/task-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, Loader2, PlusCircle, Search, Filter, X, SortAsc, Target, CheckCircle2, Archive, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { rewordTask } from '@/ai/flows/reword-task-flow';
import { useToast } from '@/hooks/use-toast';
import type { Task, Priority, TaskCategory } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SuggestedTask {
  title: string;
  description: string;
}

function PendingTasksSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
         <Card key={i} className="overflow-hidden">
            <div className="p-4 sm:p-6">
              {/* Mobile-optimized skeleton layout */}
              <div className="flex items-start gap-3">
                <Skeleton className="w-5 h-5 rounded-full mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-full max-w-xs" />
                    <Skeleton className="h-4 w-full max-w-md" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                  </div>
                </div>
                <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
              </div>
              
              {/* Mobile-optimized footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20 rounded-lg" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>
        </Card>
      ))}
    </div>
  )
}

function PendingTasksContent() {
  const { tasks, addTask, updateTask, isLoading } = useTasks();
  const { toast } = useToast();
  const [isRewording, startRewordTransition] = useTransition();
  const [showRewordDialog, setShowRewordDialog] = useState(false);
  const [rewordedSuggestions, setRewordedSuggestions] = useState<SuggestedTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Record<string, boolean>>({});
  const [taskToReword, setTaskToReword] = useState<Task | null>(null);
  
  // Search and filter state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'alphabetical' | 'oldest'>('date');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  
  const searchParams = useSearchParams();
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { user } = useAuth();

  const rootTasks = tasks.filter(t => !t.parentId);
  const uncompletedTasks = rootTasks.filter(t => !t.completedAt);
  const archivedTasks = rootTasks.filter(t => !t.completedAt && t.isArchived);

  // Filtered and sorted tasks
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = uncompletedTasks.filter(task => {
      const matchesSearch = search === "" || 
        task.title.toLowerCase().includes(search.toLowerCase()) || 
        (task.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" || category === "" || category === "all-categories" || task.category === category;
      const matchesPriority = priority === "all" || priority === "" || priority === "all-priorities" || task.priority === priority;
      const matchesArchived = showArchived ? true : !task.isArchived; // Show archived only if showArchived is true, otherwise exclude archived
      let matchesOverdue = true;
      if (overdueOnly) {
        if (task.reminderAt) {
          const due = new Date(task.reminderAt);
          const now = new Date();
          matchesOverdue = due < now;
        } else {
          matchesOverdue = false;
        }
      }
      return matchesSearch && matchesCategory && matchesPriority && matchesArchived && matchesOverdue;
    });

    // Sort the filtered tasks
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority': {
          const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'date':
        default:
          return b.createdAt - a.createdAt;
      }
    });
  }, [uncompletedTasks, search, category, priority, sortBy, overdueOnly, showArchived]);

  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && !isLoading) {
      setTimeout(() => {
        const el = taskRefs.current[taskId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('animate-pulse', 'bg-primary/10', 'rounded-lg');
          setTimeout(() => {
            el.classList.remove('animate-pulse', 'bg-primary/10', 'rounded-lg');
          }, 2000);
        }
      }, 100); 
    }
  }, [searchParams, isLoading]);

  const handleRewordClick = (task: Task) => {
    setTaskToReword(task);
    startRewordTransition(async () => {
      try {
        const result = await rewordTask({
          title: task.title,
          description: task.description || "",
        });
        setRewordedSuggestions(result.suggestedTasks);
        setSelectedTasks(result.suggestedTasks.reduce((acc, task) => {
          acc[task.title] = true; // Default all to selected
          return acc;
        }, {} as Record<string, boolean>));
        setShowRewordDialog(true);
      } catch (error) {
        console.error("Failed to reword task:", error);
        toast({
          title: "AI Error",
          description: "Could not get suggestions. Please try again.",
          variant: "destructive",
        });
      }
    });
  };
  
  const handleToggleSelection = (title: string) => {
    setSelectedTasks(prev => ({...prev, [title]: !prev[title]}));
  };

  const handleAcceptReword = () => {
    if (!taskToReword || rewordedSuggestions.length === 0) return;

    const tasksToAdd = rewordedSuggestions.filter(suggestion => selectedTasks[suggestion.title]);

    if(tasksToAdd.length === 0) {
        toast({
            title: "No tasks selected",
            description: "Please select at least one task to add.",
            variant: "destructive"
        });
        return;
    }
    
    tasksToAdd.forEach(suggestion => {
        addTask({
            parentId: taskToReword.id, // Set the parent ID
            title: suggestion.title,
            description: suggestion.description,
            category: taskToReword.category,
            priority: 'Low',
            duration: 15,
            userEmail: user?.email || '', // Add missing userEmail
        });
    });
    
    toast({
      title: `${tasksToAdd.length} New Sub-task(s) Added!`,
      description: `The selected tasks are now under "${taskToReword.title}".`,
    });

    setShowRewordDialog(false);
    setRewordedSuggestions([]);
    setSelectedTasks({});
    setTaskToReword(null);
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
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Pending Tasks
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
            Focus on what matters most. You've got this! 💪
          </p>
        </motion.div>

        {/* Mobile-optimized search and filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="space-y-4"
        >
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pending tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-10 h-12 text-base border-2 focus:border-primary/50 transition-all rounded-xl bg-background/90 backdrop-blur-sm shadow-sm"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-destructive/10 rounded-full"
                onClick={() => setSearch("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {/* Mobile-first filter controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Filter toggles - horizontal on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              <Button 
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className="whitespace-nowrap h-10 px-4 rounded-full transition-all"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {(category || priority || overdueOnly || showArchived) && <span className="ml-1 text-xs bg-primary-foreground text-primary rounded-full px-1">•</span>}
              </Button>
              {/* Overdue filter toggle */}
              <Button
                variant={overdueOnly ? "default" : "outline"}
                onClick={() => setOverdueOnly(v => !v)}
                className="whitespace-nowrap h-10 px-4 rounded-full"
              >
                <span className="mr-2">⏰</span>
                Overdue
                {overdueOnly && <span className="ml-1 text-xs bg-destructive text-white rounded-full px-1">!</span>}
              </Button>
              {/* Archive filter toggle */}
              <Button
                variant={showArchived ? "default" : "outline"}
                onClick={() => setShowArchived(v => !v)}
                className="whitespace-nowrap h-10 px-4 rounded-full"
              >
                <span className="mr-2">📁</span>
                {showArchived ? "Show Archived" : "Show Archived"}
                {showArchived && <span className="ml-1 text-xs bg-primary text-white rounded-full px-1">✓</span>}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearch("");
                  setCategory("");
                  setPriority("");
                  setSortBy('date');
                  setShowFilters(false);
                  setOverdueOnly(false);
                  setShowArchived(false);
                }}
                className="whitespace-nowrap h-10 px-4 rounded-full"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
              
              {/* Quick sort on mobile */}
              <Select value={sortBy} onValueChange={(value: 'date' | 'priority' | 'alphabetical' | 'oldest') => setSortBy(value)}>
                <SelectTrigger className="h-10 w-auto min-w-[140px] rounded-full">
                  <div className="flex items-center gap-2">
                    <SortAsc className="w-4 h-4" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">📅 Recent First</SelectItem>
                  <SelectItem value="oldest">📅 Oldest First</SelectItem>
                  <SelectItem value="priority">⚡ By Priority</SelectItem>
                  <SelectItem value="alphabetical">🔤 A to Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Expanded Filters - Mobile Optimized */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Category Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Category</label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value="Work">💼 Work</SelectItem>
                            <SelectItem value="Personal">🏠 Personal</SelectItem>
                            <SelectItem value="Health">❤️ Health</SelectItem>
                            <SelectItem value="Other">📂 Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Priority Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Priority</label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue placeholder="All Priorities" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="Critical">🔥 Critical</SelectItem>
                            <SelectItem value="High">⚡ High</SelectItem>
                            <SelectItem value="Medium">📋 Medium</SelectItem>
                            <SelectItem value="Low">📝 Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {/* Tasks List Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-6"
        >
          {/* Tasks Header with Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <h2 className="text-lg sm:text-xl font-semibold px-4 py-2 bg-muted/30 rounded-full whitespace-nowrap">
                📋 To-Do ({isLoading ? '...' : filteredAndSortedTasks.length}
                {search || category || priority ? ` of ${uncompletedTasks.length}` : ''})
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
          
          {/* Tasks Grid */}
          <div className="space-y-4">
            {isLoading ? (
              <PendingTasksSkeleton />
            ) : filteredAndSortedTasks.length === 0 ? (
              <motion.div 
                className="text-center py-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  {search || category || priority || showArchived ? (
                    <Search className="w-12 h-12 text-muted-foreground" />
                  ) : (
                    <CheckCircle2 className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>
                {search || category || priority || showArchived ? (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold">No tasks match your filters</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Try adjusting your search terms or filters to see more tasks
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearch("");
                        setCategory("");
                        setPriority("");
                        setShowFilters(false);
                        setShowArchived(false);
                      }}
                      className="mt-4"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear Filters
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold">All caught up! 🎉</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      No pending tasks. Time to relax or create some new goals!
                    </p>
                  </div>
                )}
              </motion.div>
            ) : (
              <AnimatePresence>
                {filteredAndSortedTasks.map((task, index) => (
                  <motion.div 
                    key={task.id} 
                    ref={el => { taskRefs.current[task.id] = el; }}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ delay: index * 0.05, duration: 0.4 }}
                    whileHover={{ scale: 1.01, y: -2 }}
                    className="transform-gpu"
                  >
                    <TaskItem 
                      task={task}
                      extraActions={
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRewordClick(task)} 
                          disabled={isRewording && taskToReword?.id === task.id}
                          className="h-9 px-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950 dark:hover:bg-purple-900 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 transition-all duration-200"
                        >
                          {isRewording && taskToReword?.id === task.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4 md:mr-2" />
                          )}
                          <span className="hidden md:inline">Divide Task</span>
                        </Button>
                      }
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* Archived Tasks Section */}
        {!showArchived && archivedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Card className="border-muted bg-muted/20">
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setArchivedOpen(o => !o)}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-lg">
                    <Archive className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Archived Tasks ({archivedTasks.length})</CardTitle>
                  </div>
                  <div className="flex items-center gap-3">
                    <CardDescription className="text-sm text-muted-foreground mr-2">Tasks that are archived but notifications will still be sent</CardDescription>
                    {archivedOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {archivedOpen && (
                    <>
                      {archivedTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="">
                          <TaskItem
                            task={task}
                            extraActions={
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateTask(task.id, { isArchived: false })}
                                className="text-xs"
                              >
                                <ArchiveRestore className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </div>
                      ))}

                      {archivedTasks.length > 3 && (
                        <Button
                          variant="outline"
                          onClick={() => setShowArchived(true)}
                          className="w-full mt-3 text-sm"
                        >
                          View all {archivedTasks.length} archived tasks
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

       {/* Enhanced AI Task Division Dialog */}
       <AlertDialog open={showRewordDialog} onOpenChange={setShowRewordDialog}>
            <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
                <AlertDialogHeader className="pb-4">
                    <AlertDialogTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <Wand2 className="h-5 w-5 text-purple-600 dark:text-purple-400"/>
                      </div>
                      Task Breakdown Suggestions
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-base leading-relaxed">
                       Here are some suggested sub-tasks for <span className="font-semibold text-foreground">"{taskToReword?.title}"</span>. 
                       Select the ones you'd like to add as manageable steps.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                
                {/* Scrollable suggestions */}
                <div className="flex-1 overflow-y-auto py-2 space-y-3 max-h-[40vh] pr-2">
                    {rewordedSuggestions.map((suggestion, index) => (
                       <motion.div 
                         key={index} 
                         className="flex items-start gap-3 rounded-xl border-2 p-4 transition-all duration-200 hover:border-primary/30 hover:bg-muted/30"
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: index * 0.1 }}
                       >
                         <Checkbox 
                           id={`task-${index}`} 
                           checked={!!selectedTasks[suggestion.title]}
                           onCheckedChange={() => handleToggleSelection(suggestion.title)}
                           className="mt-1 h-5 w-5"
                         />
                         <Label htmlFor={`task-${index}`} className="flex-1 cursor-pointer">
                            <div className="space-y-1">
                              <p className="font-semibold text-base leading-tight">{suggestion.title}</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.description}</p>
                            </div>
                         </Label>
                       </motion.div>
                    ))}
                </div>
                
                {/* Action buttons */}
                <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowRewordDialog(false)}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAcceptReword}
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add {Object.values(selectedTasks).filter(Boolean).length} Selected Tasks
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

export default function PendingTasksPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PendingTasksContent />
    </Suspense>
  );
}
