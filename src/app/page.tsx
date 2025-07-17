
"use client";

import { TaskSuggestion } from "@/components/task-suggestion";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8 md:py-16 px-4">
        <div className="flex flex-col items-center text-center">
            <Skeleton className="h-12 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="mt-12">
            <Skeleton className="h-80 w-full max-w-lg mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
     return null;
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-16 px-4">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
          What will you accomplish next?
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground md:text-lg">
          Let's find the right task for your current energy and focus.
        </p>
      </div>

      <div className="mt-8 md:mt-12 px-4 md:px-0">
        <TaskSuggestion />
      </div>
    </div>
  );
}
