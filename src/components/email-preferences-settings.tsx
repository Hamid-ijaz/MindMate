"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { 
  Mail, 
  Bell, 
  Settings, 
  Clock, 
  Users, 
  Shield,
  Loader2,
  Check
} from 'lucide-react';

interface EmailPreferences {
  welcomeEmails: boolean;
  taskReminders: boolean;
  shareNotifications: boolean;
  teamInvitations: boolean;
  weeklyDigest: boolean;
  dailyDigest: boolean;
  marketingEmails: boolean;
  reminderFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  digestDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  dailyDigestTime: string;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

const defaultPreferences: EmailPreferences = {
  welcomeEmails: true,
  taskReminders: true,
  shareNotifications: true,
  teamInvitations: true,
  weeklyDigest: true,
  dailyDigest: true,
  marketingEmails: false,
  reminderFrequency: 'immediate',
  digestDay: 'monday',
  dailyDigestTime: '09:00',
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

export function EmailPreferencesSettings() {
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadPreferences();
  }, [user?.email]);

  const loadPreferences = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch(`/api/email/preferences?userEmail=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        setPreferences({ ...defaultPreferences, ...data.preferences });
      }
    } catch (error) {
      console.error('Error loading email preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = <K extends keyof EmailPreferences>(
    key: K,
    value: EmailPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateQuietHours = (key: keyof EmailPreferences['quietHours'], value: any) => {
    setPreferences(prev => ({
      ...prev,
      quietHours: { ...prev.quietHours, [key]: value }
    }));
    setHasChanges(true);
  };

  const savePreferences = async () => {
    if (!user?.email) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user.email,
          preferences,
        }),
      });

      if (response.ok) {
        setHasChanges(false);
        toast({
          title: 'Preferences saved',
          description: 'Your email preferences have been updated.',
        });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: user.email,
          userName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Test email sent',
          description: 'Check your inbox for a test email from MindMate.',
        });
      } else {
        throw new Error('Failed to send test email');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test email. Please check your email configuration.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2">Loading email preferences...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email Preferences</CardTitle>
          </div>
          <CardDescription>
            Configure when and how you receive emails from MindMate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Types */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notification Types
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="taskReminders" className="text-sm font-medium">
                    Task Reminders
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get email reminders for upcoming and overdue tasks
                  </p>
                </div>
                <Switch
                  id="taskReminders"
                  checked={preferences.taskReminders}
                  onCheckedChange={(checked) => updatePreference('taskReminders', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="shareNotifications" className="text-sm font-medium">
                    Share Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when someone shares tasks or notes with you
                  </p>
                </div>
                <Switch
                  id="shareNotifications"
                  checked={preferences.shareNotifications}
                  onCheckedChange={(checked) => updatePreference('shareNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="teamInvitations" className="text-sm font-medium">
                    Team Invitations
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you're invited to join teams
                  </p>
                </div>
                <Switch
                  id="teamInvitations"
                  checked={preferences.teamInvitations}
                  onCheckedChange={(checked) => updatePreference('teamInvitations', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="weeklyDigest" className="text-sm font-medium">
                    Weekly Digest
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get a weekly summary of your tasks and productivity
                  </p>
                </div>
                <Switch
                  id="weeklyDigest"
                  checked={preferences.weeklyDigest}
                  onCheckedChange={(checked) => updatePreference('weeklyDigest', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="dailyDigest" className="text-sm font-medium">
                    Daily Digest
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get a daily summary of your tasks and progress
                  </p>
                </div>
                <Switch
                  id="dailyDigest"
                  checked={preferences.dailyDigest}
                  onCheckedChange={(checked) => updatePreference('dailyDigest', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="marketingEmails" className="text-sm font-medium">
                    Product Updates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get updates about new features and improvements
                  </p>
                </div>
                <Switch
                  id="marketingEmails"
                  checked={preferences.marketingEmails}
                  onCheckedChange={(checked) => updatePreference('marketingEmails', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Timing Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timing Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reminderFrequency">Reminder Frequency</Label>
                <Select
                  value={preferences.reminderFrequency}
                  onValueChange={(value) => updatePreference('reminderFrequency', value as EmailPreferences['reminderFrequency'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="hourly">Hourly Digest</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preferences.weeklyDigest && (
                <div className="space-y-2">
                  <Label htmlFor="digestDay">Weekly Digest Day</Label>
                  <Select
                    value={preferences.digestDay}
                    onValueChange={(value) => updatePreference('digestDay', value as EmailPreferences['digestDay'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {preferences.dailyDigest && (
                <div className="space-y-2">
                  <Label htmlFor="dailyDigestTime">Daily Digest Time</Label>
                  <Input
                    id="dailyDigestTime"
                    type="time"
                    value={preferences.dailyDigestTime}
                    onChange={(e) => updatePreference('dailyDigestTime', e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Quiet Hours */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="quietHours" className="text-sm font-medium">
                    Quiet Hours
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Don't send emails during these hours
                  </p>
                </div>
                <Switch
                  id="quietHours"
                  checked={preferences.quietHours.enabled}
                  onCheckedChange={(checked) => updateQuietHours('enabled', checked)}
                />
              </div>

              {preferences.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={preferences.quietHours.startTime}
                      onChange={(e) => updateQuietHours('startTime', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={preferences.quietHours.endTime}
                      onChange={(e) => updateQuietHours('endTime', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={savePreferences} 
              disabled={!hasChanges || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : hasChanges ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              ) : (
                'No Changes'
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={sendTestEmail}
              className="flex-1"
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Test Email
            </Button>
          </div>

          {hasChanges && (
            <Alert>
              <AlertDescription>
                You have unsaved changes. Click "Save Changes" to apply your new preferences.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
