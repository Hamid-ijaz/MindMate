import { BrainCircuit } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <BrainCircuit className="h-6 w-6 text-primary" suppressHydrationWarning />
      <span className="text-xl font-bold tracking-tight">MindMate</span>
    </div>
  );
}
