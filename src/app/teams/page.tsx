'use client';

import React from 'react';
import { TeamProvider } from '@/contexts/team-context';
import TeamDashboard from '@/components/team-dashboard';

export default function TeamPage() {
  return (
    <TeamProvider>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Team Collaboration</h1>
            <p className="mt-2 text-sm lg:text-base text-muted-foreground">
              Collaborate with your team, manage workspaces, and track progress together.
            </p>
          </div>
          
          <TeamDashboard />
        </div>
      </div>
    </TeamProvider>
  );
}