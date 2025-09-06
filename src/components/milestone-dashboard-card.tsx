"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Calendar, 
  Plus, 
  MoreHorizontal, 
  Gift, 
  Heart, 
  Trophy,
  Clock,
  Bell,
  ChevronRight,
  Star,
  Settings,
  Edit3,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Milestone } from '@/lib/types';
import { MilestoneService } from '@/services/milestone-service';
import { MilestoneUtils } from '@/lib/milestone-utils';
import { cn } from '@/lib/utils';

interface MilestoneDashboardCardProps {
  onCreateMilestone?: () => void;
  onEditMilestone?: (milestone: Milestone) => void;
  className?: string;
}

export function MilestoneDashboardCard({ 
  onCreateMilestone, 
  onEditMilestone,
  className 
}: MilestoneDashboardCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (user?.email) {
      loadMilestones();
    }
  }, [user?.email]);

  const loadMilestones = async () => {
    if (!user?.email) return;
    
    try {
      setIsLoading(true);
      const upcomingMilestones = await MilestoneService.getUpcomingMilestones(user.email, 6);
      setMilestones(upcomingMilestones);
    } catch (error) {
      console.error('Error loading milestones:', error);
      toast({
        title: 'Error',
        description: 'Failed to load milestones',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMilestone = async (milestone: Milestone, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.email) return;

    try {
      await MilestoneService.deleteMilestone(user.email, milestone.id);
      await loadMilestones();
      toast({
        title: 'Milestone deleted',
        description: `${milestone.title} has been deleted`,
      });
    } catch (error) {
      console.error('Error deleting milestone:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete milestone',
        variant: 'destructive',
      });
    }
  };

  const handleEditMilestone = (milestone: Milestone, e: React.MouseEvent) => {
    e.stopPropagation();
    onEditMilestone?.(milestone);
  };

  const renderMilestoneItem = (milestone: Milestone, index: number) => {
    const typeInfo = MilestoneUtils.getMilestoneTypeInfo(milestone.type);
    const timeSince = MilestoneUtils.getTimeSince(milestone);
    const timeUntil = MilestoneUtils.getTimeUntilNext(milestone);

    return (
      <motion.div
        key={milestone.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="group relative"
      >
        <div 
          className={cn(
            "p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md",
            // Today highlight: keep primary border, subtle primary background in light and darker tint in dark mode
            timeUntil?.isToday ? "border-primary bg-primary/5 dark:bg-primary/10" :
            // This week: warm accent background that adapts to dark mode
            timeUntil?.isThisWeek ? "border-orange-300 bg-orange-50 dark:border-orange-600 dark:bg-orange-900/20" :
            // Default card surface respects theme tokens
            "border-border bg-card"
          )}
          onClick={() => onEditMilestone?.(milestone)}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg" title={typeInfo.label}>
                {milestone.icon || typeInfo.icon}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">
                  {milestone.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {typeInfo.label}
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => handleEditMilestone(milestone, e)}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => handleDeleteMilestone(milestone, e)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Time Since */}
          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{timeSince.formatted} ago</span>
            </div>
            
            {milestone.isRecurring && timeUntil && (
              <div className="flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                <span className={cn(
                  timeUntil.isToday ? "text-primary font-medium" :
                  timeUntil.isThisWeek ? "text-orange-600 font-medium dark:text-orange-300" :
                  "text-muted-foreground"
                )}>
                  Next: {timeUntil.formatted}
                </span>
              </div>
            )}

            {!milestone.isRecurring && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>One-time milestone</span>
              </div>
            )}
          </div>

          {/* Progress for recurring milestones */}
          {milestone.isRecurring && timeUntil && timeUntil.days <= 365 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Until next</span>
                <span className="font-medium">
                  {Math.max(0, 365 - timeUntil.days)} days
                </span>
              </div>
              <Progress 
                value={Math.max(0, ((365 - timeUntil.days) / 365) * 100)} 
                className="h-1.5"
              />
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Milestones</CardTitle>
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleMilestones = isExpanded ? milestones : milestones.slice(0, 3);
  const hasMore = milestones.length > 3;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Milestones & Anniversaries</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {milestones.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {milestones.length}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onCreateMilestone}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {milestones.length === 0 ? (
          <div className="text-center py-6">
            <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Track important dates and anniversaries
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateMilestone}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add First Milestone
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {visibleMilestones.map((milestone, index) => 
                renderMilestoneItem(milestone, index)
              )}
            </AnimatePresence>

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>Show Less</>
                ) : (
                  <>
                    Show {milestones.length - 3} More
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            )}

            {/* Today's milestones highlight */}
      {milestones.some(m => {
              const timeUntil = MilestoneUtils.getTimeUntilNext(m);
              return timeUntil?.isToday;
            }) && (
              <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-4 p-3 bg-gradient-to-r from-primary/10 to-purple-500/10 dark:from-primary/20 dark:to-purple-700/10 rounded-lg border border-primary/20 dark:border-primary/30"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Star className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Special Day Today!
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You have milestone anniversaries today
                </p>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
