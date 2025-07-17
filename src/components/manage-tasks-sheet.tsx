
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

export function AddTaskButton() {
    const { setIsSheetOpen } = useTasks();
    return (
        <Button onClick={() => setIsSheetOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Add Task</span>
          <span className="sm:hidden">Add</span>
        </Button>
    )
}
