import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import type { Milestone, MilestoneType, MilestoneNotificationPreferences } from '@/lib/types';
import { MilestoneUtils } from '@/lib/milestone-utils';

export class MilestoneService {
  private static getCollectionPath(userEmail: string) {
    return `users/${userEmail}/milestones`;
  }

  private static getPreferencesPath(userEmail: string) {
    return `users/${userEmail}/preferences/milestoneNotifications`;
  }

  /**
   * Create a new milestone
   */
  static async createMilestone(userEmail: string, milestoneData: Omit<Milestone, 'id' | 'userEmail' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = Date.now();
      const milestone: Omit<Milestone, 'id'> = {
        ...milestoneData,
        userEmail,
        createdAt: now,
        updatedAt: now,
      };

      // Only add nextAnniversaryDate if milestone is recurring
      if (milestoneData.isRecurring) {
        const nextDate = MilestoneUtils.getNextAnniversaryDate({ 
          ...milestoneData, 
          id: '', 
          userEmail, 
          createdAt: now, 
          updatedAt: now 
        } as Milestone);
        
        if (nextDate) {
          milestone.nextAnniversaryDate = nextDate.getTime();
        }
      }

      const docRef = await addDoc(collection(db, this.getCollectionPath(userEmail)), milestone);
      return docRef.id;
      return docRef.id;
    } catch (error) {
      console.error('Error creating milestone:', error);
      throw error;
    }
  }

  /**
   * Update an existing milestone
   */
  static async updateMilestone(userEmail: string, milestoneId: string, updates: Partial<Milestone>): Promise<void> {
    try {
      const milestoneRef = doc(db, this.getCollectionPath(userEmail), milestoneId);
      
      // Prepare the update object
      const updateData: any = {
        ...updates,
        updatedAt: Date.now(),
      };

      // Recalculate next anniversary date if relevant fields changed
      if (updates.originalDate || updates.isRecurring !== undefined || updates.recurringFrequency) {
        const currentMilestone = await this.getMilestone(userEmail, milestoneId);
        if (currentMilestone) {
          const updatedMilestone = { ...currentMilestone, ...updates };
          
          if (updatedMilestone.isRecurring) {
            const nextDate = MilestoneUtils.getNextAnniversaryDate(updatedMilestone);
            if (nextDate) {
              updateData.nextAnniversaryDate = nextDate.getTime();
            }
          } else {
            // Remove the field if milestone is no longer recurring
            updateData.nextAnniversaryDate = null;
          }
        }
      }

      await updateDoc(milestoneRef, updateData);
    } catch (error) {
      console.error('Error updating milestone:', error);
      throw error;
    }
  }

  /**
   * Delete a milestone
   */
  static async deleteMilestone(userEmail: string, milestoneId: string): Promise<void> {
    try {
      const milestoneRef = doc(db, this.getCollectionPath(userEmail), milestoneId);
      await deleteDoc(milestoneRef);
    } catch (error) {
      console.error('Error deleting milestone:', error);
      throw error;
    }
  }

  /**
   * Get a single milestone
   */
  static async getMilestone(userEmail: string, milestoneId: string): Promise<Milestone | null> {
    try {
      const milestoneRef = doc(db, this.getCollectionPath(userEmail), milestoneId);
      const docSnap = await getDoc(milestoneRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Milestone;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting milestone:', error);
      throw error;
    }
  }

  /**
   * Get all milestones for a user
   */
  static async getUserMilestones(userEmail: string): Promise<Milestone[]> {
    try {
      const q = query(
        collection(db, this.getCollectionPath(userEmail)),
        orderBy('originalDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const milestones: Milestone[] = [];
      
      querySnapshot.forEach(doc => {
        milestones.push({ id: doc.id, ...doc.data() } as Milestone);
      });

      return milestones;
    } catch (error) {
      console.error('Error getting user milestones:', error);
      throw error;
    }
  }

  /**
   * Get active milestones for a user
   */
  static async getActiveMilestones(userEmail: string): Promise<Milestone[]> {
    try {
      const q = query(
        collection(db, this.getCollectionPath(userEmail)),
        where('isActive', '==', true),
        orderBy('originalDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const milestones: Milestone[] = [];
      
      querySnapshot.forEach(doc => {
        milestones.push({ id: doc.id, ...doc.data() } as Milestone);
      });

      return milestones;
    } catch (error) {
      console.error('Error getting active milestones:', error);
      throw error;
    }
  }

  /**
   * Get milestones by type
   */
  static async getMilestonesByType(userEmail: string, type: MilestoneType): Promise<Milestone[]> {
    try {
      const q = query(
        collection(db, this.getCollectionPath(userEmail)),
        where('type', '==', type),
        orderBy('originalDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const milestones: Milestone[] = [];
      
      querySnapshot.forEach(doc => {
        milestones.push({ id: doc.id, ...doc.data() } as Milestone);
      });

      return milestones;
    } catch (error) {
      console.error('Error getting milestones by type:', error);
      throw error;
    }
  }

  /**
   * Get upcoming milestones (for dashboard)
   */
  static async getUpcomingMilestones(userEmail: string, limit: number = 5): Promise<Milestone[]> {
    try {
      const milestones = await this.getActiveMilestones(userEmail);
      return MilestoneUtils.getUpcomingMilestones(milestones, limit);
    } catch (error) {
      console.error('Error getting upcoming milestones:', error);
      throw error;
    }
  }

  /**
   * Get milestones that need notification
   */
  static async getMilestonesToNotify(userEmail: string): Promise<Array<{
    milestone: Milestone;
    daysUntil: number;
    message: { title: string; body: string };
  }>> {
    try {
      const milestones = await this.getActiveMilestones(userEmail);
      return MilestoneUtils.getMilestonesToNotify(milestones);
    } catch (error) {
      console.error('Error getting milestones to notify:', error);
      throw error;
    }
  }

  /**
   * Mark milestone as notified
   */
  static async markAsNotified(userEmail: string, milestoneId: string): Promise<void> {
    try {
      await this.updateMilestone(userEmail, milestoneId, {
        lastNotifiedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error marking milestone as notified:', error);
      throw error;
    }
  }

  /**
   * Get milestone notification preferences
   */
  static async getNotificationPreferences(userEmail: string): Promise<MilestoneNotificationPreferences> {
    try {
      const prefsRef = doc(db, this.getPreferencesPath(userEmail));
      const docSnap = await getDoc(prefsRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as MilestoneNotificationPreferences;
      }
      
      // Return default preferences
      return {
        enabled: true,
        quietHours: {
          start: '22:00',
          end: '08:00',
        },
        defaultSettings: {
          oneMonthBefore: true,
          oneWeekBefore: true,
          threeDaysBefore: true,
          oneDayBefore: true,
          onTheDay: true,
        },
      };
    } catch (error) {
      console.error('Error getting milestone notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update milestone notification preferences
   */
  static async updateNotificationPreferences(
    userEmail: string, 
    preferences: Partial<MilestoneNotificationPreferences>
  ): Promise<void> {
    try {
      const prefsRef = doc(db, this.getPreferencesPath(userEmail));
      await updateDoc(prefsRef, preferences);
    } catch (error) {
      console.error('Error updating milestone notification preferences:', error);
      throw error;
    }
  }

  /**
   * Bulk update milestone anniversary dates (for maintenance)
   */
  static async updateAllAnniversaryDates(userEmail: string): Promise<void> {
    try {
      const milestones = await this.getUserMilestones(userEmail);
      
      for (const milestone of milestones) {
        if (milestone.isRecurring) {
          const nextDate = MilestoneUtils.getNextAnniversaryDate(milestone);
          if (nextDate) {
            await this.updateMilestone(userEmail, milestone.id, {
              nextAnniversaryDate: nextDate.getTime(),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating anniversary dates:', error);
      throw error;
    }
  }
}
