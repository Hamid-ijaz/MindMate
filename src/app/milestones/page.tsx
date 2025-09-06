"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Gift, 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  Clock,
  MoreHorizontal,
  Edit3,
  Trash2,
  Star,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  TrendingUp,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Milestone, MilestoneType } from '@/lib/types';
import { MilestoneService } from '@/services/milestone-service';
import { MilestoneUtils } from '@/lib/milestone-utils';
import { MilestoneForm } from '@/components/milestone-form';
import { cn } from '@/lib/utils';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export default function MilestonesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [filteredMilestones, setFilteredMilestones] = useState<Milestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MilestoneType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'created' | 'name'>('date');
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  useEffect(() => {
    if (user?.email) {
      loadMilestones();
    }
  }, [user?.email]);

  useEffect(() => {
    filterAndSortMilestones();
  }, [milestones, searchQuery, typeFilter, statusFilter, sortBy]);

  const loadMilestones = async () => {
    if (!user?.email) return;
    
    try {
      setIsLoading(true);
      const userMilestones = await MilestoneService.getUserMilestones(user.email);
      setMilestones(userMilestones);
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

  const filterAndSortMilestones = () => {
    let filtered = [...milestones];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(milestone =>
        milestone.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        milestone.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(milestone => milestone.type === typeFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(milestone => 
        statusFilter === 'active' ? milestone.isActive : !milestone.isActive
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.originalDate - a.originalDate;
        case 'created':
          return b.createdAt - a.createdAt;
        case 'name':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    setFilteredMilestones(filtered);
  };

  const handleCreateMilestone = () => {
    setEditingMilestone(null);
    setIsFormOpen(true);
  };

  const handleEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setIsFormOpen(true);
  };

  const handleDeleteMilestone = async (milestone: Milestone) => {
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

  const handleToggleActive = async (milestone: Milestone) => {
    if (!user?.email) return;

    try {
      await MilestoneService.updateMilestone(user.email, milestone.id, {
        isActive: !milestone.isActive,
      });
      await loadMilestones();
      toast({
        title: milestone.isActive ? 'Notifications disabled' : 'Notifications enabled',
        description: `${milestone.title} notifications ${milestone.isActive ? 'disabled' : 'enabled'}`,
      });
    } catch (error) {
      console.error('Error toggling milestone status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update milestone',
        variant: 'destructive',
      });
    }
  };

  const handleFormSuccess = () => {
    loadMilestones();
    setIsFormOpen(false);
    setEditingMilestone(null);
  };

  const renderMilestoneCard = (milestone: Milestone) => {
    const typeInfo = MilestoneUtils.getMilestoneTypeInfo(milestone.type);
    const timeSince = MilestoneUtils.getTimeSince(milestone);
    const timeUntil = MilestoneUtils.getTimeUntilNext(milestone);

    return (
      <motion.div
        key={milestone.id}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="group"
      >
        <Card className={cn(
          "transition-all hover:shadow-md",
          !milestone.isActive && "opacity-60",
          timeUntil?.isToday && "border-primary shadow-md",
          timeUntil?.isThisWeek && "border-orange-300"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3 flex-1">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${milestone.color || typeInfo.color}15` }}
                >
                  {milestone.icon || typeInfo.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">
                    {milestone.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="secondary" 
                      className="text-xs"
                      style={{ backgroundColor: `${milestone.color || typeInfo.color}15` }}
                    >
                      {typeInfo.label}
                    </Badge>
                    {milestone.isRecurring && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        Recurring
                      </Badge>
                    )}
                    {!milestone.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        <BellOff className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEditMilestone(milestone)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleActive(milestone)}>
                    {milestone.isActive ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Disable Notifications
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Enable Notifications
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleDeleteMilestone(milestone)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {milestone.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {milestone.description}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Original Date:</span>
                <span className="font-medium">
                  {format(new Date(milestone.originalDate), 'MMM dd, yyyy')}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time Since:</span>
                <span className="font-medium">{timeSince.formatted}</span>
              </div>

              {milestone.isRecurring && timeUntil && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Next Anniversary:</span>
                  <span className={cn(
                    "font-medium",
                    timeUntil.isToday && "text-primary",
                    timeUntil.isThisWeek && "text-orange-600"
                  )}>
                    {timeUntil.formatted}
                  </span>
                </div>
              )}

              {milestone.isRecurring && timeUntil && timeUntil.days <= 365 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress to next</span>
                    <span className="font-medium">
                      {Math.max(0, 365 - timeUntil.days)} / 365 days
                    </span>
                  </div>
                  <Progress 
                    value={Math.max(0, ((365 - timeUntil.days) / 365) * 100)} 
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const getStats = () => {
    const total = milestones.length;
    const active = milestones.filter(m => m.isActive).length;
    const recurring = milestones.filter(m => m.isRecurring).length;
    const upcoming = milestones.filter(m => {
      const timeUntil = MilestoneUtils.getTimeUntilNext(m);
      return timeUntil && timeUntil.days <= 30;
    }).length;

    return { total, active, recurring, upcoming };
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="p-6 space-y-6"
      >
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Milestones & Anniversaries
          </h1>
          <p className="text-muted-foreground">
            Track important dates and celebrate special moments
          </p>
        </div>
        <Button onClick={handleCreateMilestone}>
          <Plus className="h-4 w-4 mr-2" />
          Add Milestone
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Milestones</p>
              </div>
              <Gift className="h-8 w-8 text-primary/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <Bell className="h-8 w-8 text-green-600/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.recurring}</p>
                <p className="text-xs text-muted-foreground">Recurring</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search milestones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={(value: MilestoneType | 'all') => setTypeFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.values(['birthday', 'anniversary', 'work_anniversary', 'graduation', 'exam_passed', 'achievement', 'milestone', 'purchase', 'relationship', 'travel', 'custom'] as MilestoneType[]).map((type) => {
                const typeInfo = MilestoneUtils.getMilestoneTypeInfo(type);
                return (
                  <SelectItem key={type} value={type}>
                    {typeInfo.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: 'date' | 'created' | 'name') => setSortBy(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">By Date</SelectItem>
              <SelectItem value="created">By Created</SelectItem>
              <SelectItem value="name">By Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Milestones Grid */}
      {filteredMilestones.length === 0 ? (
        <div className="text-center py-12">
          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {milestones.length === 0 ? 'No milestones yet' : 'No milestones match your filters'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {milestones.length === 0 
              ? 'Start tracking important dates and anniversaries'
              : 'Try adjusting your search or filters'
            }
          </p>
          {milestones.length === 0 && (
            <Button onClick={handleCreateMilestone}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Milestone
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredMilestones.map(renderMilestoneCard)}
          </AnimatePresence>
        </div>
      )}

      {/* Milestone Form Dialog */}
      <MilestoneForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingMilestone(null);
        }}
        milestone={editingMilestone}
        onSuccess={handleFormSuccess}
      />
    </motion.div>
  );
}
