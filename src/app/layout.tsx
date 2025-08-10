
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { TaskProvider } from '@/contexts/task-context';
import { Header } from '@/components/header';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/theme-context';
import { ManageTasksSheet } from '@/components/manage-tasks-sheet';
import { MobileNav } from '@/components/mobile-nav';
import { KeyboardNavigation } from '@/components/keyboard-navigation';
import { UnifiedNotificationProvider } from '@/contexts/unified-notification-context';
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
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MindMate'
  },
  formatDetection: {
    telephone: false
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
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
        
        {/* PWA Meta Tags */}
        <meta name="application-name" content="MindMate" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MindMate" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="mask-icon" href="/favicon.svg" color="#3b82f6" />
        <link rel="shortcut icon" href="/favicon.ico" />
        
        <meta name="theme-color" content="#3b82f6" />
        
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
              
              // Register Service Worker
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthProvider>
              <NotificationProvider>
                <UnifiedNotificationProvider>
                  <TaskProvider>
                    <NoteProvider>
                      <AppInitializer>
                        <div className="relative flex min-h-screen flex-col">
                          <Header />
                          <main className="flex-1 pb-16 md:pb-0">{children}</main>
                          <MobileNav />
                        </div>
                        <Toaster />
                        <ManageTasksSheet />
                        <KeyboardNavigation />
                      </AppInitializer>
                    </NoteProvider>
                  </TaskProvider>
                </UnifiedNotificationProvider>
              </NotificationProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
