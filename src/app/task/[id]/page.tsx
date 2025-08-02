"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, isPast } from 'date-fns';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';
import { useCompletionAudio } from '@/hooks/use-completion-audio';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertCircle, 
  ArrowLeft, 
  CalendarIcon, 
  Check, 
  Edit, 
  Loader2, 
  Repeat, 
  RotateCcw, 
  Trash2,
  Clock,
  User,
  Share2,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Eye,
  FileText,
  Target,
  Timer,
  Zap
} from 'lucide-react';
import { SubtaskList } from '@/components/subtask-list';
import { ShareDialog } from '@/components/share-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { safeDate, safeDateFormat } from '@/lib/utils';
import type { Task } from '@/lib/types';

function TaskPageSkeleton() {
    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
                {/* Header skeleton */}
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-20" />
                    <div className="flex-1">
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>

                {/* Main content skeleton */}
                <div className="space-y-6">
                    <Card className="border-2">
                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <Skeleton className="h-8 w-3/4 mb-3" />
                                    <Skeleton className="h-5 w-full mb-2" />
                                    <Skeleton className="h-5 w-2/3" />
                                </div>
                                <Skeleton className="h-10 w-20" />
                            </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                            <div className="flex flex-wrap gap-2 mb-6">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Skeleton key={i} className="h-6 w-20 rounded-full" />
                                ))}
                            </div>
                            
                            <div className="bg-muted/30 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Subtasks skeleton */}
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} className="border rounded-lg p-4">
                                        <Skeleton className="h-5 w-2/3 mb-2" />
                                        <Skeleton className="h-4 w-full" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default function TaskPage() {
    const { id } = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { tasks, isLoading, startEditingTask, deleteTask, acceptTask, uncompleteTask } = useTasks();
    const { deleteNotification } = useNotifications();
    const { handleTaskCompletion } = useCompletionAudio();
    
    const [isCompleting, setIsCompleting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showSubtasks, setShowSubtasks] = useState(true);
    const [shareDialog, setShareDialog] = useState<{ isOpen: boolean, itemType: 'task' | 'note', itemTitle: string, itemId: string } | null>(null);
    const completeButtonRef = useRef<HTMLButtonElement>(null);
    
    const taskId = Array.isArray(id) ? id[0] : id;
    const task = tasks.find(t => t.id === taskId);
    const subtasks = tasks.filter(t => t.parentId === taskId);
    const pendingSubtasks = subtasks.filter(t => !t.completedAt);
    const completedSubtasks = subtasks.filter(t => t.completedAt);
    const hasPendingSubtasks = pendingSubtasks.length > 0;

    // Enhanced task analysis
    const taskAnalysis = useMemo(() => {
        if (!task) return null;
        
        const isOverdue = !task.completedAt && task.reminderAt && (() => {
            const reminderDate = safeDate(task.reminderAt);
            if (!reminderDate) return false;
            try {
                return isPast(reminderDate);
            } catch (error) {
                console.error('Error checking if task is overdue:', error);
                return false;
            }
        })();

        const getStatus = () => {
            if (task.completedAt) return { 
                text: "Completed", 
                color: "bg-green-500", 
                variant: "secondary" as const,
                icon: Check
            };
            if (isOverdue) return { 
                text: "Overdue", 
                color: "bg-red-500", 
                variant: "destructive" as const,
                icon: AlertCircle
            };
            return { 
                text: "Pending", 
                color: "bg-blue-500", 
                variant: "default" as const,
                icon: Timer
            };
        };

        const estimatedProgress = subtasks.length > 0 
            ? Math.round((completedSubtasks.length / subtasks.length) * 100)
            : task.completedAt ? 100 : 0;

        return {
            status: getStatus(),
            isOverdue,
            estimatedProgress,
            totalSubtasks: subtasks.length,
            completedSubtasks: completedSubtasks.length,
            pendingSubtasks: pendingSubtasks.length
        };
    }, [task, subtasks, completedSubtasks, pendingSubtasks]);

    if (isLoading) {
        return <TaskPageSkeleton />;
    }

    if (!task) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                            <div>
                                <h2 className="text-lg font-semibold">Task Not Found</h2>
                                <p className="text-muted-foreground mt-2">
                                    The task you are looking for does not exist or has been deleted.
                                </p>
                            </div>
                            <Button onClick={() => router.push('/pending')}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Tasks
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteTask(task.id);
            await deleteNotification(task.id);
            toast({
                title: "Task deleted",
                description: "The task has been deleted successfully"
            });
            router.push('/pending');
        } catch (error) {
            toast({
                title: "Delete failed",
                description: "Failed to delete the task",
                variant: "destructive"
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleComplete = async () => {
        setIsCompleting(true);
        try {
            await acceptTask(task.id, {
                onComplete: () => handleTaskCompletion(completeButtonRef.current)
            });
            await deleteNotification(task.id);
            toast({
                title: "Task completed!",
                description: task.recurrence && task.recurrence.frequency !== 'none' 
                    ? "Task completed and rescheduled"
                    : "Great job! Task marked as complete"
            });
        } catch (error) {
            toast({
                title: "Complete failed",
                description: "Failed to complete the task",
                variant: "destructive"
            });
        } finally {
            setIsCompleting(false);
        }
    };
    
    const handleRedo = async () => {
        try {
            await uncompleteTask(task.id);
            toast({
                title: "Task reopened",
                description: "The task has been marked as pending"
            });
        } catch (error) {
            toast({
                title: "Redo failed",
                description: "Failed to reopen the task",
                variant: "destructive"
            });
        }
    };

    const handleShare = () => {
        setShareDialog({ isOpen: true, itemType: 'task', itemTitle: task.title, itemId: task.id });
    };

    const StatusIcon = taskAnalysis?.status.icon || Timer;

    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
                {/* Enhanced Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={() => router.back()} className="flex-shrink-0">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                    Task Details
                                </h1>
                                <p className="text-muted-foreground">
                                    Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <Badge 
                                variant={taskAnalysis?.status.variant}
                                className="px-3 py-1"
                            >
                                <StatusIcon className="h-4 w-4 mr-1" />
                                <span className="capitalize">{taskAnalysis?.status.text}</span>
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleShare}
                                className="shrink-0"
                            >
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-6"
                >
                    {/* Main Task Display - Professional Card Design */}
                    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-lg">
                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <CardTitle className="text-2xl font-bold leading-tight break-words mb-2">
                                        {task.title}
                                    </CardTitle>
                                    {task.description && (
                                        <CardDescription className="text-base leading-relaxed">
                                            {task.description}
                                        </CardDescription>
                                    )}
                                </div>
                                <Button 
                                    onClick={() => startEditingTask(task.id)} 
                                    size="sm"
                                    className="flex-shrink-0"
                                >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                            {/* Task Metadata */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="secondary" className="font-medium">
                                    <Target className="h-3 w-3 mr-1" />
                                    {task.category}
                                </Badge>
                                <Badge
                                    variant={
                                        task.priority === 'Critical' ? 'destructive' :
                                        task.priority === 'High' ? 'default' :
                                        task.priority === 'Medium' ? 'outline' : 'secondary'
                                    }
                                    className="font-medium"
                                >
                                    <Zap className="h-3 w-3 mr-1" />
                                    {task.priority} Priority
                                </Badge>
                                <Badge variant="secondary" className="font-medium">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {task.duration} min
                                </Badge>
                                <Badge variant="secondary" className="font-medium">
                                    <Timer className="h-3 w-3 mr-1" />
                                    {task.timeOfDay}
                                </Badge>
                                {task.reminderAt && (
                                    <Badge variant="outline" className="font-medium">
                                        <CalendarIcon className="h-3 w-3 mr-1" />
                                        {safeDateFormat(task.reminderAt, "MMM d, h:mm a", "Invalid date")}
                                    </Badge>
                                )}
                                {task.recurrence && task.recurrence.frequency !== 'none' && (
                                    <Badge variant="outline" className="font-medium">
                                        <Repeat className="h-3 w-3 mr-1" />
                                        {task.recurrence.frequency}
                                    </Badge>
                                )}
                            </div>

                            {/* Progress and Status Info */}
                            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                {subtasks.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className="font-medium">{taskAnalysis?.estimatedProgress}%</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-2">
                                            <div 
                                                className="bg-primary rounded-full h-2 transition-all duration-300"
                                                style={{ width: `${taskAnalysis?.estimatedProgress}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{completedSubtasks.length} of {subtasks.length} subtasks completed</span>
                                            {hasPendingSubtasks && (
                                                <span>{pendingSubtasks.length} remaining</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span>Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
                                    </div>
                                    {task.completedAt && (
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span>Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                {task.completedAt ? (
                                    <Button variant="outline" onClick={handleRedo} className="flex-1">
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Reopen Task
                                    </Button>
                                ) : (
                                    <>
                                        <Button 
                                            variant="destructive" 
                                            onClick={handleDelete} 
                                            disabled={isDeleting}
                                            className="sm:w-auto"
                                        >
                                            {isDeleting ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="mr-2 h-4 w-4" />
                                            )}
                                            Delete
                                        </Button>
                                        
                                        {hasPendingSubtasks ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex-1">
                                                            <Button 
                                                                ref={completeButtonRef}
                                                                onClick={handleComplete}
                                                                disabled={true}
                                                                className="w-full"
                                                            >
                                                                <Check className="mr-2 h-4 w-4" />
                                                                Complete Task
                                                            </Button>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Complete all subtasks first ({pendingSubtasks.length} remaining)</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Button 
                                                ref={completeButtonRef}
                                                onClick={handleComplete}
                                                disabled={isCompleting}
                                                className="flex-1"
                                            >
                                                {isCompleting ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Check className="mr-2 h-4 w-4" />
                                                )}
                                                Complete{task.recurrence && task.recurrence.frequency !== 'none' ? ' & Reschedule' : ''}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Subtasks Section */}
                    {subtasks.length > 0 && (
                        <Card className="border border-muted">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowSubtasks(!showSubtasks)}
                                        className="flex items-center gap-2 font-semibold p-0 h-auto hover:bg-transparent"
                                    >
                                        {showSubtasks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        <span className="text-lg">Subtasks</span>
                                        <Badge variant="outline" className="ml-2">
                                            {subtasks.length}
                                        </Badge>
                                        {pendingSubtasks.length > 0 && (
                                            <Badge variant="secondary" className="ml-1">
                                                {pendingSubtasks.length} pending
                                            </Badge>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>

                            <AnimatePresence>
                                {showSubtasks && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <CardContent className="pt-0">
                                            <SubtaskList 
                                                parentTask={task}
                                                subtasks={subtasks}
                                                isHistoryView={!!task.completedAt}
                                            />
                                        </CardContent>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Card>
                    )}
                </motion.div>
            </div>

            {/* Share Dialog */}
            {shareDialog && (
                <ShareDialog
                    isOpen={shareDialog.isOpen}
                    onClose={() => setShareDialog(null)}
                    itemType={shareDialog.itemType}
                    itemTitle={shareDialog.itemTitle}
                    itemId={shareDialog.itemId}
                />
            )}
        </div>
    );
}


