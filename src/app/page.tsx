"use client";

import { TaskSuggestion } from "@/components/task-suggestion";

export default function Home() {
  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-16">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
          What will you accomplish next?
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground md:text-lg">
          Let's find the right task for your current energy and focus.
        </p>
      </div>

      <div className="mt-12">
        <TaskSuggestion />
      </div>
    </div>
  );
}
