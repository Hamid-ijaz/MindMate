"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { SettingsOverview } from './settings-overview';
import { ProfileSettings } from './profile-settings';
import { ThemeSettings } from './theme-settings';
import { NotificationSettings } from '@/components/notification-settings';
import { NotificationPermissions } from './notification-permissions';
import { TaskCategorySettings } from './task-category-settings';
import { TaskDurationSettings } from './task-duration-settings';
import { GoogleTasksIntegrations } from './google-tasks-integrations';
import { PWASettings } from './pwa-settings';
import { AdminSettings } from './admin-settings';

interface SettingsContentProps {
  currentSetting: string;
  onNavigateToSetting: (settingId: string) => void;
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export function SettingsContent({ currentSetting, onNavigateToSetting }: SettingsContentProps) {
  const renderSettingComponent = () => {
    switch (currentSetting) {
      case 'overview':
        return <SettingsOverview onNavigateToSetting={onNavigateToSetting} />;
      case 'profile':
        return <ProfileSettings />;
      case 'theme':
        return <ThemeSettings />;
      case 'notification-preferences':
        return <NotificationSettings />;
      case 'notification-permissions':
        return <NotificationPermissions />;
      case 'task-categories':
        return <TaskCategorySettings />;
      case 'task-durations':
        return <TaskDurationSettings />;
      case 'calendar-connections':
        return <GoogleTasksIntegrations />;
      case 'pwa-settings':
        return <PWASettings />;
      case 'admin-tools':
        return <AdminSettings />;
      default:
        return <SettingsOverview onNavigateToSetting={onNavigateToSetting} />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentSetting}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="h-full"
      >
        {renderSettingComponent()}
      </motion.div>
    </AnimatePresence>
  );
}
