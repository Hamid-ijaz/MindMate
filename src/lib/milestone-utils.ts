import { addYears, addMonths, format, differenceInDays, differenceInMonths, differenceInYears, isSameDay, isToday } from 'date-fns';
import type { Milestone, MilestoneType } from '@/lib/types';

export class MilestoneUtils {
  /**
   * Calculate the next anniversary date for a recurring milestone
   */
  static getNextAnniversaryDate(milestone: Milestone): Date | null {
    if (!milestone.isRecurring) return null;

    const originalDate = new Date(milestone.originalDate);
    const now = new Date();
    const currentYear = now.getFullYear();
    
    if (milestone.recurringFrequency === 'yearly') {
      // Get this year's anniversary
      const thisYearAnniversary = new Date(currentYear, originalDate.getMonth(), originalDate.getDate());
      
      // If this year's anniversary has passed, return next year's
      if (thisYearAnniversary < now) {
        return new Date(currentYear + 1, originalDate.getMonth(), originalDate.getDate());
      }
      
      return thisYearAnniversary;
    } else if (milestone.recurringFrequency === 'monthly') {
      // For monthly recurring events
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const targetDay = originalDate.getDate();
      
      // Try this month first
      const thisMonthDate = new Date(currentYear, currentMonth, targetDay);
      if (thisMonthDate >= now) {
        return thisMonthDate;
      }
      
      // Otherwise next month
      return new Date(currentYear, currentMonth + 1, targetDay);
    }
    
    return null;
  }

  /**
   * Calculate how much time has passed since the original milestone
   */
  static getTimeSince(milestone: Milestone): {
    years: number;
    months: number;
    days: number;
    totalDays: number;
    formatted: string;
  } {
    const originalDate = new Date(milestone.originalDate);
    const now = new Date();
    
    const years = differenceInYears(now, originalDate);
    const months = differenceInMonths(now, originalDate) % 12;
    const days = differenceInDays(now, new Date(now.getFullYear(), now.getMonth() - months, originalDate.getDate()));
    const totalDays = differenceInDays(now, originalDate);
    
    let formatted = '';
    if (years > 0) {
      formatted += `${years} year${years > 1 ? 's' : ''}`;
      if (months > 0) {
        formatted += `, ${months} month${months > 1 ? 's' : ''}`;
      }
    } else if (months > 0) {
      formatted += `${months} month${months > 1 ? 's' : ''}`;
      if (days > 0) {
        formatted += `, ${days} day${days > 1 ? 's' : ''}`;
      }
    } else {
      formatted = `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
    }
    
    return { years, months, days, totalDays, formatted };
  }

  /**
   * Calculate time until next anniversary (for recurring milestones)
   */
  static getTimeUntilNext(milestone: Milestone): {
    days: number;
    isToday: boolean;
    isThisWeek: boolean;
    isThisMonth: boolean;
    formatted: string;
  } | null {
    const nextDate = this.getNextAnniversaryDate(milestone);
    if (!nextDate) return null;
    
    const now = new Date();
    const days = differenceInDays(nextDate, now);
    const isToday = isSameDay(nextDate, now);
    const isThisWeek = days <= 7 && days >= 0;
    const isThisMonth = days <= 30 && days >= 0;
    
    let formatted = '';
    if (isToday) {
      formatted = 'Today';
    } else if (days === 1) {
      formatted = 'Tomorrow';
    } else if (days > 0) {
      if (days <= 30) {
        formatted = `In ${days} day${days > 1 ? 's' : ''}`;
      } else {
        const months = Math.floor(days / 30);
        const remainingDays = days % 30;
        formatted = `In ${months} month${months > 1 ? 's' : ''}`;
        if (remainingDays > 0) {
          formatted += `, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
        }
      }
    } else {
      formatted = `${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago`;
    }
    
    return { days, isToday, isThisWeek, isThisMonth, formatted };
  }

  /**
   * Get milestone type display information
   */
  static getMilestoneTypeInfo(type: MilestoneType): {
    label: string;
    icon: string;
    color: string;
    defaultRecurring: boolean;
  } {
    const typeMap = {
      birthday: {
        label: 'Birthday',
        icon: '🎂',
        color: '#ff6b6b',
        defaultRecurring: true,
      },
      anniversary: {
        label: 'Anniversary',
        icon: '💖',
        color: '#ff69b4',
        defaultRecurring: true,
      },
      work_anniversary: {
        label: 'Work Anniversary',
        icon: '💼',
        color: '#4dabf7',
        defaultRecurring: true,
      },
      graduation: {
        label: 'Graduation',
        icon: '🎓',
        color: '#51cf66',
        defaultRecurring: false,
      },
      exam_passed: {
        label: 'Exam Passed',
        icon: '📚',
        color: '#fab005',
        defaultRecurring: false,
      },
      achievement: {
        label: 'Achievement',
        icon: '🏆',
        color: '#fd7e14',
        defaultRecurring: false,
      },
      milestone: {
        label: 'Milestone',
        icon: '🎯',
        color: '#7c3aed',
        defaultRecurring: false,
      },
      purchase: {
        label: 'Purchase',
        icon: '🛍️',
        color: '#06d6a0',
        defaultRecurring: false,
      },
      relationship: {
        label: 'Relationship',
        icon: '❤️',
        color: '#e63946',
        defaultRecurring: true,
      },
      travel: {
        label: 'Travel',
        icon: '✈️',
        color: '#14b8a6',
        defaultRecurring: false,
      },
      custom: {
        label: 'Custom',
        icon: '⭐',
        color: '#8b5cf6',
        defaultRecurring: false,
      },
    };
    
    return typeMap[type] || typeMap.custom;
  }

  /**
   * Check if a milestone needs notification based on days until anniversary
   */
  static shouldNotify(milestone: Milestone, daysUntil: number): boolean {
    if (!milestone.isActive) return false;
    
    const { notificationSettings } = milestone;
    
    // Check each notification threshold
    if (daysUntil === 0 && notificationSettings.onTheDay) return true;
    if (daysUntil === 1 && notificationSettings.oneDayBefore) return true;
    if (daysUntil === 3 && notificationSettings.threeDaysBefore) return true;
    if (daysUntil === 7 && notificationSettings.oneWeekBefore) return true;
    if (daysUntil === 30 && notificationSettings.oneMonthBefore) return true;
    
    return false;
  }

  /**
   * Generate notification message for milestone
   */
  static getNotificationMessage(milestone: Milestone, daysUntil: number): {
    title: string;
    body: string;
  } {
    const typeInfo = this.getMilestoneTypeInfo(milestone.type);
    const timeSince = this.getTimeSince(milestone);
    
    if (daysUntil === 0) {
      // On the day
      if (milestone.isRecurring) {
        return {
          title: `${typeInfo.icon} ${milestone.title}`,
          body: `Today marks ${timeSince.years} year${timeSince.years !== 1 ? 's' : ''} since ${milestone.title}!`,
        };
      } else {
        return {
          title: `${typeInfo.icon} Anniversary of ${milestone.title}`,
          body: `It's been ${timeSince.formatted} since ${milestone.title}`,
        };
      }
    } else {
      // Before the day
      const timeText = daysUntil === 1 ? 'tomorrow' : 
                     daysUntil === 7 ? 'in 1 week' :
                     daysUntil === 30 ? 'in 1 month' :
                     `in ${daysUntil} days`;
      
      if (milestone.isRecurring) {
        return {
          title: `${typeInfo.icon} Upcoming ${typeInfo.label}`,
          body: `${milestone.title} is ${timeText} (${timeSince.years + 1} year${timeSince.years + 1 !== 1 ? 's' : ''})`,
        };
      } else {
        return {
          title: `${typeInfo.icon} ${milestone.title} Anniversary`,
          body: `Anniversary is ${timeText} (${timeSince.formatted} since)`,
        };
      }
    }
  }

  /**
   * Get milestones that need notification today
   */
  static getMilestonesToNotify(milestones: Milestone[]): Array<{
    milestone: Milestone;
    daysUntil: number;
    message: { title: string; body: string };
  }> {
    const today = new Date();
    const notificationsNeeded: Array<{
      milestone: Milestone;
      daysUntil: number;
      message: { title: string; body: string };
    }> = [];

    milestones.forEach(milestone => {
      if (!milestone.isActive) return;
      
      const timeUntil = this.getTimeUntilNext(milestone);
      if (!timeUntil) return;
      
      const daysUntil = timeUntil.days;
      
      if (this.shouldNotify(milestone, daysUntil)) {
        notificationsNeeded.push({
          milestone,
          daysUntil,
          message: this.getNotificationMessage(milestone, daysUntil),
        });
      }
    });

    return notificationsNeeded;
  }

  /**
   * Get upcoming milestones for dashboard display
   */
  static getUpcomingMilestones(milestones: Milestone[], limit: number = 5): Milestone[] {
    return milestones
      .filter(m => m.isActive)
      .map(milestone => {
        const timeUntil = this.getTimeUntilNext(milestone);
        return {
          ...milestone,
          nextAnniversaryDate: this.getNextAnniversaryDate(milestone)?.getTime(),
          _sortKey: timeUntil?.days ?? Infinity,
        };
      })
      .sort((a, b) => a._sortKey - b._sortKey)
      .slice(0, limit);
  }
}
