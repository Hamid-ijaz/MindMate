import { googleTasksIntegration } from './google-tasks';
import { googleTasksService } from '@/lib/firestore';
import type { GoogleTasksSettings } from '@/lib/types';

interface CategoryTaskListManager {
  getOrCreateCategoryTaskList(userEmail: string, category: string): Promise<string>;
  getOrCreateArchivedTaskList(userEmail: string): Promise<string>;
  getAllCategoryTaskLists(userEmail: string): Promise<Record<string, string>>;
  cleanupUnusedTaskLists(userEmail: string, usedCategories: string[]): Promise<void>;
}

class CategoryTaskListManagerImpl implements CategoryTaskListManager {
  
  /**
   * Get or create a task list for a specific category
   */
  async getOrCreateCategoryTaskList(userEmail: string, category: string): Promise<string> {
    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    if (!settings || !settings.isConnected) {
      throw new Error('Google Tasks not connected');
    }

    // Check if we already have a task list for this category
    const categoryTaskLists = settings.categoryTaskLists || {};
    if (categoryTaskLists[category]) {
      // Verify the task list still exists
      try {
        const taskLists = await googleTasksIntegration.getTaskLists(userEmail);
        const exists = taskLists.some(list => list.id === categoryTaskLists[category]);
        if (exists) {
          return categoryTaskLists[category];
        }
      } catch (error) {
        console.warn(`Failed to verify task list for category ${category}:`, error);
      }
    }

    // Create new task list
    const prefix = settings.taskListPrefix || 'MindMate_';
    const taskListTitle = `${prefix}${category}`;
    
    console.log(`🆕 Creating new task list: ${taskListTitle} for category: ${category}`);
    
    try {
      const newTaskList = await googleTasksIntegration.createTaskList(userEmail, taskListTitle);
      if (!newTaskList?.id) {
        throw new Error('Failed to create task list - no ID returned');
      }

      // Update settings with new category task list
      const updatedCategoryTaskLists = {
        ...categoryTaskLists,
        [category]: newTaskList.id
      };

      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        categoryTaskLists: updatedCategoryTaskLists
      });

      console.log(`✅ Created and saved task list ${newTaskList.id} for category ${category}`);
      return newTaskList.id;
    } catch (error) {
      console.error(`❌ Failed to create task list for category ${category}:`, error);
      throw error;
    }
  }

  /**
   * Get or create the archived tasks list
   */
  async getOrCreateArchivedTaskList(userEmail: string): Promise<string> {
    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    if (!settings || !settings.isConnected) {
      throw new Error('Google Tasks not connected');
    }

    // Check if we already have an archived task list
    if (settings.archivedTaskListId) {
      // Verify the task list still exists
      try {
        const taskLists = await googleTasksIntegration.getTaskLists(userEmail);
        const exists = taskLists.some(list => list.id === settings.archivedTaskListId);
        if (exists) {
          return settings.archivedTaskListId;
        }
      } catch (error) {
        console.warn(`Failed to verify archived task list:`, error);
      }
    }

    // Create new archived task list
    const prefix = settings.taskListPrefix || 'MindMate_';
    const taskListTitle = `${prefix}Archived`;
    
    console.log(`🗄️ Creating new archived task list: ${taskListTitle}`);
    
    try {
      const newTaskList = await googleTasksIntegration.createTaskList(userEmail, taskListTitle);
      if (!newTaskList?.id) {
        throw new Error('Failed to create archived task list - no ID returned');
      }

      // Update settings with new archived task list
      await googleTasksService.updateGoogleTasksSettings(userEmail, {
        archivedTaskListId: newTaskList.id
      });

      console.log(`✅ Created and saved archived task list ${newTaskList.id}`);
      return newTaskList.id;
    } catch (error) {
      console.error(`❌ Failed to create archived task list:`, error);
      throw error;
    }
  }

  /**
   * Get all category task lists
   */
  async getAllCategoryTaskLists(userEmail: string): Promise<Record<string, string>> {
    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    return settings?.categoryTaskLists || {};
  }

  /**
   * Clean up unused task lists (optional - for maintenance)
   */
  async cleanupUnusedTaskLists(userEmail: string, usedCategories: string[]): Promise<void> {
    console.log(`🧹 Cleaning up unused task lists for categories: ${usedCategories.join(', ')}`);
    
    const settings = await googleTasksService.getGoogleTasksSettings(userEmail);
    if (!settings?.categoryTaskLists) return;

    const categoryTaskLists = settings.categoryTaskLists;
    const unusedCategories = Object.keys(categoryTaskLists).filter(
      category => !usedCategories.includes(category)
    );

    if (unusedCategories.length === 0) {
      console.log('✅ No unused task lists to clean up');
      return;
    }

    console.log(`🗑️ Found ${unusedCategories.length} unused task lists:`, unusedCategories);
    
    // Note: We don't automatically delete task lists as they might contain important data
    // This is just for logging. Manual cleanup can be implemented later if needed.
    for (const category of unusedCategories) {
      console.log(`⚠️ Unused task list for category "${category}": ${categoryTaskLists[category]}`);
    }
  }
}

export const categoryTaskListManager = new CategoryTaskListManagerImpl();
