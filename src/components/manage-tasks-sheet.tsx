
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

export function AddTaskButton({ isMobile, className, ...props }: AddTaskButtonProps) {
    const { setIsSheetOpen } = useTasks();

    if (isMobile) {
        return (
            <Button 
                onClick={() => setIsSheetOpen(true)}
                className={cn("rounded-full h-14 w-14 shadow-lg", className)}
                data-add-task-trigger
                {...props}
            >
              <PlusCircle className="h-6 w-6" />
              <span className="sr-only">Add Task</span>
            </Button>
        )
    }

    return (
        <Button 
            onClick={() => setIsSheetOpen(true)} 
            className={className} 
            data-add-task-trigger
            {...props}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          <span>Add Task</span>
        </Button>
    )
}
