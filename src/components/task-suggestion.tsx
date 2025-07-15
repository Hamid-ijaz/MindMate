"use client";

import { useState, useMemo, useEffect } from "react";
import { useTasks } from "@/contexts/task-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnergyLevel, Task } from "@/lib/types";
import { AlertCircle, Check, Sparkles, ThumbsDown, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRandomQuote } from "@/lib/motivational-quotes";
import { MAX_REJECTIONS_BEFORE_PROMPT } from "@/lib/constants";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { ManageTasksSheet } from "./manage-tasks-sheet";

export function TaskSuggestion() {
  const { tasks, getSuggestedTask, acceptTask, rejectTask, muteTask, isLoading } = useTasks();
  const [currentEnergy, setCurrentEnergy] = useState<EnergyLevel | null>(null);
  const [suggestedTask, setSuggestedTask] = useState<Task | null>(null);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [showRejectionPrompt, setShowRejectionPrompt] = useState(false);
  const { toast } = useToast();

  const getNextTask = (energy: EnergyLevel | null) => {
    if (energy) {
      const nextTask = getSuggestedTask(energy);
      setSuggestedTask(nextTask);
    } else {
      setSuggestedTask(null);
    }
  };

  useEffect(() => {
    getNextTask(currentEnergy);
  }, [tasks, currentEnergy]);

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
    }, 1500);
  };

  const handleReject = () => {
    if (!suggestedTask) return;
    rejectTask(suggestedTask.id);
    const nextRejectionCount = (suggestedTask.rejectionCount || 0) + 1;
    if (nextRejectionCount >= MAX_REJECTIONS_BEFORE_PROMPT) {
      setShowRejectionPrompt(true);
    } else {
      getNextTask(currentEnergy);
    }
  };
  
  const handleMute = () => {
    if (!suggestedTask) return;
    muteTask(suggestedTask.id);
    setShowRejectionPrompt(false);
    toast({
        title: "Task Snoozed",
        description: "We won't suggest this task again unless you edit it.",
    });
    getNextTask(currentEnergy);
  };
  
  const handleEditInstead = () => {
     if (!suggestedTask) return;
     rejectTask(suggestedTask.id);
     setShowRejectionPrompt(false);
     // The sheet needs to be triggered externally. This is a limitation.
     // For now, we will just move to the next task.
     toast({
        title: "Edit Task",
        description: "Please open 'Add / Manage Tasks' to edit the task.",
     });
     getNextTask(currentEnergy);
  }

  if (isLoading) {
    return <Card className="w-full max-w-lg mx-auto animate-pulse"><div className="h-80" /></Card>;
  }
  
  if (!currentEnergy) {
    return (
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>How are you feeling?</CardTitle>
          <CardDescription>Select your current energy level to get a task suggestion.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={(value: EnergyLevel) => setCurrentEnergy(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select energy level..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low - Just need a small win</SelectItem>
              <SelectItem value="Medium">Medium - Ready to get things done</SelectItem>
              <SelectItem value="High">High - Let's tackle a big one!</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
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
      <Card className="w-full max-w-lg mx-auto">
         <CardContent className="p-6 text-center flex flex-col items-center justify-center h-80">
            <Check className="w-16 h-16 text-green-500" />
            <p className="mt-4 text-xl font-semibold">All clear!</p>
            <p className="text-muted-foreground mt-2">There are no tasks matching your current state. Enjoy your break or add a new task.</p>
            <div className="mt-6">
                <ManageTasksSheet />
            </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">{suggestedTask.title}</CardTitle>
        {suggestedTask.description && <CardDescription className="pt-2">{suggestedTask.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Badge variant="outline">{suggestedTask.category}</Badge>
        <Badge variant="outline">{suggestedTask.energyLevel} Energy</Badge>
        <Badge variant="outline">{suggestedTask.duration} min</Badge>
        <Badge variant="outline">{suggestedTask.timeOfDay}</Badge>
        {suggestedTask.rejectionCount > 0 && <Badge variant="destructive" className="animate-pulse">{suggestedTask.rejectionCount}x Skipped</Badge>}
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
    <div className="text-center mt-4">
        <Button variant="link" className="text-muted-foreground" onClick={() => setCurrentEnergy(null)}>Change energy level</Button>
    </div>

    <AlertDialog open={showRejectionPrompt} onOpenChange={setShowRejectionPrompt}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-accent" />Is this task working?</AlertDialogTitle>
            <AlertDialogDescription>
                You've skipped this task a few times. Sometimes a task needs to be smaller, clearer, or just saved for later. What would you like to do?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="secondary" onClick={handleEditInstead}>Maybe later, just skip</Button>
                <Button variant="destructive" onClick={handleMute}>Don't Ask Again</Button>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
