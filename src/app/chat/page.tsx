
"use client";

import { useState, useEffect } from 'react';
import { useTasks } from '@/contexts/task-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCurrentTimeOfDay } from '@/lib/utils';
import { TaskItem } from '@/components/task-item';
import { ScrollArea } from '@/components/ui/scroll-area';

function MorningCheckin() {
    const { tasks } = useTasks();

    const morningTasks = tasks.filter(t => !t.completedAt && t.timeOfDay === 'Morning').slice(0, 3);

    return (
        <div className="space-y-6">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                    M
                </div>
                <div className="bg-muted rounded-lg p-4 w-full">
                    <p className="font-semibold">MindMate</p>
                    {morningTasks.length > 0 ? (
                        <p className="text-muted-foreground">
                            Good morning! Here are a few tasks to get your day started. Which one will you tackle first?
                        </p>
                    ) : (
                        <p className="text-muted-foreground">
                            Good morning! You have no tasks scheduled for this morning. Add some tasks to get started.
                        </p>
                    )}
                </div>
            </div>
            {morningTasks.length > 0 && (
                 <ScrollArea className="h-96 pr-4">
                    <div className="space-y-4">
                        {morningTasks.map(task => (
                            <TaskItem key={task.id} task={task} />
                        ))}
                    </div>
                </ScrollArea>
            )}
        </div>
    )
}


function EveningCheckin() {
  const { addAccomplishment, accomplishments } = useTasks();
  const [todayLog, setTodayLog] = useState('');
  const { toast } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const hasLoggedToday = accomplishments.some(a => a.date === today);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (todayLog.trim().length > 0) {
      addAccomplishment(todayLog);
      setTodayLog('');
      toast({
        title: "Accomplishment Saved!",
        description: "Great job today. See you tomorrow!",
      });
    }
  };

   return (
    <div className="space-y-6">
        <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
            M
            </div>
            <div className="bg-muted rounded-lg p-4 w-full">
            <p className="font-semibold">MindMate</p>
            <p className="text-muted-foreground">
                Time for our evening check-in. What did you accomplish today?
            </p>
            </div>
        </div>
        {hasLoggedToday ? (
            <div className="flex items-start gap-4 justify-end">
            <div className="bg-primary text-primary-foreground rounded-lg p-4 max-w-md">
                <p className="font-semibold">You</p>
                <p className="whitespace-pre-wrap">{accomplishments.find(a => a.date === today)?.content}</p>
                <p className="text-xs text-right pt-2 opacity-70">Already logged for today. Great work!</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-accent-foreground shrink-0">
                Y
            </div>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="flex items-start gap-4 justify-end">
            <div className="w-full space-y-2">
                <Textarea
                placeholder="e.g., Finished the report, went for a run, and planned tomorrow's meeting..."
                value={todayLog}
                onChange={(e) => setTodayLog(e.target.value)}
                className="min-h-[100px]"
                />
                    <div className="flex justify-end">
                    <Button type="submit">Log My Wins</Button>
                </div>
            </div>
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-accent-foreground shrink-0">
                Y
            </div>
            </form>
        )}
    </div>
  );
}


export default function ChatPage() {
    const [timeOfDay, setTimeOfDay] = useState<ReturnType<typeof getCurrentTimeOfDay> | null>(null);

    useEffect(() => {
        setTimeOfDay(getCurrentTimeOfDay());
    }, []);

    if (!timeOfDay) {
        return null; // or a loading skeleton
    }

    const isMorning = timeOfDay === 'Morning';

    return (
        <div className="container mx-auto max-w-2xl py-8 md:py-16">
        <Card>
            <CardHeader>
            <CardTitle className="text-2xl">{isMorning ? "Morning Kickstart" : "Daily Check-in"}</CardTitle>
            <CardDescription>
                {format(new Date(), "eeee, MMMM d")}
            </CardDescription>
            </CardHeader>
            <CardContent>
                {isMorning ? <MorningCheckin /> : <EveningCheckin />}
            </CardContent>
        </Card>
        </div>
    );
}
