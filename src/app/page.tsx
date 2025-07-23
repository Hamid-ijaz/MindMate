
import { TaskSuggestion } from "@/components/task-suggestion";
import { Skeleton } from "@/components/ui/skeleton";
import { Metadata } from 'next';
import HomeMain from "@/components/home-main";

export const metadata: Metadata = {
  title: 'Home - MindMate',
  description: 'Find the perfect task for your current energy level and focus.',
};

export default function Home() {
  return <HomeMain />;
}
