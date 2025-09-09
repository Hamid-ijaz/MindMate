"use client";

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleTasksConnections } from '@/components/google-tasks-connections';
import { Separator } from '@/components/ui/separator';
import { Calendar, ExternalLink, Shield, RefreshCw, CheckCircle, CheckSquare } from 'lucide-react';

export function GoogleTasksIntegrations() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
     

      {/* Google Tasks Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
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
            What you can do with Google Tasks integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Two-way Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Tasks created in MindMate appear in Google Tasks, and Google Tasks can be synced with your app.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Automatic Scheduling</h4>
                <p className="text-sm text-muted-foreground">
                  Find optimal time slots for your tasks based on your existing Google Tasks schedule.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Conflict Detection</h4>
                <p className="text-sm text-muted-foreground">
                  Get notified when tasks overlap with existing Google Tasks or scheduled items.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Smart Reminders</h4>
                <p className="text-sm text-muted-foreground">
                  Receive unified notifications for both tasks and Google Tasks updates.
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
            Task services you can connect to MindMate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Google Tasks */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <CheckSquare className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Google Tasks</h3>
                  <p className="text-xs text-green-600">Available</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Full integration with Google Tasks including read/write access to tasks and synchronization.
              </p>
            </div>

            {/* Outlook Tasks */}
            <div className="p-4 border rounded-lg opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Outlook Tasks</h3>
                  <p className="text-xs text-yellow-600">Coming Soon</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Microsoft Outlook and Office 365 tasks integration is in development.
              </p>
            </div>

            {/* Apple Tasks */}
            <div className="p-4 border rounded-lg opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Apple Tasks</h3>
                  <p className="text-xs text-yellow-600">Coming Soon</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                iCloud Tasks integration through CalDAV protocol is planned.
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
            How we protect your task data and privacy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Secure Authentication</h4>
                <p className="text-sm text-muted-foreground">
                  We use OAuth 2.0 for secure authentication. Your task service credentials are never stored on our servers.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Minimal Permissions</h4>
                <p className="text-sm text-muted-foreground">
                  We only request the minimum permissions needed for task sync functionality.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Data Encryption</h4>
                <p className="text-sm text-muted-foreground">
                  All task data is encrypted in transit and at rest using industry-standard protocols.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-medium">You Control Your Data</h4>
                <p className="text-sm text-muted-foreground">
                  You can disconnect any task integration at any time, and we'll immediately stop accessing your data.
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
              We believe in privacy by design. Your task data is only used for the features you enable, and we never share it with third parties.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
