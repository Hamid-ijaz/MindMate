"use client";

import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { settingsConfig } from '@/lib/settings-config';
import { 
  User, 
  Palette, 
  Bell, 
  BellOff, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  Smartphone,
  ArrowRight
} from 'lucide-react';

interface SettingsOverviewProps {
  onNavigateToSetting: (settingId: string) => void;
}

export function SettingsOverview({ onNavigateToSetting }: SettingsOverviewProps) {
  const { user } = useAuth();
  const { taskCategories, taskDurations } = useTasks();
  const { permission } = useNotifications();

  const quickActions = [
    {
      id: 'profile',
      title: 'Update Profile',
      description: 'Keep your information current',
      icon: User,
      action: () => onNavigateToSetting('profile')
    },
    {
      id: 'theme',
      title: 'Change Theme',
      description: 'Customize your workspace',
      icon: Palette,
      action: () => onNavigateToSetting('theme')
    },
    {
      id: 'notification-preferences',
      title: 'Setup Notifications',
      description: 'Never miss important tasks',
      icon: Bell,
      action: () => onNavigateToSetting('notification-preferences')
    }
  ];

  const settingsStatus = [
    {
      category: 'Account',
      items: [
        {
          label: 'Profile Complete',
          status: user?.firstName && user?.lastName ? 'complete' : 'incomplete',
          description: user?.firstName && user?.lastName ? 'All required information provided' : 'Missing profile information'
        }
      ]
    },
    {
      category: 'Notifications',
      items: [
        {
          label: 'Browser Permissions',
          status: permission === 'granted' ? 'complete' : permission === 'denied' ? 'error' : 'pending',
          description: permission === 'granted' ? 'Notifications enabled' : 
                      permission === 'denied' ? 'Notifications blocked' : 'Permission not requested'
        }
      ]
    },
    {
      category: 'Productivity',
      items: [
        {
          label: 'Task Categories',
          status: taskCategories.length > 0 ? 'complete' : 'incomplete',
          description: `${taskCategories.length} categories configured`
        },
        {
          label: 'Time Estimates',
          status: taskDurations.length > 0 ? 'complete' : 'incomplete',
          description: `${taskDurations.length} duration options available`
        }
      ]
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="default" className="bg-green-500">Complete</Badge>;
      case 'error':
        return <Badge variant="destructive">Attention Needed</Badge>;
      default:
        return <Badge variant="secondary">Incomplete</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings Overview</h1>
        <p className="text-muted-foreground mt-1">
          Manage your MindMate experience and keep everything configured perfectly.
        </p>
      </div>

      {/* Welcome Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-5 w-5 text-primary" />
            </div>
            Welcome back, {user?.firstName || 'User'}!
          </CardTitle>
          <CardDescription>
            Your MindMate workspace is ready. Here's what you can customize:
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={action.action}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">{action.title}</h3>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Settings Status */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Settings Status</h2>
        <div className="space-y-4">
          {settingsStatus.map((category) => (
            <Card key={category.category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{category.category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Settings Categories */}
      <div>
        <h2 className="text-lg font-semibold mb-4">All Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(settingsConfig).map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{category.title}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {category.settings.map((setting) => (
                      <Button
                        key={setting.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2"
                        onClick={() => onNavigateToSetting(setting.id)}
                      >
                        <setting.icon className="h-3 w-3 mr-2" />
                        <span className="text-xs">{setting.label}</span>
                        {setting.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {setting.badge}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
