
"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useTasks } from "@/contexts/task-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EnergyLevel, Task, TimeOfDay } from "@/lib/types";
import { AlertCircle, Check, Sparkles, X, Loader2, Wand2, Edit, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRandomQuote } from "@/lib/motivational-quotes";
import { MAX_REJECTIONS_BEFORE_PROMPT, REJECTION_HOURS } from "@/lib/constants";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { AddTaskButton } from "./manage-tasks-sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { rewordTask } from '@/ai/flows/reword-task-flow';
import { getCurrentTimeOfDay } from "@/lib/utils";
import { TaskItem } from "@/components/task-item";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { PlusCircle } from "lucide-react";
import { SubtaskList } from "./subtask-list";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { format } from "date-fns";
import { useNotifications } from "@/contexts/notification-context";

const getDefaultEnergyLevel = (): EnergyLevel => {
    const timeOfDay = getCurrentTimeOfDay();
    switch (timeOfDay) {
        case "Morning":
        case "Evening":
            return "Low";
        case "Afternoon":
            return "Medium";
        default:
            return "Medium";
    }
};

export function TaskSuggestion() {
  const { tasks, acceptTask, rejectTask, muteTask, addTask, isLoading: tasksLoading, startEditingTask } = useTasks();
  const { deleteNotification } = useNotifications();
  const [currentEnergy, setCurrentEnergy] = useState<EnergyLevel | null>(null);
  const [suggestion, setSuggestion] = useState<{ suggestedTask: Task | null, otherTasks: Task[] }>({ suggestedTask: null, otherTasks: [] });
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [showRejectionPrompt, setShowRejectionPrompt] = useState(false);
  const [showRewordDialog, setShowRewordDialog] = useState(false);
  const [rewordedSuggestions, setRewordedSuggestions] = useState<{ title: string; description: string }[]>([]);
  const [selectedRewordedTasks, setSelectedRewordedTasks] = useState<Record<string, boolean>>({});
  
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isAcceptingReword, setIsAcceptingReword] = useState(false);


  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentEnergy(getDefaultEnergyLevel());
  }, []);

  const { toast } = useToast();

  const getNextTask = (energy: EnergyLevel | null) => {
    if (!energy) {
      setSuggestion({ suggestedTask: null, otherTasks: [] });
      return;
    }

    const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId);

    const now = Date.now();
    const rejectionTimeout = REJECTION_HOURS * 60 * 60 * 1000;

    const possibleTasks = uncompletedTasks.filter(task => {
        const isEnergyMatch = task.energyLevel === energy;
        const recentlyRejected = task.lastRejectedAt && (now - task.lastRejectedAt < rejectionTimeout);
        return isEnergyMatch && !recentlyRejected;
    });

    if (possibleTasks.length === 0) {
        // Fallback: try to find any task if no perfect match
        const fallbackTasks = uncompletedTasks.filter(t => !t.isMuted);
        if (fallbackTasks.length > 0) {
            fallbackTasks.sort((a, b) => (a.rejectionCount || 0) - (b.rejectionCount || 0));
            const bestFallback = fallbackTasks[0];
            const remaining = fallbackTasks.slice(1);
            setSuggestion({ suggestedTask: bestFallback, otherTasks: remaining });
        } else {
             setSuggestion({ suggestedTask: null, otherTasks: [] });
        }
        return;
    }

    possibleTasks.sort((a, b) => {
        if (a.rejectionCount !== b.rejectionCount) {
            return (a.rejectionCount || 0) - (b.rejectionCount || 0);
        }
        return a.duration - b.duration;
    });

    const bestTask = possibleTasks[0];
    const remainingTasks = uncompletedTasks.filter(t => t.id !== bestTask.id);
    
    setSuggestion({ suggestedTask: bestTask, otherTasks: remainingTasks });
  };

  useEffect(() => {
    if (!tasksLoading) {
      getNextTask(currentEnergy);
    }
  }, [tasks, currentEnergy, tasksLoading]);
  
  const handleAccept = async () => {
    if (!suggestion.suggestedTask) return;
    setIsAccepting(true);
    await acceptTask(suggestion.suggestedTask.id);
    await deleteNotification(suggestion.suggestedTask.id);
    setIsAccepting(false);
    setShowAffirmation(true);
    setTimeout(() => {
      setShowAffirmation(false);
    }, 2000);
  };

  const handleReject = async () => {
    if (!suggestion.suggestedTask) return;
    setIsRejecting(true);
    const nextRejectionCount = (suggestion.suggestedTask.rejectionCount || 0) + 1;
    if (nextRejectionCount >= MAX_REJECTIONS_BEFORE_PROMPT) {
      setShowRejectionPrompt(true);
    } else {
      await rejectTask(suggestion.suggestedTask.id);
    }
     setIsRejecting(false);
  };
  
  const handleMute = async () => {
    if (!suggestion.suggestedTask) return;
    setIsMuting(true);
    await muteTask(suggestion.suggestedTask.id);
    await deleteNotification(suggestion.suggestedTask.id);
    setShowRejectionPrompt(false);
    toast({
        title: "Task Muted",
        description: "We won't suggest this task again for a while.",
    });
    setIsMuting(false);
  };
  
  const handleSkipFromDialog = async () => {
     if (!suggestion.suggestedTask) return;
     setIsRejecting(true);
     await rejectTask(suggestion.suggestedTask.id);
     setShowRejectionPrompt(false);
     setIsRejecting(false);
  }

  const handleRewordClick = () => {
    if (!suggestion.suggestedTask) return;
    startTransition(async () => {
      try {
        const result = await rewordTask({
          title: suggestion.suggestedTask!.title,
          description: suggestion.suggestedTask!.description || "",
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
    if (!suggestion.suggestedTask || rewordedSuggestions.length === 0) return;

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
            parentId: suggestion.suggestedTask!.id,
            title: s.title,
            description: s.description,
            category: suggestion.suggestedTask!.category,
            timeOfDay: suggestion.suggestedTask!.timeOfDay,
            energyLevel: 'Low',
            duration: 15,
        });
    });

    await Promise.all(addPromises);
    setIsAcceptingReword(false);
    
    toast({
      title: `${tasksToAdd.length} New Sub-task(s) Added!`,
      description: `The selected tasks are now under "${suggestion.suggestedTask!.title}".`,
    });

    setShowRewordDialog(false);
    setRewordedSuggestions([]);
    setSelectedRewordedTasks({});
  };

  const handleToggleRewordSelection = (title: string) => {
    setSelectedRewordedTasks(prev => ({...prev, [title]: !prev[title]}));
  };

  if (tasksLoading || !currentEnergy) {
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
  
  const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted && !t.parentId);
  const otherVisibleTasks = suggestion.otherTasks.filter(t => !t.completedAt && !t.isMuted && t.id !== suggestion.suggestedTask?.id && !t.parentId);
  const subtasksOfSuggested = suggestion.suggestedTask ? tasks.filter(t => t.parentId === suggestion.suggestedTask!.id && !t.completedAt) : [];
  const hasPendingSubtasks = subtasksOfSuggested.length > 0;

  if (!suggestion.suggestedTask && uncompletedTasks.length === 0) {
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

  if (!suggestion.suggestedTask) {
    return (
        <div className="w-full max-w-lg mx-auto">
             <Card>
                <CardContent className="p-6 text-center flex flex-col items-center justify-center h-80">
                    <AlertCircle className="w-16 h-16 text-primary" />
                    <p className="mt-4 text-xl font-semibold">No matching tasks</p>
                    <p className="text-muted-foreground mt-2">No tasks match your current energy level. Try a different energy level or see other available tasks below.</p>
                     <div className="mt-4">
                        <Select onValueChange={(value: EnergyLevel) => setCurrentEnergy(value)} value={currentEnergy || undefined}>
                            <SelectTrigger className="w-auto">
                                <SelectValue placeholder="Energy..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Low">Low Energy</SelectItem>
                                <SelectItem value="Medium">Medium Energy</SelectItem>
                                <SelectItem value="High">High Energy</SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                </CardContent>
            </Card>
           {otherVisibleTasks && otherVisibleTasks.length > 0 && <OtherTasksList tasks={otherVisibleTasks} />}
        </div>
    )
  }


  return (
    <div className="w-full max-w-lg mx-auto">
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center pb-2">
            <CardDescription className="text-lg font-medium text-primary">Ready for this one?</CardDescription>
            <Select onValueChange={(value: EnergyLevel) => setCurrentEnergy(value)} value={currentEnergy}>
                <SelectTrigger className="w-auto text-xs h-8 px-2">
                    <SelectValue placeholder="Energy..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Low">Low Energy</SelectItem>
                    <SelectItem value="Medium">Medium Energy</SelectItem>
                    <SelectItem value="High">High Energy</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <CardTitle className="text-2xl pt-2 break-words">{suggestion.suggestedTask.title}</CardTitle>
        {suggestion.suggestedTask.description && <CardDescription className="pt-2">{suggestion.suggestedTask.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{suggestion.suggestedTask.category}</Badge>
            <Badge variant="outline">{suggestion.suggestedTask.energyLevel} Energy</Badge>
            <Badge variant="outline">{suggestion.suggestedTask.duration} min</Badge>
            <Badge variant="outline">{suggestion.suggestedTask.timeOfDay}</Badge>
            {suggestion.suggestedTask.rejectionCount > 0 && <Badge variant="destructive" className="animate-pulse">{suggestion.suggestedTask.rejectionCount}x Skipped</Badge>}
            {suggestion.suggestedTask.reminderAt && (
                <Badge variant="outline" className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(suggestion.suggestedTask.reminderAt), "MMM d, h:mm a")}
                </Badge>
            )}
        </div>
        <div className="mt-4 flex justify-center items-center gap-4">
             <Button variant="link" onClick={handleRewordClick} disabled={isPending || isAccepting || isRejecting}>
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Thinking...
                    </>
                ) : (
                    <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Divide task
                    </>
                )}
            </Button>
            <Button variant="link" onClick={() => startEditingTask(suggestion.suggestedTask!.id)} disabled={isPending || isAccepting || isRejecting}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
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
                  <SubtaskList parentTask={suggestion.suggestedTask} subtasks={subtasksOfSuggested} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
      )}
    </Card>

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
                <AlertDialogDescription className="break-words">
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
                        <p className="font-semibold">{suggestion.title}</p>
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
