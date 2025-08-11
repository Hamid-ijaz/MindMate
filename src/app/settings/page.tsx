
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { useTasks } from '@/contexts/task-context';
import { useNotifications } from '@/contexts/notification-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationSettings } from '@/components/notification-settings';
import { CalendarConnections } from '@/components/calendar-connections';
import { ThemePicker } from '@/components/theme-picker';
import { PWASettings } from '@/components/pwa-settings';
import { Trash2, Plus, Bell, BellOff, Palette } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { pageVariants, cardVariants, staggerContainer } from '@/lib/animations';

const profileSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email(),
});

const taskSettingsSchema = z.object({
    categories: z.array(z.object({ value: z.string().min(1, "Category cannot be empty") })),
    durations: z.array(z.object({ value: z.coerce.number().min(1, "Duration must be at least 1") }))
});

function SettingsSkeleton() {
  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-28" />
          </div>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle>Task Settings</CardTitle>
          <CardDescription>Customize the categories and durations available when creating tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Theme & Appearance</CardTitle>
          <CardDescription>Customize the look and feel of your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-10 w-10" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { NotificationProvider } from '@/contexts/notification-context';

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const { user, updateUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { taskCategories, setTaskCategories, taskDurations, setTaskDurations, isLoading: tasksLoading } = useTasks();
  const { permission, requestPermission } = useNotifications();
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const isLoading = authLoading || tasksLoading;

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  const taskSettingsForm = useForm<z.infer<typeof taskSettingsSchema>>({
      resolver: zodResolver(taskSettingsSchema),
      defaultValues: {
          categories: [],
          durations: [],
      }
  });
  
  const { isSubmitting: isProfileSubmitting } = profileForm.formState;
  const { isSubmitting: isTaskSettingsSubmitting } = taskSettingsForm.formState;

  useEffect(() => {
    if (!isLoading && user) {
        profileForm.reset({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        });
        setIsAdmin(user.email === "hamid.ijaz91@gmail.com");

    }
  }, [isLoading, user, profileForm]);

  useEffect(() => {
     if (!isLoading) {
        taskSettingsForm.reset({
          categories: taskCategories.map(c => ({ value: c })),
          durations: taskDurations.map(d => ({ value: d })),
        });
     }
  }, [isLoading, taskCategories, taskDurations, taskSettingsForm]);

  // Handle OAuth callback parameters
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const googleConnected = searchParams.get('google_connected');
    const googleEmail = searchParams.get('google_email');
    
    if (success === 'google_calendar_connected' || googleConnected === 'true') {
      toast({
        title: "Connected Successfully",
        description: `Google Calendar has been connected to your account${googleEmail ? ` (${decodeURIComponent(googleEmail)})` : ''}.`,
      });
      setCalendarRefreshTrigger(prev => prev + 1);
      
      // If we get the google_connected=true format, trigger a manual refresh
      if (googleConnected === 'true') {
        // Force refresh the calendar settings after a short delay
        setTimeout(() => {
          setCalendarRefreshTrigger(prev => prev + 1);
        }, 1000);
      }
      
      // Clean up URL parameters
      window.history.replaceState({}, '', '/settings');
    } else if (error) {
      let errorMessage = "An error occurred.";
      switch (error) {
        case 'google_calendar_denied':
          errorMessage = "Google Calendar access was denied.";
          break;
        case 'google_calendar_no_code':
          errorMessage = "Authorization code was not received.";
          break;
        case 'google_calendar_connection_failed':
          errorMessage = "Failed to connect to Google Calendar.";
          break;
      }
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
      // Clean up URL parameters
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams, toast]);


  const { fields: categoryFields, append: appendCategory, remove: removeCategory } = useFieldArray({
      control: taskSettingsForm.control,
      name: "categories"
  });
  
  const { fields: durationFields, append: appendDuration, remove: removeDuration } = useFieldArray({
      control: taskSettingsForm.control,
      name: "durations"
  });


  const onProfileSubmit = async (data: z.infer<typeof profileSchema>) => {
    try {
      await updateUser(data);
      toast({ title: "Profile Updated", description: "Your information has been saved." });
    } catch (error) {
      toast({ 
        title: "Update Failed", 
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    }
  };

  const onTaskSettingsSubmit = async (data: z.infer<typeof taskSettingsSchema>) => {
    const newCategories = data.categories.map(c => c.value);
    const newDurations = data.durations.map(d => d.value).sort((a, b) => a - b);
    
    await setTaskCategories(newCategories as [string, ...string[]]);
    await setTaskDurations(newDurations as [number, ...number[]]);

    toast({ title: "Task Settings Saved", description: "Your custom categories and durations have been updated." });
  };
  
  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    await requestPermission();
    setIsRequestingPermission(false);
  }

  useEffect(() => {
    setIsAdmin(user?.email === "hamid.ijaz91@gmail.com");
  }, [user]);
  const [adminLoading, setAdminLoading] = useState(false);
  const handleAdminPost = async () => {
    // setAdminLoading(true);
    try {
      toast({ title: "POST Sending", description: "Comprehensive check POST request sent." });
      const res = await fetch("/api/notifications/comprehensive-check", { method: "POST" });
      // setAdminLoading(false);
      if (res.ok) {
        toast({ title: "POST Success", description: "Comprehensive check POST request sent." });
      } else {
        toast({ title: "POST Failed", description: "Request failed.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "POST Error", description: "An error occurred.", variant: "destructive" });
    }
  };
  const handleAdminDelete = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch("/api/notifications/comprehensive-check", { method: "DELETE" });
      if (res.ok) {
        toast({ title: "DELETE Success", description: "Comprehensive check DELETE request sent." });
      } else {
        toast({ title: "DELETE Failed", description: "Request failed.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "DELETE Error", description: "An error occurred.", variant: "destructive" });
    }
    setAdminLoading(false);
  };

  return (
    <motion.div 
      className="container mx-auto max-w-4xl py-8 md:py-12 px-4"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div className="mb-8" variants={cardVariants}>
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and application settings.</p>
      </motion.div>

      {isAdmin && (
        <motion.div variants={cardVariants}>
          <Card className="mb-8 border-2 border-red-500">
            <CardHeader>
              <CardTitle>Admin Section</CardTitle>
              <CardDescription>Developer tools for admin only</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button variant="destructive" onClick={handleAdminPost} disabled={adminLoading}>
                Send POST to /api/notifications/comprehensive-check
              </Button>
              <Button variant="outline" onClick={handleAdminDelete} disabled={adminLoading}>
                Send DELETE to /api/notifications/comprehensive-check
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <motion.div 
          className="grid gap-8"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
            <motion.div variants={cardVariants}>
              <Card>
                <CardHeader>
                    <CardTitle>My Profile</CardTitle>
                    <CardDescription>Update your personal information.</CardDescription>
                </CardHeader>
              <CardContent>
                  <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                          control={profileForm.control}
                          name="firstName"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                          />
                          <FormField
                          control={profileForm.control}
                          name="lastName"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                          />
                      </div>
                      <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input readOnly disabled {...field} /></FormControl>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                      <div className="flex justify-end">
                      <Button type="submit" disabled={isProfileSubmitting}>
                         {isProfileSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                         Save Profile
                      </Button>
                      </div>
                  </form>
                  </Form>
              </CardContent>
            </Card>
            </motion.div>
            
            <motion.div variants={cardVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Manage how you receive reminders.</CardDescription>
              </CardHeader>
              <CardContent>
                {permission === 'granted' && (
                  <div className="flex items-center text-sm text-green-600">
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Notifications are enabled.</span>
                  </div>
                )}
                 {permission === 'denied' && (
                  <div className="flex items-center text-sm text-destructive">
                    <BellOff className="mr-2 h-4 w-4" />
                    <span>Notifications are blocked. You'll need to enable them in your browser settings.</span>
                  </div>
                )}
                {permission === 'default' && (
                  <Button onClick={handleRequestPermission} disabled={isRequestingPermission}>
                    {isRequestingPermission ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                    Enable Notifications
                  </Button>
                )}
              </CardContent>
            </Card>
            </motion.div>

            {/* Theme & Appearance Settings */}
            <motion.div variants={cardVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme & Appearance
                </CardTitle>
                <CardDescription>Customize the look and feel of your workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Theme Selector</p>
                      <p className="text-xs text-muted-foreground">
                        Choose between light, dark mode and different color themes
                      </p>
                    </div>
                    <ThemePicker />
                  </div>
                </div>
              </CardContent>
            </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
            <Card>
                <CardHeader>
                    <CardTitle>Task Settings</CardTitle>
                    <CardDescription>Customize the categories and durations available when creating tasks.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...taskSettingsForm}>
                        <form onSubmit={taskSettingsForm.handleSubmit(onTaskSettingsSubmit)} className="space-y-8">
                            
                            <div className="space-y-4">
                                <FormLabel>Task Categories</FormLabel>
                                <FormDescription>Add or remove the categories you use to organize tasks.</FormDescription>
                                {categoryFields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={taskSettingsForm.control}
                                        name={`categories.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem className="flex items-center gap-2">
                                                <FormControl><Input {...field} /></FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeCategory(index)}>
                                                    <Trash2 className="text-destructive"/>
                                                </Button>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendCategory({ value: '' })}>
                                    <Plus className="mr-2"/> Add Category
                                </Button>
                            </div>
                            
                            <Separator />

                            <div className="space-y-4">
                                <FormLabel>Task Durations (in minutes)</FormLabel>
                                <FormDescription>Set the time estimates you want to assign to tasks.</FormDescription>
                                {durationFields.map((field, index) => (
                                    <FormField
                                        key={field.id}
                                        control={taskSettingsForm.control}
                                        name={`durations.${index}.value`}
                                        render={({ field }) => (
                                            <FormItem className="flex items-center gap-2">
                                                <FormControl><Input type="number" {...field} /></FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeDuration(index)}>
                                                    <Trash2 className="text-destructive"/>
                                                </Button>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendDuration({ value: 0 })}>
                                    <Plus className="mr-2"/> Add Duration
                                </Button>
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={isTaskSettingsSubmitting}>
                                    {isTaskSettingsSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Task Settings
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
              <NotificationSettings />
            </motion.div>

            <motion.div variants={cardVariants}>
              <PWASettings />
            </motion.div>

            {/* <motion.div variants={cardVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Calendar Integration</CardTitle>
                  <CardDescription>Connect external calendars to sync your tasks and events.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CalendarConnections key={calendarRefreshTrigger} />
                </CardContent>
              </Card>
            </motion.div> */}
        </motion.div>
      )}
    </motion.div>
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
