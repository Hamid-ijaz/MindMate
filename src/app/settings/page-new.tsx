"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { SettingsContent } from '@/components/settings/settings-content';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationProvider } from '@/contexts/notification-context';

function SettingsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const currentSetting = searchParams.get('section') || 'overview';

  const handleNavigateToSetting = (settingId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('section', settingId);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <SettingsLayout currentSetting={currentSetting}>
      <SettingsContent 
        currentSetting={currentSetting}
        onNavigateToSetting={handleNavigateToSetting}
      />
    </SettingsLayout>
  );
}

export default function SettingsPageWrapper(props: any) {
  return (
    <NotificationProvider>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsPageInner {...props} />
      </Suspense>
    </NotificationProvider>
  );
}
