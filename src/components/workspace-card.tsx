'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  MoreHorizontal, 
  Users, 
  CheckSquare, 
  Calendar, 
  TrendingUp,
  Settings,
  Archive,
  Edit,
  Copy,
  Star,
  Activity,
  Clock
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WorkspaceCardProps {
  workspace: Workspace;
  isSelected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onDuplicate?: () => void;
  className?: string;
}

export function WorkspaceCard({
  workspace,
  isSelected = false,
  onClick,
  onEdit,
  onArchive,
  onDuplicate,
  className
}: WorkspaceCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const completionRate = workspace.stats.totalTasks > 0 
    ? ((workspace.stats.totalTasks - workspace.stats.activeTasks) / workspace.stats.totalTasks) * 100 
    : 0;

  const getActivityColor = (lastActivity: string) => {
    const now = new Date();
    const activityDate = new Date(lastActivity);
    const diffHours = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) return 'text-green-500';
    if (diffHours < 24) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const formatLastActivity = (lastActivity: string) => {
    const now = new Date();
    const activityDate = new Date(lastActivity);
    const diffMs = now.getTime() - activityDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) return 'Active now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return activityDate.toLocaleDateString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn("cursor-pointer", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
        "border-2 hover:border-primary/20",
        isSelected && "ring-2 ring-primary ring-offset-2 border-primary/50",
        "group"
      )}>
        {/* Header with workspace info and actions */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3 w-3 rounded-full bg-gradient-to-br from-primary to-primary/60 flex-shrink-0" />
                <h3 className="font-semibold text-base truncate text-foreground">
                  {workspace.name}
                </h3>
                {workspace.isFavorite && (
                  <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
                )}
              </div>
              
              {workspace.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {workspace.description}
                </p>
              )}

              {/* Activity indicator */}
              <div className="flex items-center gap-2 text-xs">
                <Activity className={cn("h-3 w-3", getActivityColor(workspace.stats.lastActivity))} />
                <span className={cn("font-medium", getActivityColor(workspace.stats.lastActivity))}>
                  {formatLastActivity(workspace.stats.lastActivity)}
                </span>
              </div>
            </div>

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit workspace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onArchive?.(); }}
                  className="text-destructive"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground">Progress</span>
              <span className="text-xs font-medium text-foreground">
                {Math.round(completionRate)}%
              </span>
            </div>
            <Progress 
              value={completionRate} 
              className="h-2"
            />
          </div>

          {/* Statistics grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <div className="text-sm font-semibold text-foreground">
                {workspace.stats.totalMembers}
              </div>
              <div className="text-xs text-muted-foreground">Members</div>
            </div>

            <div className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <CheckSquare className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <div className="text-sm font-semibold text-foreground">
                {workspace.stats.activeTasks}
              </div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>

            <div className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <div className="text-sm font-semibold text-foreground">
                {workspace.stats.totalTasks - workspace.stats.activeTasks}
              </div>
              <div className="text-xs text-muted-foreground">Done</div>
            </div>
          </div>

          {/* Recent members */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Team</span>
              <div className="flex -space-x-2">
                {workspace.memberIds.slice(0, 3).map((memberId, index) => (
                  <Avatar key={memberId} className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-xs">
                      {memberId.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {workspace.memberIds.length > 3 && (
                  <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                    <span className="text-xs font-medium text-muted-foreground">
                      +{workspace.memberIds.length - 3}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Due tasks indicator */}
            {workspace.stats.overdueTasks > 0 && (
              <Badge variant="destructive" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {workspace.stats.overdueTasks} overdue
              </Badge>
            )}
          </div>
        </CardContent>

        {/* Selection indicator */}
        {isSelected && (
          <motion.div
            layoutId="selectedWorkspace"
            className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none"
            initial={false}
            transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
          />
        )}
      </Card>
    </motion.div>
  );
}