"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Smartphone, Monitor, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWASettings() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check for iOS Safari
      if (window.navigator && (window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('App was installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      
      toast({
        title: "App Installed!",
        description: "MindMate has been added to your home screen.",
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        toast({
          title: "Installing...",
          description: "MindMate is being installed to your device.",
        });
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during installation:', error);
      toast({
        title: "Installation Failed",
        description: "There was an error installing the app. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const showManualInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS) {
      instructions = 'Tap the Share button in Safari, then "Add to Home Screen"';
    } else if (isAndroid) {
      instructions = 'Tap the menu (⋮) in your browser, then "Add to Home screen" or "Install app"';
    } else {
      instructions = 'Look for the install button in your browser\'s address bar or menu';
    }

    toast({
      title: "Install MindMate",
      description: instructions,
      duration: 8000,
    });
  };

  const getInstallStatus = () => {
    if (isInstalled) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Installed
        </Badge>
      );
    } else if (isInstallable) {
      return (
        <Badge variant="secondary">
          <Download className="w-3 h-3 mr-1" />
          Ready to Install
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          <Globe className="w-3 h-3 mr-1" />
          Web Version
        </Badge>
      );
    }
  };

  const getPlatformInfo = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;
    
    return {
      platform: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop',
      icon: isMobile ? Smartphone : Monitor,
      isMobile
    };
  };

  const platformInfo = getPlatformInfo();
  const PlatformIcon = platformInfo.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlatformIcon className="h-5 w-5" />
          Progressive Web App
        </CardTitle>
        <CardDescription>
          Install MindMate as a native app for a better experience with offline access and push notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Installation Status</p>
            <p className="text-sm text-muted-foreground">Platform: {platformInfo.platform}</p>
          </div>
          {getInstallStatus()}
        </div>

        {isInstalled ? (
          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">App Successfully Installed</span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-500 mt-1">
              MindMate is now available as a native app on your device. You can launch it from your home screen or app drawer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Offline Access</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use MindMate even without internet connection
                </p>
              </div>
              
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">Native Performance</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Faster loading and native app experience
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {deferredPrompt ? (
                <Button 
                  onClick={handleInstallClick} 
                  disabled={isInstalling}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isInstalling ? 'Installing...' : 'Install App'}
                </Button>
              ) : (
                <Button 
                  onClick={showManualInstructions} 
                  variant="outline"
                  className="flex-1"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Show Install Instructions
                </Button>
              )}
            </div>

            {!isInstallable && !deferredPrompt && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <AlertCircle className="inline h-3 w-3 mr-1" />
                  {platformInfo.isMobile 
                    ? 'Use your browser\'s "Add to Home Screen" option to install the app.'
                    : 'Use your browser\'s install option in the address bar or menu.'
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
