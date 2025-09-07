import { 
  User, 
  Palette, 
  Bell, 
  ListTodo, 
  Calendar, 
  Smartphone, 
  Shield, 
  Zap,
  Settings,
  Search,
  Moon,
  Sun,
  Monitor,
  Volume2,
  Clock,
  Tag,
  Timer,
  Link,
  Download,
  HelpCircle
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface SettingItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  component: string;
  badge?: string;
  keywords?: string[];
}

export interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  settings: SettingItem[];
}

export const settingsConfig: Record<string, SettingsCategory> = {
  account: {
    id: 'account',
    title: 'Account & Profile',
    description: 'Manage your personal information and account settings',
    icon: User,
    settings: [
      {
        id: 'profile',
        label: 'Personal Information',
        description: 'Update your name, email, and other details',
        icon: User,
        component: 'ProfileSettings',
        keywords: ['profile', 'name', 'email', 'personal', 'information']
      }
    ]
  },
  appearance: {
    id: 'appearance',
    title: 'Appearance',
    description: 'Customize the look and feel of your workspace',
    icon: Palette,
    settings: [
      {
        id: 'theme',
        label: 'Theme & Colors',
        description: 'Choose your preferred theme and color scheme',
        icon: Palette,
        component: 'ThemeSettings',
        keywords: ['theme', 'color', 'dark', 'light', 'appearance']
      }
    ]
  },
  notifications: {
    id: 'notifications',
    title: 'Notifications',
    description: 'Manage how and when you receive alerts',
    icon: Bell,
    settings: [
      {
        id: 'notification-preferences',
        label: 'Notification Preferences',
        description: 'Configure your notification settings and timing',
        icon: Bell,
        component: 'NotificationSettings',
        keywords: ['notifications', 'alerts', 'reminders', 'sound', 'push']
      },
      {
        id: 'notification-permissions',
        label: 'Browser Permissions',
        description: 'Manage browser notification permissions',
        icon: Shield,
        component: 'NotificationPermissions',
        keywords: ['permissions', 'browser', 'allow', 'block']
      }
    ]
  },
  productivity: {
    id: 'productivity',
    title: 'Tasks & Productivity',
    description: 'Configure task management and productivity features',
    icon: ListTodo,
    settings: [
      {
        id: 'task-categories',
        label: 'Task Categories',
        description: 'Manage your custom task categories',
        icon: Tag,
        component: 'TaskCategorySettings',
        keywords: ['categories', 'tags', 'organization', 'labels']
      },
      {
        id: 'task-durations',
        label: 'Time Estimates',
        description: 'Set default time estimates for tasks',
        icon: Timer,
        component: 'TaskDurationSettings',
        keywords: ['duration', 'time', 'estimates', 'minutes', 'hours']
      }
    ]
  },
  integrations: {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect external services and calendars',
    icon: Link,
    settings: [
      {
        id: 'calendar-connections',
        label: 'Calendar Sync',
        description: 'Connect your Google Calendar and other services',
        icon: Calendar,
        component: 'GoogleTasksIntegrations',
        keywords: ['calendar', 'google', 'sync', 'integration', 'external']
      }
    ]
  },
  advanced: {
    id: 'advanced',
    title: 'Advanced',
    description: 'PWA settings, developer tools, and advanced features',
    icon: Settings,
    settings: [
      {
        id: 'pwa-settings',
        label: 'Progressive Web App',
        description: 'Install and manage PWA features',
        icon: Smartphone,
        component: 'PWASettings',
        keywords: ['pwa', 'install', 'offline', 'app']
      },
      {
        id: 'admin-tools',
        label: 'Developer Tools',
        description: 'Admin-only development and debugging tools',
        icon: Zap,
        component: 'AdminSettings',
        badge: 'Admin',
        keywords: ['admin', 'developer', 'debug', 'tools']
      }
    ]
  }
};

export const getAllSettings = (): SettingItem[] => {
  return Object.values(settingsConfig).flatMap(category => category.settings);
};

export const getSettingById = (id: string): SettingItem | undefined => {
  return getAllSettings().find(setting => setting.id === id);
};

export const getCategoryById = (id: string): SettingsCategory | undefined => {
  return Object.values(settingsConfig).find(category => category.id === id);
};

export const searchSettings = (query: string): SettingItem[] => {
  if (!query.trim()) return [];
  
  const searchTerms = query.toLowerCase().split(' ');
  
  return getAllSettings().filter(setting => {
    const searchableText = [
      setting.label,
      setting.description,
      ...(setting.keywords || [])
    ].join(' ').toLowerCase();
    
    return searchTerms.some(term => searchableText.includes(term));
  });
};
