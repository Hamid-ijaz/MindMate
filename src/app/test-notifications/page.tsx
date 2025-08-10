'use client';

import React from 'react';
import { NotificationTestPanel } from '@/components/notification-test-panel';
import { NotificationDropdown } from '@/components/notification-dropdown';

export default function NotificationTestPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">🔔 Notification System Test</h1>
        <p className="text-muted-foreground">
          Test the unified notification system with Firestore storage and real-time updates
        </p>
      </div>
      
      <div className="flex justify-center">
        <NotificationTestPanel />
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">
          The notification dropdown in the header should also update in real-time:
        </p>
        <div className="inline-flex">
          <NotificationDropdown />
        </div>
      </div>
    </div>
  );
}