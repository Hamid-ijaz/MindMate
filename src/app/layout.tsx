
"use client";

import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { TaskProvider } from '@/contexts/task-context';
import { Header } from '@/components/header';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/theme-context';
import { ManageTasksSheet } from '@/components/manage-tasks-sheet';
import { MobileNav } from '@/components/mobile-nav';
import { NotificationProvider } from '@/contexts/notification-context';
import { useSetupNotificationHandlers } from '@/hooks/use-notification-handlers';
import { NoteProvider } from '@/contexts/note-context';

function AppInitializer({ children }: { children: React.ReactNode }) {
  useSetupNotificationHandlers();
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <TaskProvider>
              <NoteProvider>
                <NotificationProvider>
                  <AppInitializer>
                    <div className="relative flex min-h-screen flex-col">
                      <Header />
                      <main className="flex-1 pb-16 md:pb-0">{children}</main>
                      <MobileNav />
                    </div>
                    <Toaster />
                    <ManageTasksSheet />
                  </AppInitializer>
                </NotificationProvider>
              </NoteProvider>
            </TaskProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
