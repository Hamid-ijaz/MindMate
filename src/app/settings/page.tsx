
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/task-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { taskCategories, setTaskCategories, taskDurations, setTaskDurations, isLoading: tasksLoading } = useTasks();

  const isLoading = authLoading || tasksLoading;

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    },
  });

  const taskSettingsForm = useForm<z.infer<typeof taskSettingsSchema>>({
      resolver: zodResolver(taskSettingsSchema),
      values: {
          categories: taskCategories.map(c => ({ value: c })),
          durations: taskDurations.map(d => ({ value: d })),
      }
  });

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

  const onTaskSettingsSubmit = (data: z.infer<typeof taskSettingsSchema>) => {
    const newCategories = data.categories.map(c => c.value);
    const newDurations = data.durations.map(d => d.value).sort((a, b) => a - b);
    
    setTaskCategories(newCategories as [string, ...string[]]);
    setTaskDurations(newDurations as [number, ...number[]]);

    toast({ title: "Task Settings Saved", description: "Your custom categories and durations have been updated." });
  };
  
  // Resets the form with the latest user data when loading is complete.
  if (!isLoading && user) {
      profileForm.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
      taskSettingsForm.reset({
        categories: taskCategories.map(c => ({ value: c })),
        durations: taskDurations.map(d => ({ value: d })),
      });
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and application settings.</p>
      </div>

      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid gap-8">
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
                    <Button type="submit">Save Profile</Button>
                    </div>
                </form>
                </Form>
            </CardContent>
            </Card>

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
                                    <PlusCircle className="mr-2"/> Add Category
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
                                    <PlusCircle className="mr-2"/> Add Duration
                                </Button>
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit">Save Task Settings</Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
