"use client";

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationProvider } from '@/contexts/notification-context';
import { Settings, User, Palette, Bell, Smartphone, Shield, ArrowLeft, Mail, Calendar } from 'lucide-react';
import { GoogleTasksIntegrations } from '@/components/settings/google-tasks-integrations';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { ThemeSettings } from '@/components/settings/theme-settings';
import { NotificationSettings } from '@/components/notification-settings';
import { TaskCategorySettings } from '@/components/settings/task-category-settings';
import { PWASettings } from '@/components/settings/pwa-settings';
import { AdminSettings } from '@/components/settings/admin-settings';
import { EmailPreferencesSettings } from '@/components/email-preferences-settings';

function SettingsSkeleton() {
  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

const settingsItems = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'Personal information',
    icon: User,
    component: ProfileSettings
  },
  {
    id: 'theme',
    title: 'Theme',
    description: 'Appearance settings',
    icon: Palette,
    component: ThemeSettings
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Alert preferences',
    icon: Bell,
    component: NotificationSettings
  },
  {
    id: 'email',
    title: 'Email Preferences',
    description: 'Email notifications and settings',
    icon: Mail,
    component: EmailPreferencesSettings
  },
  {
    id: 'calendar-connections',
    title: 'Integrations',
    description: 'Connect Google Tasks and other calendar services',
    icon: Calendar,
    component: GoogleTasksIntegrations
  },
  {
    id: 'tasks',
    title: 'Task Settings',
    description: 'Categories and durations',
    icon: Settings,
    component: TaskCategorySettings
  },
  {
    id: 'pwa',
    title: 'App Settings',
    description: 'Installation and features',
    icon: Smartphone,
    component: PWASettings
  },
  {
    id: 'admin',
    title: 'Admin Tools',
    description: 'Advanced options',
    icon: Shield,
    component: AdminSettings
  }
];

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const [currentSetting, setCurrentSetting] = useState(searchParams.get('section') || 'overview');

  const CurrentComponent = settingsItems.find(item => item.id === currentSetting)?.component;

  if (currentSetting === 'overview' || !CurrentComponent) {
    return (
      <div className="min-h-screen bg-background">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="p-1 h-8 w-8 min-w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">Settings</h1>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2 py-6 hidden lg:block">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Settings className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your preferences</p>
          </div>

          {/* Settings Grid */}
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card 
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-shadow duration-200"
                  onClick={() => setCurrentSetting(item.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm leading-relaxed">
                      {item.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const currentItem = settingsItems.find(item => item.id === currentSetting);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentSetting('overview')}
            className="p-1 h-8 w-8 min-w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{currentItem?.title}</h1>
            <p className="text-sm text-muted-foreground truncate">{currentItem?.description}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Back Button and Header - Desktop */}
        <div className="border-b pb-4 mb-6 hidden lg:block">
          {/* Back Button */}
          <div className="mb-4">
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-1 text-sm px-3 py-1 h-auto"
              onClick={() => setCurrentSetting('overview')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Back to Settings
            </Button>
          </div>

          {/* Header with Icon */}
          {currentItem && (
            <div className="flex items-center gap-3 mt-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <currentItem.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold md:text-2xl">{currentItem.title}</h1>
                <p className="text-sm text-muted-foreground">{currentItem.description}</p>
              </div>
            </div>
          )}
        </div>

        {/* Settings Content */}
        <div className="pb-16">
          {CurrentComponent && <CurrentComponent />}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPageWrapper(props: any) {
  return (
    <NotificationProvider>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsPageContent {...props} />
      </Suspense>
    </NotificationProvider>
  );
}
