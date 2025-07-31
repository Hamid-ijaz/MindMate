
"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useTasks } from "@/contexts/task-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Priority, Task, TimeOfDay } from "@/lib/types";
import { AlertCircle, Check, Sparkles, X, Loader2, Wand2, Edit, CalendarIcon, Repeat, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRandomQuote } from "@/lib/motivational-quotes";
import { MAX_REJECTIONS_BEFORE_PROMPT, REJECTION_HOURS } from "@/lib/constants";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { AddTaskButton } from "./manage-tasks-sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { rewordTask } from '@/ai/flows/reword-task-flow';
import { getCurrentTimeOfDay, getDefaultPriority, cn, safeDateFormat } from "@/lib/utils";
import { TaskItem } from "@/components/task-item";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { PlusCircle } from "lucide-react";
import { SubtaskList } from "./subtask-list";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { format } from "date-fns";
import { useNotifications } from "@/contexts/notification-context";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import Link from "next/link";
import { useCompletionAudio } from '@/hooks/use-completion-audio';
import { ItemActionsDropdown } from '@/components/item-actions-dropdown';
import { ShareDialog } from '@/components/share-dialog';
import { useAuth } from "@/contexts/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { slideInFromTop, carouselSlide, staggerContainer, staggerItem, cardHover } from "@/lib/animations";


export function TaskSuggestion() {
    const { tasks, acceptTask, rejectTask, muteTask, addTask, isLoading: tasksLoading, startEditingTask, deleteTask } = useTasks();
    const { deleteNotification } = useNotifications();
  const { handleTaskCompletion } = useCompletionAudio();
  const { user } = useAuth();
  const [currentPriority, setCurrentPriority] = useState<Priority>('Medium');

  // Set default priority to highest available when tasks change
  useEffect(() => {
    const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId);
    const priorityOrderArr: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
    for (let i = 0; i < priorityOrderArr.length; i++) {
      if (uncompletedTasks.some(task => task.priority === priorityOrderArr[i])) {
        setCurrentPriority(priorityOrderArr[i]);
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

  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const [isPending, startTransition] = useTransition();

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
    const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId);
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

  // Reset carousel slide when possibleTasks change
  useEffect(() => {
    setCurrentSlide(0);
  }, [possibleTasks.length]);

  // Reset carousel slide when possibleTasks change
  useEffect(() => {
    setCurrentSlide(0);
  }, [possibleTasks.length]);


  const otherVisibleTasks = useMemo(() => {
      const allUncompleted = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId);
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
            timeOfDay: currentTask.timeOfDay,
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
  
  const allUncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId);

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
      <div className="w-full max-w-lg mx-auto">
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center h-80">
            <div className="flex justify-between items-center w-full mb-4">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-primary" />
                <span className="text-xl font-semibold">No matching tasks</span>
              </span>
              <Select
                onValueChange={(value: string) => setCurrentPriority(value as Priority)}
                value={currentPriority}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="Priority..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical Priority</SelectItem>
                  <SelectItem value="High">High Priority</SelectItem>
                  <SelectItem value="Medium">Medium Priority</SelectItem>
                  <SelectItem value="Low">Low Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground mt-2 text-center">No tasks match your current priority. Try a different priority or see other available tasks below.</p>
          </CardContent>
        </Card>
        {otherVisibleTasks && otherVisibleTasks.length > 0 && <OtherTasksList tasks={otherVisibleTasks} />}
      </div>
    );
  }

  const subtasksOfSuggested = currentTask ? tasks.filter(t => t.parentId === currentTask.id && !t.completedAt) : [];
  const hasPendingSubtasks = subtasksOfSuggested.length > 0;

  return (
    <div className="w-full space-y-6">
      {/* Modern Priority Selector - Mobile Responsive */}
      <motion.div 
        variants={slideInFromTop}
        initial="initial"
        animate="animate"
        className="flex justify-center px-2"
      >
        <Card className="w-full max-w-4xl p-1 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap lg:grid lg:grid-cols-4 gap-1">
            {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((priority) => {
              const count = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId && t.priority === priority).length;
              return (
                <Button
                  key={priority}
                  variant={currentPriority === priority ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentPriority(priority)}
                  className={cn(
                    "relative h-9 px-2 sm:px-4 min-w-0 flex-1 sm:flex-none transition-all duration-300 text-xs sm:text-sm",
                    currentPriority === priority && "shadow-lg scale-105"
                  )}
                  disabled={count === 0}
                >
                  <span className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      priority === 'Critical' && "bg-red-500",
                      priority === 'High' && "bg-orange-500", 
                      priority === 'Medium' && "bg-yellow-500",
                      priority === 'Low' && "bg-green-500"
                    )} />
                    <span className="truncate">{priority}</span>
                  </span>
                  {count > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="ml-1 sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 text-xs p-0 flex items-center justify-center flex-shrink-0"
                    >
                      {count}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Fixed Height Carousel Container */}
      <div className="relative">
        <Carousel setApi={setApi} className="w-full" opts={{ loop: possibleTasks.length > 1 }}>
          <CarouselContent>
            {possibleTasks.map((task, index) => (
              <CarouselItem key={task.id}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="min-h-[400px]" // Fixed minimum height
                >
                  <Card className="shadow-xl border-2 hover:border-primary/30 transition-all duration-300 h-full">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start pb-3">
                        <CardDescription className="text-lg font-medium text-primary flex items-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          Ready for this one?
                        </CardDescription>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0">
                            {index + 1} of {possibleTasks.length}
                          </Badge>
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
                      </div>

                                {/* Make title clickable if it's a URL */}
                                {(() => {
                                  const urlRegex = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[\-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[\-a-z\d_]*)?$/i;
                                  if (urlRegex.test(task.title)) {
                                    const url = task.title.startsWith('http') ? task.title : `https://${task.title}`;
                                    return (
                                      <CardTitle className="text-2xl pt-2 break-word">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">
                                          {task.title}
                                        </a>
                                      </CardTitle>
                                    );
                                  }
                                  return (
                                    <CardTitle className="text-2xl pt-2 break-word">{task.title}</CardTitle>
                                  );
                                })()}
                                {task.description && <CardDescription className="pt-2">{task.description}</CardDescription>}
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">{task.category}</Badge>
                                    <Badge variant="outline" color={task.priority === 'Critical' ? 'destructive' : task.priority === 'High' ? 'warning' : task.priority === 'Medium' ? 'primary' : 'secondary'}>{task.priority} Priority</Badge>
                                    <Badge variant="outline">{task.duration} min</Badge>
                                    <Badge variant="outline">{task.timeOfDay}</Badge>
                                    {task.rejectionCount > 0 && <Badge variant="destructive" className="animate-pulse">{task.rejectionCount}x Skipped</Badge>}
                                    {task.reminderAt && (
                                        <Badge variant="outline" className="flex items-center gap-1">
                                            <CalendarIcon className="h-3 w-3" />
                                            {safeDateFormat(task.reminderAt, "MMM d, h:mm a", "Invalid date")}
                                        </Badge>
                                    )}
                                    {task.recurrence && task.recurrence.frequency !== 'none' && (
                                        <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                            <Badge variant="outline" className="flex items-center gap-1 cursor-default capitalize">
                                                <Repeat className="h-3 w-3" />
                                                {task.recurrence.frequency}
                                            </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {task.recurrence.endDate ? 
                                                  `Repeats ${task.recurrence.frequency} until ${safeDateFormat(task.recurrence.endDate, "MMM d, yyyy", "Invalid date")}` :
                                                  `Repeats ${task.recurrence.frequency}`
                                                }
                                            </TooltipContent>
                                        </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                                <div className="mt-4 flex justify-center items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={handleRewordClick} disabled={isPending || isAccepting || isRejecting}>
                                        {isPending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="hidden sm:inline">Thinking...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 className="h-4 w-4" />
                                                <span className="hidden sm:inline">Divide task</span>
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => startEditingTask(task.id)} disabled={isPending || isAccepting || isRejecting}>
                                        <Edit className="h-4 w-4" />
                                        <span className="hidden sm:inline">Edit</span>
                                    </Button>
                                     <Button variant="ghost" size="sm" asChild>
                                        <Link href={`/task/${task.id}`}>
                                            <ExternalLink className="h-4 w-4"/>
                                            <span className="hidden sm:inline">View</span>
                                        </Link>
                                     </Button>
                                </div>
                            </CardContent>
                            <CardFooter className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6">
                                <Button variant="destructive" size="lg" onClick={handleReject} className="sm:col-span-1" disabled={isRejecting || isAccepting}>
                                {isRejecting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <X className="mr-2 h-5 w-5" />} Not Now
                                </Button>
                                {hasPendingSubtasks ? (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="sm:col-span-2" tabIndex={0}>
                                                <Button size="lg" className="w-full bg-green-500 hover:bg-green-600 text-white" disabled>
                                                        <Check className="mr-2 h-5 w-5" /> Let's Do It
                                                </Button>
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Complete all sub-tasks first</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : (
                                    <Button size="lg" className="sm:col-span-2 bg-green-500 hover:bg-green-600 text-white" onClick={handleAccept} disabled={isAccepting || isRejecting}>
                                        {isAccepting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />} Let's Do It
                                    </Button>
                                )}
                            </CardFooter>
                            {subtasksOfSuggested.length > 0 && (
                                <CardContent>
                                    <Accordion type="single" collapsible defaultValue="subtasks" className="w-full">
                                    <AccordionItem value="subtasks">
                                        <AccordionTrigger>
                                        <div className="flex items-center gap-2 text-sm">
                                            View Sub-tasks ({subtasksOfSuggested.length})
                                        </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                        <SubtaskList parentTask={task} subtasks={subtasksOfSuggested} />
                                        </AccordionContent>
                                    </AccordionItem>
                                    </Accordion>
                                </CardContent>
                            )}
                            </Card>
                </motion.div>
                    </CarouselItem>
                ))}
            </CarouselContent>
            
            {/* Fixed Position Navigation Buttons - Always centered vertically */}
            {possibleTasks.length > 1 && (
              <>
                <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 border-2 border-primary/20 bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground shadow-lg transition-all duration-200 hover:scale-110" />
                <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-12 w-12 border-2 border-primary/20 bg-background/80 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground shadow-lg transition-all duration-200 hover:scale-110" />
              </>
            )}
        </Carousel>
      </div>
    

    {otherVisibleTasks && otherVisibleTasks.length > 0 && <OtherTasksList tasks={otherVisibleTasks} />}
    
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

    
