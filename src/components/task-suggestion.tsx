
"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useTasks } from "@/contexts/task-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EnergyLevel, Task, TimeOfDay } from "@/lib/types";
import { AlertCircle, Check, Sparkles, X, Loader2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRandomQuote } from "@/lib/motivational-quotes";
import { MAX_REJECTIONS_BEFORE_PROMPT, REJECTION_HOURS } from "@/lib/constants";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { ManageTasksSheet } from "./manage-tasks-sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { ScrollArea } from "./ui/scroll-area";
import { rewordTask } from "@/ai/flows/reword-task-flow";
import { getCurrentTimeOfDay } from "@/lib/utils";

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
  const { tasks, acceptTask, rejectTask, muteTask, addTask, isLoading: tasksLoading, updateTask } = useTasks();
  const [currentEnergy, setCurrentEnergy] = useState<EnergyLevel | null>(null);
  const [suggestion, setSuggestion] = useState<{ suggestedTask: Task | null, otherTasks: Task[] }>({ suggestedTask: null, otherTasks: [] });
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [showRejectionPrompt, setShowRejectionPrompt] = useState(false);
  const [showRewordDialog, setShowRewordDialog] = useState(false);
  const [rewordedSuggestion, setRewordedSuggestion] = useState<{ title: string; description: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentEnergy(getDefaultEnergyLevel());
  }, []);

  const { toast } = useToast();

  const { suggestedTask, otherTasks } = suggestion;
  
  const getNextTask = (energy: EnergyLevel | null) => {
    if (!energy) {
      setSuggestion({ suggestedTask: null, otherTasks: [] });
      return;
    }

    const uncompletedTasks = tasks.filter(t => !t.completedAt && !t.isMuted);

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
  
  const handleAccept = () => {
    if (!suggestedTask) return;
    acceptTask(suggestedTask.id);
    toast({
      title: "Task Completed!",
      description: getRandomQuote(),
      className: "bg-primary/10 border-primary/20",
    });
    setShowAffirmation(true);
    setTimeout(() => {
      setShowAffirmation(false);
      getNextTask(currentEnergy);
    }, 2000);
  };

  const handleReject = () => {
    if (!suggestedTask) return;
    const nextRejectionCount = (suggestedTask.rejectionCount || 0) + 1;
    if (nextRejectionCount >= MAX_REJECTIONS_BEFORE_PROMPT) {
      setShowRejectionPrompt(true);
    } else {
      rejectTask(suggestedTask.id);
      getNextTask(currentEnergy);
    }
  };
  
  const handleMute = () => {
    if (!suggestedTask) return;
    muteTask(suggestedTask.id);
    setShowRejectionPrompt(false);
    toast({
        title: "Task Muted",
        description: "We won't suggest this task again for a while.",
    });
    getNextTask(currentEnergy);
  };
  
  const handleSkipFromDialog = () => {
     if (!suggestedTask) return;
     rejectTask(suggestedTask.id);
     setShowRejectionPrompt(false);
     getNextTask(currentEnergy);
  }

  const handleRewordClick = () => {
    if (!suggestedTask) return;
    startTransition(async () => {
      try {
        const result = await rewordTask({
          title: suggestedTask.title,
          description: suggestedTask.description || "",
        });
        setRewordedSuggestion(result);
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

  const handleAcceptReword = () => {
    if (!suggestedTask || !rewordedSuggestion) return;
    
    // Add the reworded suggestion as a new task
    addTask({
      title: rewordedSuggestion.title,
      description: rewordedSuggestion.description,
      category: suggestedTask.category, // Inherit category
      timeOfDay: suggestedTask.timeOfDay, // Inherit time of day
      energyLevel: 'Low', // New task is 'Low' energy
      duration: 15, // New task is short
    });
    
    toast({
      title: "New Task Added!",
      description: `"${rewordedSuggestion.title}" is now on your list.`,
    });

    setShowRewordDialog(false);
    setRewordedSuggestion(null);
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

  if (!suggestedTask) {
    return (
        <div className="w-full max-w-lg mx-auto">
          <Card >
             <CardContent className="p-6 text-center flex flex-col items-center justify-center h-80">
                <Check className="w-16 h-16 text-green-500" />
                <p className="mt-4 text-xl font-semibold">All clear!</p>
                <p className="text-muted-foreground mt-2">There are no tasks matching your current state. Enjoy your break or add a new task.</p>
                <div className="mt-6">
                    <ManageTasksSheet />
                </div>
            </CardContent>
          </Card>
           {otherTasks && otherTasks.length > 0 && <OtherTasksList tasks={otherTasks} />}
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

        <CardTitle className="text-2xl pt-2">{suggestedTask.title}</CardTitle>
        {suggestedTask.description && <CardDescription className="pt-2">{suggestedTask.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{suggestedTask.category}</Badge>
            <Badge variant="outline">{suggestedTask.energyLevel} Energy</Badge>
            <Badge variant="outline">{suggestedTask.duration} min</Badge>
            <Badge variant="outline">{suggestedTask.timeOfDay}</Badge>
            {suggestedTask.rejectionCount > 0 && <Badge variant="destructive" className="animate-pulse">{suggestedTask.rejectionCount}x Skipped</Badge>}
        </div>
        {(suggestedTask.energyLevel === 'High' || suggestedTask.energyLevel === 'Medium') && (
            <div className="mt-4 text-center">
                 <Button variant="link" onClick={handleRewordClick} disabled={isPending}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Thinking...
                        </>
                    ) : (
                        <>
                            <Wand2 className="mr-2 h-4 w-4" />
                            Make this task smaller
                        </>
                    )}
                </Button>
            </div>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-3 gap-3 pt-6">
        <Button variant="destructive" size="lg" onClick={handleReject}>
          <X className="mr-2 h-5 w-5" /> Not Now
        </Button>
        <Button size="lg" className="col-span-2 bg-green-500 hover:bg-green-600 text-white" onClick={handleAccept}>
          <Check className="mr-2 h-5 w-5" /> Let's Do It
        </Button>
      </CardFooter>
    </Card>

    {otherTasks && otherTasks.length > 0 && <OtherTasksList tasks={otherTasks} />}
    
    <AlertDialog open={showRejectionPrompt} onOpenChange={setShowRejectionPrompt}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-accent" />Is this task working?</AlertDialogTitle>
            <AlertDialogDescription>
                You've skipped this task a few times. Maybe it needs to be smaller, clearer, or just saved for later. What would you like to do?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleSkipFromDialog}>Just Skip for Now</Button>
                <Button variant="destructive" onClick={handleMute}>Don't Ask Again</Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={showRewordDialog} onOpenChange={setShowRewordDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><Wand2 className="text-primary"/>How about this instead?</AlertDialogTitle>
                {rewordedSuggestion && (
                    <div className="pt-4 space-y-2 text-left">
                        <p className="font-bold text-lg">{rewordedSuggestion.title}</p>
                        <p className="text-muted-foreground">{rewordedSuggestion.description}</p>
                        <p className="text-sm text-blue-500 pt-2">I've also adjusted the duration to 15 minutes.</p>
                    </div>
                )}
            </AlertDialogHeader>
            <AlertDialogFooter>
                <Button variant="ghost" onClick={() => setShowRewordDialog(false)}>No, thanks</Button>
                <Button onClick={handleAcceptReword}>Yes, let's do that</Button>
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
                    <ScrollArea className="h-64 pr-4">
                        <div className="space-y-3">
                            {tasks.map(task => (
                                <Card key={task.id} className="bg-secondary/50">
                                    <CardContent className="p-3">
                                        <p className="font-semibold">{task.title}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Badge variant="secondary">{task.category}</Badge>
                                            <Badge variant="secondary">{task.energyLevel}</Badge>
                                            <Badge variant="secondary">{task.duration}m</Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}
