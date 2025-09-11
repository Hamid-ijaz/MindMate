"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { CalendarIcon, X, Gift, Heart, Trophy, Briefcase, GraduationCap, BookOpen, Target, ShoppingBag, Plane, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Milestone, MilestoneType } from '@/lib/types';
import { MilestoneService } from '@/services/milestone-service';
import { MilestoneUtils } from '@/lib/milestone-utils';
import { cn } from '@/lib/utils';

interface MilestoneFormProps {
  isOpen: boolean;
  onClose: () => void;
  milestone?: Milestone | null;
  onSuccess?: () => void;
}

const milestoneTypes: Array<{
  type: MilestoneType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> = [
  {
    type: 'birthday',
    label: 'Birthday',
    icon: <Gift className="h-4 w-4" />,
    color: '#ff6b6b',
    description: 'Someone\'s birthday or birth date',
  },
  {
    type: 'anniversary',
    label: 'Anniversary',
    icon: <Heart className="h-4 w-4" />,
    color: '#ff69b4',
    description: 'Wedding, relationship anniversaries',
  },
  {
    type: 'work_anniversary',
    label: 'Work Anniversary',
    icon: <Briefcase className="h-4 w-4" />,
    color: '#4dabf7',
    description: 'Job start date, work milestones',
  },
  {
    type: 'graduation',
    label: 'Graduation',
    icon: <GraduationCap className="h-4 w-4" />,
    color: '#51cf66',
    description: 'School, university graduation',
  },
  {
    type: 'exam_passed',
    label: 'Exam Passed',
    icon: <BookOpen className="h-4 w-4" />,
    color: '#fab005',
    description: 'Certification, exam achievements',
  },
  {
    type: 'achievement',
    label: 'Achievement',
    icon: <Trophy className="h-4 w-4" />,
    color: '#fd7e14',
    description: 'Personal accomplishments, awards',
  },
  {
    type: 'milestone',
    label: 'Milestone',
    icon: <Target className="h-4 w-4" />,
    color: '#7c3aed',
    description: 'Important life events, goals reached',
  },
  {
    type: 'purchase',
    label: 'Purchase',
    icon: <ShoppingBag className="h-4 w-4" />,
    color: '#06d6a0',
    description: 'Car, house, or significant purchases',
  },
  {
    type: 'relationship',
    label: 'Relationship',
    icon: <Heart className="h-4 w-4" />,
    color: '#e63946',
    description: 'Met partner, friendship milestones',
  },
  {
    type: 'travel',
    label: 'Travel',
    icon: <Plane className="h-4 w-4" />,
    color: '#14b8a6',
    description: 'First trip, memorable travels',
  },
  {
    type: 'custom',
    label: 'Custom',
    icon: <Star className="h-4 w-4" />,
    color: '#8b5cf6',
    description: 'Any other important date',
  },
];

export function MilestoneForm({ isOpen, onClose, milestone, onSuccess }: MilestoneFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'custom' as MilestoneType,
    originalDate: new Date(),
    isRecurring: false,
    recurringFrequency: 'yearly' as 'yearly' | 'monthly',
    icon: '',
    color: '',
    isActive: true,
    notificationSettings: {
      oneMonthBefore: true,
      oneWeekBefore: true,
      threeDaysBefore: true,
      oneDayBefore: true,
      onTheDay: true,
    },
  });

  // Initialize form with milestone data if editing
  useEffect(() => {
    if (milestone) {
      const milestoneDate = new Date(milestone.originalDate);
      setFormData({
        title: milestone.title,
        description: milestone.description || '',
        type: milestone.type,
        originalDate: milestoneDate,
        isRecurring: milestone.isRecurring,
        recurringFrequency: milestone.recurringFrequency || 'yearly',
        icon: milestone.icon || '',
        color: milestone.color || '',
        isActive: milestone.isActive,
        notificationSettings: milestone.notificationSettings,
      });
      setSelectedDate(milestoneDate);
      setSelectedYear(milestoneDate.getFullYear());
      setSelectedMonth(milestoneDate.getMonth());
    } else {
      // Reset form for new milestone
      const now = new Date();
      const defaultType = milestoneTypes[0];
      setFormData({
        title: '',
        description: '',
        type: 'custom',
        originalDate: now,
        isRecurring: false,
        recurringFrequency: 'yearly',
        icon: '',
        color: '',
        isActive: true,
        notificationSettings: {
          oneMonthBefore: true,
          oneWeekBefore: true,
          threeDaysBefore: true,
          oneDayBefore: true,
          onTheDay: true,
        },
      });
      setSelectedDate(now);
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth());
    }
  }, [milestone, isOpen]);

  const handleTypeChange = (newType: MilestoneType) => {
    const typeInfo = MilestoneUtils.getMilestoneTypeInfo(newType);
    setFormData(prev => ({
      ...prev,
      type: newType,
      isRecurring: typeInfo.defaultRecurring,
      icon: prev.icon || typeInfo.icon,
      color: prev.color || typeInfo.color,
    }));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setFormData(prev => ({ ...prev, originalDate: date }));
      setIsCalendarOpen(false);
    }
  };

  const handleYearChange = (year: string) => {
    const newYear = parseInt(year);
    setSelectedYear(newYear);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setFullYear(newYear);
      setSelectedDate(newDate);
      setFormData(prev => ({ ...prev, originalDate: newDate }));
    }
  };

  const handleMonthChange = (month: string) => {
    const newMonth = parseInt(month);
    setSelectedMonth(newMonth);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newMonth);
      setSelectedDate(newDate);
      setFormData(prev => ({ ...prev, originalDate: newDate }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    if (!formData.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a title for the milestone',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const milestoneData = {
        ...formData,
        originalDate: formData.originalDate.getTime(),
      };

      if (milestone) {
        // Update existing milestone
        await MilestoneService.updateMilestone(user.email, milestone.id, milestoneData);
        toast({
          title: 'Milestone updated',
          description: `${formData.title} has been updated successfully`,
        });
      } else {
        // Create new milestone
        await MilestoneService.createMilestone(user.email, milestoneData);
        toast({
          title: 'Milestone created',
          description: `${formData.title} has been added to your milestones`,
        });
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving milestone:', error);
      toast({
        title: 'Error',
        description: 'Failed to save milestone. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeInfo = milestoneTypes.find(t => t.type === formData.type);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            {milestone ? 'Edit Milestone' : 'Create New Milestone'}
          </DialogTitle>
          <DialogDescription>
            Track important dates and get reminded of anniversaries
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., John's Birthday, Wedding Anniversary"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description or notes about this milestone"
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <Label>Milestone Type</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {milestoneTypes.map((type) => (
                <motion.button
                  key={type.type}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "p-3 text-left border rounded-lg transition-all",
                    formData.type === type.type
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30"
                  )}
                  onClick={() => handleTypeChange(type.type)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {type.icon}
                    <span className="font-medium text-sm">{type.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {type.description}
                  </p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <Label>Original Date *</Label>
            <div className="mt-1 space-y-2">
              {/* Year and Month Selectors */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 100 }, (_, i) => {
                        const year = new Date().getFullYear() - 50 + i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                      ].map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Picker */}
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    month={new Date(selectedYear, selectedMonth)}
                    onMonthChange={(month) => {
                      setSelectedYear(month.getFullYear());
                      setSelectedMonth(month.getMonth());
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Recurring Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Recurring Anniversary</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified every year on this date
                </p>
              </div>
              <Switch
                checked={formData.isRecurring}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, isRecurring: checked }))
                }
              />
            </div>

            {formData.isRecurring && (
              <div>
                <Label>Frequency</Label>
                <Select
                  value={formData.recurringFrequency}
                  onValueChange={(value: 'yearly' | 'monthly') =>
                    setFormData(prev => ({ ...prev, recurringFrequency: value }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Customization */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="icon">Custom Icon (Emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="🎯"
                className="mt-1"
                maxLength={2}
              />
            </div>

            <div>
              <Label htmlFor="color">Custom Color</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="color"
                  type="color"
                  value={formData.color || selectedTypeInfo?.color || '#8b5cf6'}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={formData.color || selectedTypeInfo?.color || '#8b5cf6'}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#8b5cf6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notification Settings - Only show for recurring milestones */}
          {formData.isRecurring && (
            <div className="space-y-3">
              <div>
                <Label>Notification Settings</Label>
                <p className="text-sm text-muted-foreground">
                  Choose when to receive reminder notifications for upcoming anniversaries
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: 'oneMonthBefore', label: '1 Month Before', description: '30 days in advance' },
                  { key: 'oneWeekBefore', label: '1 Week Before', description: '7 days in advance' },
                  { key: 'threeDaysBefore', label: '3 Days Before', description: '3 days in advance' },
                  { key: 'oneDayBefore', label: '1 Day Before', description: 'Day before the anniversary' },
                  { key: 'onTheDay', label: 'On The Day', description: 'On the anniversary date' },
                ].map(({ key, label, description }) => (
                  <div key={key} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={formData.notificationSettings[key as keyof typeof formData.notificationSettings]}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          notificationSettings: {
                            ...prev.notificationSettings,
                            [key]: checked,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-recurring milestone info */}
          {!formData.isRecurring && (
            <div className="p-3 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 inline mr-1" />
                This milestone tracks a one-time event. You'll see how much time has passed since this date on your dashboard.
              </p>
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Active Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Enable notifications for this milestone
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isActive: checked }))
              }
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title.trim()}
          >
            {isSubmitting ? 'Saving...' : milestone ? 'Update Milestone' : 'Create Milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
