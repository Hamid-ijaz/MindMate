"use client";

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleTasksConnections } from '@/components/google-tasks-connections';
import { Separator } from '@/components/ui/separator';
import { Calendar, ExternalLink, Shield, RefreshCw, CheckCircle } from 'lucide-react';

export function CalendarIntegrations() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Google Tasks Integration</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Google Tasks to sync tasks seamlessly across all your devices.
        </p>
      </div>

      {/* Calendar Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Tasks Connection
          </CardTitle>
          <CardDescription>
            Manage your Google Tasks integration and sync settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleTasksConnections />
        </CardContent>
      </Card>

      {/* Integration Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Integration Features
          </CardTitle>
          <CardDescription>
            What you can do with calendar integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Two-way Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Tasks created in MindMate appear in your calendar, and calendar events can be converted to tasks.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Automatic Scheduling</h4>
                <p className="text-sm text-muted-foreground">
                  Find optimal time slots for your tasks based on your existing calendar commitments.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Conflict Detection</h4>
                <p className="text-sm text-muted-foreground">
                  Get notified when tasks overlap with existing meetings or appointments.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Smart Reminders</h4>
                <p className="text-sm text-muted-foreground">
                  Receive unified notifications for both tasks and calendar events.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supported Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Supported Services
          </CardTitle>
          <CardDescription>
            Calendar services you can connect to MindMate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Google Calendar */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Google Calendar</h3>
                  <p className="text-xs text-green-600">Available</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Full integration with Google Calendar including read/write access to events and tasks.
              </p>
            </div>

            {/* Outlook Calendar */}
            <div className="p-4 border rounded-lg opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Outlook Calendar</h3>
                  <p className="text-xs text-yellow-600">Coming Soon</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Microsoft Outlook and Office 365 calendar integration is in development.
              </p>
            </div>

            {/* Apple Calendar */}
            <div className="p-4 border rounded-lg opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Apple Calendar</h3>
                  <p className="text-xs text-yellow-600">Coming Soon</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                iCloud Calendar integration through CalDAV protocol is planned.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Security
          </CardTitle>
          <CardDescription>
            How we protect your calendar data and privacy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Secure Authentication</h4>
                <p className="text-sm text-muted-foreground">
                  We use OAuth 2.0 for secure authentication. Your calendar credentials are never stored on our servers.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Minimal Permissions</h4>
                <p className="text-sm text-muted-foreground">
                  We only request the minimum permissions needed for calendar sync functionality.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Data Encryption</h4>
                <p className="text-sm text-muted-foreground">
                  All calendar data is encrypted in transit and at rest using industry-standard protocols.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">You Control Your Data</h4>
                <p className="text-sm text-muted-foreground">
                  You can disconnect any calendar integration at any time, and we'll immediately stop accessing your data.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-900/30">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              🔒 Privacy First
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              We believe in privacy by design. Your calendar data is only used for the features you enable, and we never share it with third parties.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
