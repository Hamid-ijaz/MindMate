
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useTasks } from '@/contexts/task-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowLeft, CalendarIcon, Check, Edit, ExternalLink, Loader2, Repeat, RotateCcw, Trash2, Wand2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { SubtaskList } from '@/components/subtask-list';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';
import { useNotifications } from '@/contexts/notification-context';

function TaskPageSkeleton() {
    return (
        <div className="container mx-auto max-w-2xl py-8 md:py-12 px-4">
            <Skeleton className="h-8 w-32 mb-8" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                     <Skeleton className="h-px w-full" />
                     <div className="space-y-3">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-10 w-full" />
                     </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-10" />
                </CardFooter>
            </Card>
        </div>
    )
}

export default function TaskPage() {
    const { id } = useParams();
    const router = useRouter();
    const { tasks, isLoading, startEditingTask, deleteTask, acceptTask, uncompleteTask } = useTasks();
    const { deleteNotification } = useNotifications();
    const [isCompleting, setIsCompleting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const taskId = Array.isArray(id) ? id[0] : id;
    const task = tasks.find(t => t.id === taskId);
    const subtasks = tasks.filter(t => t.parentId === taskId);
    const pendingSubtasks = subtasks.filter(t => !t.completedAt);
    const hasPendingSubtasks = pendingSubtasks.length > 0;

    if (isLoading) {
        return <TaskPageSkeleton />;
    }

    if (!task) {
        return (
            <div className="container mx-auto max-w-2xl py-8 md:py-12 px-4 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="mt-4 text-2xl font-bold">Task Not Found</h1>
                <p className="mt-2 text-muted-foreground">The task you are looking for does not exist or has been deleted.</p>
                <Button onClick={() => router.push('/pending')} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Pending Tasks
                </Button>
            </div>
        )
    }

    const isOverdue = !task.completedAt && task.reminderAt && isPast(new Date(task.reminderAt));

    const getStatus = () => {
        if (task.completedAt) return { text: "Completed", color: "bg-green-500" };
        if (isOverdue) return { text: "Overdue", color: "bg-yellow-500" };
        return { text: "Pending", color: "bg-blue-500" };
    }
    const status = getStatus();

    const handleDelete = async () => {
        setIsDeleting(true);
        await deleteTask(task.id);
        await deleteNotification(task.id);
        setIsDeleting(false);
        router.push('/pending');
    }

    const handleComplete = async () => {
        setIsCompleting(true);
        await acceptTask(task.id);
        await deleteNotification(task.id);
        setIsCompleting(false);
        // If it was a recurring task that just got rescheduled, the original is now complete.
        // We can stay on this page to view the completed record.
        // Or we could redirect, for now let's stay.
    }
    
    const handleRedo = async () => {
        await uncompleteTask(task.id);
    }

    const CompleteButton = () => (
        <Button onClick={handleComplete} disabled={isCompleting || hasPendingSubtasks}>
            {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Complete{task.recurrence && task.recurrence.frequency !== 'none' ? ' & Reschedule' : ''}
        </Button>
    );

    return (
        <div className="container mx-auto max-w-2xl py-8 md:py-12 px-4">
            <Button variant="ghost" onClick={() => router.back()} className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-3xl break-word">{task.title}</CardTitle>
                        <div className="flex items-center gap-2">
                             <Badge className={`flex items-center gap-1.5 ${status.color} text-white`}>
                                <span className={`h-2 w-2 rounded-full ${status.color} ring-2 ring-white`}></span>
                                {status.text}
                             </Badge>
                             <Button variant="ghost" size="icon" onClick={() => startEditingTask(task.id)}>
                                <Edit className="h-5 w-5" />
                             </Button>
                        </div>
                    </div>
                    {task.description && (
                        <CardDescription className="pt-2 text-base">{task.description}</CardDescription>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Category</p>
                            <p className="font-semibold">{task.category}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Energy</p>
                            <p className="font-semibold">{task.energyLevel}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Duration</p>
                            <p className="font-semibold">{task.duration} min</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Time of Day</p>
                            <p className="font-semibold">{task.timeOfDay}</p>
                        </div>
                    </div>

                     <div className="grid grid-cols-2 gap-4 text-sm">
                        {task.reminderAt && (
                             <div className="space-y-1">
                                <p className="text-muted-foreground">Reminder</p>
                                <p className="font-semibold flex items-center gap-1.5">
                                    <CalendarIcon className="h-4 w-4" />
                                    {format(new Date(task.reminderAt), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                            </div>
                        )}
                        {task.completedAt && (
                             <div className="space-y-1">
                                <p className="text-muted-foreground">Completed</p>
                                <p className="font-semibold flex items-center gap-1.5">
                                    <Check className="h-4 w-4 text-green-500" />
                                    {format(new Date(task.completedAt), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                            </div>
                        )}
                        {task.recurrence && task.recurrence.frequency !== 'none' && (
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Recurrence</p>
                                <p className="font-semibold flex items-center gap-1.5 capitalize">
                                    <Repeat className="h-4 w-4" />
                                    {task.recurrence.frequency}
                                </p>
                                {task.recurrence.endDate && <p className="text-xs text-muted-foreground">until {format(new Date(task.recurrence.endDate), 'PPP')}</p>}
                            </div>
                        )}
                    </div>

                    {subtasks.length > 0 && (
                        <div>
                            <Separator className="my-4" />
                            <h3 className="text-lg font-semibold mb-2">Sub-tasks ({pendingSubtasks.length} pending)</h3>
                            <SubtaskList parentTask={task} subtasks={subtasks} isHistoryView={!!task.completedAt} />
                        </div>
                    )}
                </CardContent>
                 <CardFooter className="border-t pt-6 flex flex-col sm:flex-row sm:justify-end gap-2">
                    {task.completedAt ? (
                         <Button variant="outline" onClick={handleRedo}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Redo
                        </Button>
                    ) : (
                       <div className="flex w-full sm:w-auto justify-end gap-2">
                         <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete
                        </Button>
                        {hasPendingSubtasks ? (
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={0}><CompleteButton /></span>
                                    </TooltipTrigger>
                                    <TooltipContent>Complete all sub-tasks first</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ) : (
                            <CompleteButton />
                        )}
                       </div>
                    )}
                 </CardFooter>
            </Card>
        </div>
    );
}

// Dummy separator, replace with actual component if you have one
const Separator = ({ className }: { className?: string }) => <div className={`h-px bg-border ${className}`} />;
