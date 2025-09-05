
"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useTasks } from "@/contexts/task-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Priority, Task } from "@/lib/types";
import { AlertCircle, Check, Sparkles, X, Loader2, Wand2, Edit, CalendarIcon, Repeat, ExternalLink, ChevronLeft, ChevronRight, Target, List, Clock, Keyboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRandomQuote } from "@/lib/motivational-quotes";
import { MAX_REJECTIONS_BEFORE_PROMPT, REJECTION_HOURS } from "@/lib/constants";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { AddTaskButton } from "./manage-tasks-sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { rewordTask } from '@/ai/flows/reword-task-flow';
import { getDefaultPriority, cn, safeDateFormat, isTaskOverdue } from "@/lib/utils";
import { TaskItem } from "@/components/task-item";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { PlusCircle } from "lucide-react";
import { SubtaskList } from "./subtask-list";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { format } from "date-fns";
import { useNotifications } from "@/contexts/notification-context";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import Link from "next/link";
import { useCompletionAudio } from '@/hooks/use-completion-audio';
import { ItemActionsDropdown } from '@/components/item-actions-dropdown';
import { ShareDialog } from '@/components/share-dialog';
import { useAuth } from "@/contexts/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { slideInFromTop, carouselSlide, staggerContainer, staggerItem, cardHover } from "@/lib/animations";

// Animation variants for the component
const slideInFromTopVariant = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 }
};


export function TaskSuggestion() {
    const { tasks, acceptTask, rejectTask, muteTask, addTask, isLoading: tasksLoading, startEditingTask, deleteTask } = useTasks();
    const { deleteNotification } = useNotifications();
    const { handleTaskCompletion } = useCompletionAudio();
  const { user } = useAuth();
  const [currentPriority, setCurrentPriority] = useState<Priority>('Medium');

  // Set default priority to highest available when tasks change - considering recently rejected tasks
  useEffect(() => {
    const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId && !t.isArchived);
    const now = Date.now();
    const rejectionTimeout = REJECTION_HOURS * 60 * 60 * 1000;
    
    const priorityOrderArr: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
    
    for (let i = 0; i < priorityOrderArr.length; i++) {
      const priority = priorityOrderArr[i];
      // Check if there are any non-recently-rejected tasks for this priority
      const availableTasks = uncompletedTasks.filter(task => {
        const isPriorityMatch = task.priority === priority;
        const recentlyRejected = task.lastRejectedAt && (now - task.lastRejectedAt < rejectionTimeout);
        return isPriorityMatch && !recentlyRejected;
      });
      
      if (availableTasks.length > 0) {
        setCurrentPriority(priority);
        break;
      }
    }
  }, [tasks]);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [showRejectionPrompt, setShowRejectionPrompt] = useState(false);
  const [showRewordDialog, setShowRewordDialog] = useState(false);
  const [rewordedSuggestions, setRewordedSuggestions] = useState<{ title: string; description: string }[]>([]);
  const [selectedRewordedTasks, setSelectedRewordedTasks] = useState<Record<string, boolean>>({});
  
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isAcceptingReword, setIsAcceptingReword] = useState(false);
  const [shareDialog, setShareDialog] = useState<{isOpen: boolean, task: Task | null}>({
    isOpen: false, 
    task: null
  });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const [isPending, startTransition] = useTransition();

  // Keyboard navigation support - moved before early returns to comply with Rules of Hooks
  // Helper to advance to next slide or shift to next lower priority when at the end
  const handleNext = () => {
    if (!api) return;
    // If there are more slides in current priority, go next
    if (currentSlide < possibleTasks.length - 1) {
      api.scrollNext();
      return;
    }

    // Otherwise find the next lower priority that has tasks
    const priorityOrder: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
    const currentIndex = priorityOrder.indexOf(currentPriority);
    for (let i = currentIndex + 1; i < priorityOrder.length; i++) {
      const nextPriority = priorityOrder[i];
      if (getAvailableTaskCount(nextPriority) > 0) {
        setCurrentPriority(nextPriority);
        // reset slide index; let possibleTasks update then scroll to first
        setCurrentSlide(0);
        // small timeout to allow re-render of carousel items
        setTimeout(() => {
          try { api.scrollTo(0); } catch (e) { /* ignore if api not ready */ }
        }, 60);
        return;
      }
    }

    // If no lower priority has tasks, do nothing (stay on last slide)
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't trigger shortcuts when typing
      }
      
      // Calculate current values inline to avoid dependency issues
      const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId && !t.isArchived);
      const now = Date.now();
      const rejectionTimeout = REJECTION_HOURS * 60 * 60 * 1000;
      const filtered = uncompletedTasks.filter(task => {
        const isPriorityMatch = task.priority === currentPriority;
        const recentlyRejected = task.lastRejectedAt && (now - task.lastRejectedAt < rejectionTimeout);
        return isPriorityMatch && !recentlyRejected;
      });
      
      const currentTask = filtered[currentSlide];
      const hasPendingSubtasks = currentTask ? tasks.filter(t => t.parentId === currentTask.id && !t.completedAt).length > 0 : false;
      
      switch (e.key.toLowerCase()) {
        case 'enter':
        case ' ':
          e.preventDefault();
          if (currentTask && !hasPendingSubtasks) {
            handleAccept();
          }
          break;
        case 'x':
        case 'escape':
          e.preventDefault();
          if (currentTask) {
            handleReject();
          }
          break;
        case 'arrowleft':
        case 'a':
          e.preventDefault();
          api?.scrollPrev();
          break;
        case 'arrowright':
        case 'd':
          e.preventDefault();
          handleNext();
          break;
        case 'e':
          e.preventDefault();
          if (currentTask) {
            startEditingTask(currentTask.id);
          }
          break;
        case 'b':
          e.preventDefault();
          if (currentTask) {
            handleRewordClick();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [tasks, currentPriority, currentSlide, api]); // Safe dependencies

  // Always default to 'Medium' on mount
  
  // ...existing code...
  // ...existing code...
  useEffect(() => {
      if (!api) return;

    const handleSelect = () => {
        setCurrentSlide(api.selectedScrollSnap());
    };
    api.on("select", handleSelect);
    handleSelect();

    return () => {
        api.off("select", handleSelect);
    }
  }, [api])

  const { toast } = useToast();

  const possibleTasks = useMemo(() => {
    if (!currentPriority) return [];
    const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId && !t.isArchived);
    const now = Date.now();
    const rejectionTimeout = REJECTION_HOURS * 60 * 60 * 1000;

    // Strictly filter by selected priority only
    let filtered: Task[] = uncompletedTasks.filter(task => {
      const isPriorityMatch = task.priority === currentPriority;
      const recentlyRejected = task.lastRejectedAt && (now - task.lastRejectedAt < rejectionTimeout);
      return isPriorityMatch && !recentlyRejected;
    });

    // Sort by priority (Critical > High > Medium > Low), then by rejectionCount, then by duration
    const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    filtered.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.rejectionCount !== b.rejectionCount) {
            return (a.rejectionCount || 0) - (b.rejectionCount || 0);
        }
        return a.duration - b.duration;
    });

    return filtered;
  }, [tasks, currentPriority]);

  // Helper function to get available task count for each priority (consistent with possibleTasks filtering)
  const getAvailableTaskCount = useMemo(() => {
    const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId && !t.isArchived);
    const now = Date.now();
    const rejectionTimeout = REJECTION_HOURS * 60 * 60 * 1000;
    
    return (priority: Priority) => {
      return uncompletedTasks.filter(task => {
        const isPriorityMatch = task.priority === priority;
        const recentlyRejected = task.lastRejectedAt && (now - task.lastRejectedAt < rejectionTimeout);
        return isPriorityMatch && !recentlyRejected;
      }).length;
    };
  }, [tasks]);

  // Reset carousel slide when possibleTasks change
  // Reset carousel slide when possibleTasks length or current priority changes.
  // Previously we only reset when the length changed; if two priorities have the same
  // number of tasks switching priorities would keep the old index. Ensure we always
  // reset to the first card and instruct the carousel API to scroll to index 0.
  useEffect(() => {
    setCurrentSlide(0);
    if (api && possibleTasks.length > 0) {
      // allow a short tick for re-render before asking the embla API to scroll
      setTimeout(() => {
        try { api.scrollTo(0); } catch (e) { /* ignore if api not ready */ }
      }, 60);
    }
  }, [currentPriority, possibleTasks.length, api]);


  const otherVisibleTasks = useMemo(() => {
      const allUncompleted = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId && !t.isArchived);
      const possibleIds = new Set(possibleTasks.map(t => t.id));
      return allUncompleted.filter(t => !possibleIds.has(t.id));
  }, [tasks, possibleTasks])


  const currentTask = possibleTasks[currentSlide];

  const handleAccept = async () => {
    if (!currentTask) return;
    setIsAccepting(true);
    await acceptTask(currentTask.id, {
      onComplete: () => handleTaskCompletion(null) // No button ref in this context, but still play sound
    });
    await deleteNotification(currentTask.id);
    setIsAccepting(false);
    setShowAffirmation(true);
    setTimeout(() => {
      setShowAffirmation(false);
    }, 2000);
  };

  const handleReject = async () => {
    if (!currentTask) return;
    setIsRejecting(true);
    const nextRejectionCount = (currentTask.rejectionCount || 0) + 1;
    if (nextRejectionCount >= MAX_REJECTIONS_BEFORE_PROMPT) {
      setShowRejectionPrompt(true);
    } else {
      await rejectTask(currentTask.id);
    }
     setIsRejecting(false);
  };
  
  const handleMute = async () => {
    if (!currentTask) return;
    setIsMuting(true);
    await muteTask(currentTask.id);
    await deleteNotification(currentTask.id);
    setShowRejectionPrompt(false);
    toast({
        title: "Task Muted",
        description: "We won't suggest this task again for a while.",
    });
    setIsMuting(false);
  };
  
  const handleSkipFromDialog = async () => {
     if (!currentTask) return;
     setIsRejecting(true);
     await rejectTask(currentTask.id);
     setShowRejectionPrompt(false);
     setIsRejecting(false);
  }

  const handleRewordClick = () => {
    if (!currentTask) return;
    startTransition(async () => {
      try {
        const result = await rewordTask({
          title: currentTask.title,
          description: currentTask.description || "",
        });
        setRewordedSuggestions(result.suggestedTasks);
        setSelectedRewordedTasks(result.suggestedTasks.reduce((acc, task) => {
          acc[task.title] = true;
          return acc;
        }, {} as Record<string, boolean>));
        setShowRewordDialog(true);
      } catch (error) {
        console.error("Failed to reword task:", error);
        toast({
          title: "AI Error",
          description: "Could not get a suggestion. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handleAcceptReword = async () => {
    if (!currentTask || rewordedSuggestions.length === 0) return;

    const tasksToAdd = rewordedSuggestions.filter(suggestion => selectedRewordedTasks[suggestion.title]);

     if(tasksToAdd.length === 0) {
        toast({
            title: "No tasks selected",
            description: "Please select at least one task to add.",
            variant: "destructive"
        });
        return;
    }
    
    setIsAcceptingReword(true);
    const addPromises = tasksToAdd.map(s => {
        return addTask({
            parentId: currentTask.id,
            title: s.title,
            description: s.description,
            category: currentTask.category,
            priority: 'Low',
            duration: 15,
            userEmail: user?.email || '', // Add missing userEmail
        });
    });

    await Promise.all(addPromises);
    setIsAcceptingReword(false);
    
    toast({
      title: `${tasksToAdd.length} New Sub-task(s) Added!`,
      description: `The selected tasks are now under "${currentTask.title}".`,
    });

    setShowRewordDialog(false);
    setRewordedSuggestions([]);
    setSelectedRewordedTasks({});
  };

  const handleToggleRewordSelection = (title: string) => {
    setSelectedRewordedTasks(prev => ({...prev, [title]: !prev[title]}));
  };

  if (tasksLoading || !currentPriority) {
    return <Card className="w-full max-w-lg mx-auto animate-pulse"><div className="h-80" /></Card>;
  }
  
  if (showAffirmation) {
    return (
      <Card className="w-full max-w-lg mx-auto transition-all duration-300">
        <CardContent className="p-6 text-center flex flex-col items-center justify-center h-80">
            <Sparkles className="w-16 h-16 text-accent animate-pulse" />
            <p className="mt-4 text-2xl font-semibold">{getRandomQuote()}</p>
        </CardContent>
      </Card>
    );
  }
  
  const allUncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId && !t.isArchived);

  if (allUncompletedTasks.length === 0) {
    return (
        <div className="w-full max-w-lg mx-auto">
          <Card >
             <CardContent className="p-6 text-center flex flex-col items-center justify-center h-80">
                <Check className="w-16 h-16 text-green-500" />
                <p className="mt-4 text-xl font-semibold">All clear!</p>
                <p className="text-muted-foreground mt-2">There are no pending tasks. Enjoy your break or add a new one.</p>
                <div className="mt-6">
                    <AddTaskButton />
                </div>
            </CardContent>
          </Card>
        </div>
    )
  }

  if (possibleTasks.length === 0) {
    return (
      <div className="w-full space-y-4">
        {/* Consistent Priority Selector - Same design as when tasks are present */}
        <motion.div 
          variants={slideInFromTopVariant}
          initial="initial"
          animate="animate"
          className="flex justify-between items-center px-2 mb-4"
        >
          <div className="flex gap-1 bg-muted/30 rounded-lg p-1 shadow-sm border min-w-fit overflow-x-auto scrollbar-thin">
            {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((priority) => {
              const count = getAvailableTaskCount(priority);
              const isActive = currentPriority === priority;
              return (
                <Button
                  key={priority}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentPriority(priority)}
                  className={cn(
                    "h-7 px-1.5 md:px-2 text-xs font-medium transition-all duration-200 min-w-0 flex-shrink-0",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    !isActive && "hover:bg-background/50",
                    count === 0 && "opacity-50"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full mr-1 flex-shrink-0",
                    priority === 'Critical' && "bg-red-500",
                    priority === 'High' && "bg-orange-500", 
                    priority === 'Medium' && "bg-yellow-500",
                    priority === 'Low' && "bg-green-500"
                  )} />
                  <span className="truncate hidden sm:inline">{priority}</span>
                  <span className="truncate sm:hidden">{priority.charAt(0)}</span>
                  {count > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="ml-1 h-3 min-w-3 text-xs px-1 bg-background/20"
                    >
                      {count}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
          
          {/* Keyboard shortcuts help button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyboardHelp(true)}
                  className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
                >
                  <Keyboard className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyboard shortcuts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
        
        {/* No tasks message card */}
        <div className="w-full max-w-lg mx-auto">
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center h-80">
              <div className="flex flex-col items-center w-full">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No {currentPriority.toLowerCase()} priority tasks</h3>
                <p className="text-muted-foreground text-center">You're all caught up with {currentPriority.toLowerCase()} priority tasks! Try selecting a different priority level above.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Enhanced subtask display with completion tracking
  const subtasksOfSuggested = currentTask ? tasks.filter(t => t.parentId === currentTask.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) : [];
  const pendingSubtasks = subtasksOfSuggested.filter(t => !t.completedAt);
  const completedSubtasks = subtasksOfSuggested.filter(t => t.completedAt);
  const hasPendingSubtasks = pendingSubtasks.length > 0;
  const subtaskProgress = subtasksOfSuggested.length > 0 
    ? Math.round((completedSubtasks.length / subtasksOfSuggested.length) * 100) 
    : 0;

  return (
    <div className="w-full space-y-4">
      {/* Mobile-Friendly Priority Selector */}
      <motion.div 
        variants={slideInFromTopVariant}
        initial="initial"
        animate="animate"
        className="flex justify-between items-center px-2 mb-4"
      >
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1 shadow-sm border min-w-fit overflow-x-auto scrollbar-thin">
          {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((priority) => {
            const count = getAvailableTaskCount(priority);
            const isActive = currentPriority === priority;
            return (
              <Button
                key={priority}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrentPriority(priority)}
                className={cn(
                  "h-7 px-1.5 md:px-2 text-xs font-medium transition-all duration-200 min-w-0 flex-shrink-0",
                  isActive && "bg-primary text-primary-foreground shadow-sm",
                  !isActive && "hover:bg-background/50",
                  count === 0 && "opacity-50 cursor-not-allowed"
                )}
                disabled={count === 0}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full mr-1 flex-shrink-0",
                  priority === 'Critical' && "bg-red-500",
                  priority === 'High' && "bg-orange-500", 
                  priority === 'Medium' && "bg-yellow-500",
                  priority === 'Low' && "bg-green-500"
                )} />
                <span className="truncate hidden sm:inline">{priority}</span>
                <span className="truncate sm:hidden">{priority.charAt(0)}</span>
                {count > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1 h-3 min-w-3 text-xs px-1 bg-background/20"
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
        
        {/* Keyboard shortcuts help button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKeyboardHelp(true)}
                className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
              >
                <Keyboard className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Keyboard shortcuts</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </motion.div>

      {/* Modern Carousel with Fixed Navigation */}
      <div className="relative group">
        <Carousel 
          setApi={setApi} 
          className="w-full" 
          opts={{ 
            // never loop so we can control priority shifting
            loop: false,
            align: "start",
            skipSnaps: false,
            dragFree: false,
            containScroll: "trimSnaps"
          }}
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {possibleTasks.map((task, index) => (
              <CarouselItem key={task.id} className="pl-2 md:pl-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ 
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 260,
                    damping: 20
                  }}
                  className="h-full"
                >
                  <motion.div className="p-3 transition-all duration-200 origin-center hover:scale-[1.02]">
                    <Card className={cn(
                      "h-full flex flex-col shadow-lg border transition-all duration-300 overflow-visible",
                      "bg-gradient-to-br from-card via-card/98 to-muted/20",
                      "hover:shadow-xl hover:shadow-primary/5",
                      "border-border/50 hover:border-primary/30 group/card"
                    )}>
                    {/* Compact Header */}
                    <CardHeader className="pb-3 space-y-2 flex-shrink-0">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-primary" />
                          </div>
                          <CardDescription className="text-sm font-medium text-primary">
                            Task {index + 1} of {possibleTasks.length}
                          </CardDescription>
                        </div>
                        
                        <ItemActionsDropdown
                          item={task}
                          itemType="task"
                          onShare={() => setShareDialog({isOpen: true, task})}
                          onEdit={() => startEditingTask(task.id)}
                          onDelete={() => deleteTask(task.id)}
                          showExternalLink={true}
                          size="sm"
                        />
                      </div>

                      {/* Task Title */}
                      {(() => {
                        const urlRegex = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[\-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[\-a-z\d_]*)?$/i;
                        if (urlRegex.test(task.title)) {
                          const url = task.title.startsWith('http') ? task.title : `https://${task.title}`;
                          return (
                            <CardTitle className="text-lg sm:text-xl leading-tight break-words line-clamp-2">
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="underline text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              >
                                {task.title}
                              </a>
                            </CardTitle>
                          );
                        }
                        return (
                          <CardTitle className="text-lg sm:text-xl leading-tight break-words line-clamp-2">
                            {task.title}
                          </CardTitle>
                        );
                      })()}
                      
                      {task.description && (
                        <CardDescription className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                          {task.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    {/* Content - Flexible Space */}
                    <CardContent className="flex-1 pb-3 flex flex-col justify-between min-h-0">
                      <div className="space-y-4">
                        {/* Compact Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {isTaskOverdue(task.reminderAt) && (
                            <Badge variant="destructive" className="text-xs px-2 py-0.5 animate-pulse">
                              🚨 Overdue
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs px-2 py-0.5">
                            {task.category}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs px-2 py-0.5 font-medium",
                              task.priority === 'Critical' && "border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20",
                              task.priority === 'High' && "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/20",
                              task.priority === 'Medium' && "border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20",
                              task.priority === 'Low' && "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20"
                            )}
                          >
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs px-2 py-0.5">
                            <Clock className="w-3 h-3 mr-1" />
                            {task.duration}m
                          </Badge>
                          {task.reminderAt && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3 mr-1" />
                              {safeDateFormat(task.reminderAt, "MMM d, h:mm a", "Invalid date")}
                            </Badge>
                          )}
                          {task.rejectionCount > 0 && (
                            <Badge variant="destructive" className="text-xs px-2 py-0.5 animate-pulse">
                              {task.rejectionCount}x Skipped
                            </Badge>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleRewordClick} 
                            disabled={isPending || isAccepting || isRejecting}
                            className="h-8 px-3 text-xs hover:bg-primary/5"
                          >
                            {isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Wand2 className="h-3 w-3 mr-1" />
                            )}
                            Break Down
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => startEditingTask(task.id)} 
                            disabled={isPending || isAccepting || isRejecting}
                            className="h-8 px-3 text-xs hover:bg-accent/5"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            asChild
                            className="h-8 px-3 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/20"
                          >
                            <Link href={`/task/${task.id}`}>
                              <ExternalLink className="h-3 w-3 mr-1"/>
                              View
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>

                    {/* Footer - Fixed Height for Consistency */}
                    <div className="mt-auto">
                      <CardFooter className="p-4 pt-0">
                        <div className="w-full space-y-3">
                          {/* Main Action Buttons */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleReject} 
                              className="sm:col-span-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20 h-9" 
                              disabled={isRejecting || isAccepting}
                            >
                              {isRejecting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <X className="mr-2 h-4 w-4" />
                              )} 
                              Not Now
                            </Button>
                            
                            {hasPendingSubtasks ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="sm:col-span-2">
                                      <Button 
                                        size="sm" 
                                        className="w-full h-9 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white opacity-50 cursor-not-allowed" 
                                        disabled
                                      >
                                        <Check className="mr-2 h-4 w-4" /> 
                                        Complete Subtasks First
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Complete {pendingSubtasks.length} remaining subtasks first</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Button 
                                size="sm" 
                                className="sm:col-span-2 h-9 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:scale-105 transition-all duration-200" 
                                onClick={handleAccept} 
                                disabled={isAccepting || isRejecting}
                              >
                                {isAccepting ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="mr-2 h-4 w-4" />
                                )} 
                                Let's Do It!
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardFooter>
                    </div>
                  </Card>
                  </motion.div>
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
          
          {/* Enhanced Navigation - Improved Mobile */}
          {possibleTasks.length > 1 && (
            <>
              <CarouselPrevious className={cn(
                "absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-10",
                "h-8 w-8 sm:h-10 sm:w-10 border-2 border-primary/20 bg-background/95 backdrop-blur-sm",
                "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                "shadow-lg hover:shadow-xl transition-all duration-200",
                "hover:scale-110 active:scale-95 touch-manipulation",
                "opacity-70 group-hover:opacity-100"
              )} />
              {/* Custom Next button: handle shifting priority when at end */}
              <button
                onClick={() => handleNext()}
                aria-label="Next"
                className={cn(
                  "absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-10",
                  "h-8 w-8 sm:h-10 sm:w-10 border-2 border-primary/20 bg-background/95 backdrop-blur-sm",
                  "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                  "shadow-lg hover:shadow-xl transition-all duration-200",
                  "hover:scale-110 active:scale-95 touch-manipulation",
                  "opacity-70 group-hover:opacity-100",
                  "rounded-full flex items-center justify-center"
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </Carousel>
        
        {/* Improved Slide Indicators */}
        {possibleTasks.length > 1 && (
          <div className="flex justify-center mt-3 gap-1.5">
            {possibleTasks.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "transition-all duration-200 rounded-full",
                  index === currentSlide 
                    ? "bg-primary w-6 h-2" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2 h-2"
                )}
                onClick={() => api?.scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Separate Subtasks Card - Shows for current task only */}
      {currentTask && subtasksOfSuggested.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4"
        >
          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                <CardTitle className="text-base font-medium">
                  Subtasks for "{currentTask.title}"
                </CardTitle>
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {subtasksOfSuggested.length}
                </Badge>
                {hasPendingSubtasks && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 border-orange-200 text-orange-600 bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-950/20">
                    {pendingSubtasks.length} pending
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <SubtaskList parentTask={currentTask} subtasks={subtasksOfSuggested} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    

    {/* {otherVisibleTasks && otherVisibleTasks.length > 0 && <OtherTasksList tasks={otherVisibleTasks} />} */}
    
    <AlertDialog open={showRejectionPrompt} onOpenChange={setShowRejectionPrompt}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-accent" />Is this task working?</AlertDialogTitle>
            <AlertDialogDescription>
                You've skipped this task a few times. Maybe it needs to be smaller, clearer, or just saved for later. What would you like to do?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleSkipFromDialog} disabled={isMuting || isRejecting}>
                  {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Just Skip for Now
                </Button>
                <Button variant="destructive" onClick={handleMute} disabled={isMuting || isRejecting}>
                  {isMuting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Don't Ask Again
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={showRewordDialog} onOpenChange={setShowRewordDialog}>
        <AlertDialogContent className="max-w-xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><Wand2 className="text-primary"/>Here's a breakdown</AlertDialogTitle>
                <AlertDialogDescription className="break-word">
                   Select which steps you'd like to add as new sub-tasks.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-3 max-h-64 overflow-y-auto pr-2">
                {rewordedSuggestions.map((suggestion, index) => (
                   <div key={index} className="flex items-start gap-3 rounded-md border p-3">
                     <Checkbox 
                       id={`reword-task-${index}`} 
                       checked={!!selectedRewordedTasks[suggestion.title]}
                       onCheckedChange={() => handleToggleRewordSelection(suggestion.title)}
                       className="mt-1"
                     />
                     <Label htmlFor={`reword-task-${index}`} className="flex-1 cursor-pointer">
                        <p className="font-semibold break-word">{suggestion.title}</p>
                        <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                     </Label>
                   </div>
                ))}
            </div>
            <AlertDialogFooter>
                <Button variant="ghost" onClick={() => setShowRewordDialog(false)}>Cancel</Button>
                <Button onClick={handleAcceptReword} disabled={isAcceptingReword}>
                    {isAcceptingReword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Selected Tasks
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    {/* Share Dialog */}
    {shareDialog.task && (
      <ShareDialog
        isOpen={shareDialog.isOpen}
        onClose={() => setShareDialog({isOpen: false, task: null})}
        itemType="task"
        itemTitle={shareDialog.task.title}
        itemId={shareDialog.task.id}
      />
    )}
    
    {/* Keyboard Shortcuts Help Dialog */}
    <AlertDialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </AlertDialogTitle>
          <AlertDialogDescription>
            Use these shortcuts to navigate tasks quickly
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd>
              <span>Accept task</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs">X</kbd>
              <span>Reject task</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs">←</kbd>
              <span>Previous task</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs">→</kbd>
              <span>Next task</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs">E</kbd>
              <span>Edit task</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-muted rounded text-xs">B</kbd>
              <span>Break down</span>
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <Button onClick={() => setShowKeyboardHelp(false)}>Got it</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  );
}


function OtherTasksList({ tasks }: { tasks: Task[] }) {
    if (!tasks || tasks.length === 0) return null;

    return (
        <Accordion type="single" collapsible className="w-full mt-6">
            <AccordionItem value="other-tasks">
                <AccordionTrigger>
                    <div className="flex items-center gap-2 text-muted-foreground">
                       See other tasks ({tasks.length})
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-3">
                        {tasks.map(task => (
                            <TaskItem key={task.id} task={task} />
                        ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}

    
