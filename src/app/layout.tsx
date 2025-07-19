
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { TaskProvider } from '@/contexts/task-context';
import { Header } from '@/components/header';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/theme-context';
import { ManageTasksSheet } from '@/components/manage-tasks-sheet';
import { MobileNav } from '@/components/mobile-nav';
import { NotificationProvider } from '@/contexts/notification-context';
import { NoteProvider } from '@/contexts/note-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { ClientWrapper } from '@/components/client-wrapper';
import { Metadata } from 'next';

// Metadata for SEO and browser tab
export const metadata: Metadata = {
  title: 'MindMate - AI-Powered Task Management',
  description: 'Your intelligent task companion that adapts to your energy and helps you stay productive.',
  keywords: ['task management', 'productivity', 'AI', 'mindmate', 'todo'],
  authors: [{ name: 'MindMate Team' }],
  creator: 'MindMate',
  publisher: 'MindMate',
  robots: 'index, follow',
  openGraph: {
    title: 'MindMate - AI-Powered Task Management',
    description: 'Your intelligent task companion that adapts to your energy and helps you stay productive.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MindMate - AI-Powered Task Management',
    description: 'Your intelligent task companion that adapts to your energy and helps you stay productive.',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' }
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  manifest: '/site.webmanifest',
};

function AppInitializer({ children }: { children: React.ReactNode }) {
  return (
    <ClientWrapper>
      {children}
    </ClientWrapper>
  );
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getTheme() {
                  const theme = window.localStorage.getItem('mindmate-ui-theme') || 'theme-default';
                  const mode = window.localStorage.getItem('mindmate-ui-mode') || 'system';
                  
                  document.documentElement.classList.add(theme);

                  if (mode === 'system') {
                    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    document.documentElement.classList.add(systemTheme);
                    return;
                  }
                  
                  document.documentElement.classList.add(mode);
                }
                getTheme();
              })();
            `,
          }}
        />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <ErrorBoundary>
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
        </ErrorBoundary>
      </body>
    </html>
  );
}
