
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PlusCircle } from "lucide-react";
import { TaskForm } from "./task-form";
import { useTasks } from "@/contexts/task-context";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { VoiceTaskDialog } from "./voice-task-dialog";
import { useState, useRef } from "react";


export function ManageTasksSheet() {
  const { isSheetOpen, setIsSheetOpen, editingTask, stopEditingTask } = useTasks();

  const handleOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    // If the sheet is closed, ensure we are no longer in editing mode.
    if (!open) {
      stopEditingTask();
    }
  }

  const handleFormFinish = () => {
    setIsSheetOpen(false);
    stopEditingTask();
  };
  
  return (
    <Sheet open={isSheetOpen} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingTask ? "Edit Task" : "Add a New Task"}</SheetTitle>
        </SheetHeader>
        <div className="py-8">
            <TaskForm 
                task={editingTask || undefined} 
                onFinished={handleFormFinish} 
            />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface AddTaskButtonProps extends React.ComponentProps<typeof Button> {
    isMobile?: boolean;
}

export function AddTaskButton({ isMobile, className, onClick, ...props }: AddTaskButtonProps) {
    const { setIsSheetOpen } = useTasks();
    const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isPressedRef = useRef(false);
    const pendingStreamRef = useRef<MediaStream | null>(null);
    const [initialStream, setInitialStream] = useState<MediaStream | null>(null);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only open sheet if it wasn't a long press
        if (!isPressedRef.current) {
            setIsSheetOpen(true);
            onClick?.(e);
        }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isMobile) {
            isPressedRef.current = false;
            pressTimerRef.current = setTimeout(() => {
                isPressedRef.current = true;
                // Open dialog and attach any pending stream
                setInitialStream(pendingStreamRef.current);
                setIsVoiceDialogOpen(true);
                // Add haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, 500); // 500ms long press
        }
    };

    const handleMouseUp = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        // Reset after a short delay to allow click to process
        setTimeout(() => {
            isPressedRef.current = false;
        }, 100);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (isMobile) {
            isPressedRef.current = false;
            // Try to get microphone access immediately as this is a user gesture.
            // Store the stream so the dialog can start recording without being blocked by gesture restrictions.
            (async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    pendingStreamRef.current = stream;
                } catch (err) {
                    // Ignore; dialog will try to request if needed.
                    pendingStreamRef.current = null;
                }
            })();

            pressTimerRef.current = setTimeout(() => {
                isPressedRef.current = true;
                // Open dialog and attach any pending stream
                setInitialStream(pendingStreamRef.current);
                setIsVoiceDialogOpen(true);
                // Add haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, 500); // 500ms long press
        }
    };

    const handleTouchEnd = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
        // Reset after a short delay to allow click to process
        setTimeout(() => {
            isPressedRef.current = false;

            // If we acquired a pending stream but the long-press didn't happen, stop tracks and clear it.
            if (pendingStreamRef.current && !initialStream) {
                try {
                    pendingStreamRef.current.getTracks().forEach((t) => t.stop());
                } catch (e) {
                    // ignore
                }
                pendingStreamRef.current = null;
            }
        }, 100);
    };

    if (isMobile) {
        return (
            <>
                <Button 
                    onClick={handleClick}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className={cn("rounded-full h-14 w-14 shadow-lg", className)}
                    data-add-task-trigger
                    {...props}
                >
                  <PlusCircle className="h-6 w-6" />
                  <span className="sr-only">Add Task (Hold for voice)</span>
                </Button>
                
                <VoiceTaskDialog 
                    isOpen={isVoiceDialogOpen}
                    onClose={() => {
                        setIsVoiceDialogOpen(false);
                        // cleanup any initial stream when dialog closes
                        if (initialStream) {
                            try {
                                initialStream.getTracks().forEach((t) => t.stop());
                            } catch (e) {}
                            setInitialStream(null);
                        }
                        pendingStreamRef.current = null;
                    }}
                    initialStream={initialStream}
                />
            </>
        )
    }

    return (
        <Button 
            onClick={handleClick} 
            className={className} 
            data-add-task-trigger
            {...props}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          <span>Add Task</span>
        </Button>
    )
}
