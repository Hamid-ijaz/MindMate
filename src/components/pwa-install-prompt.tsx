"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
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
      
      // Show install prompt after a delay (optional)
      setTimeout(() => {
        if (!localStorage.getItem('pwa-install-dismissed')) {
          setShowInstallPrompt(true);
        }
      }, 3000);
    };

    const handleAppInstalled = () => {
      console.log('App was installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      
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

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
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

  // Don't show anything if already installed
  if (isInstalled) return null;

  return (
    <>
      {/* Install Button in Header (for manual trigger) */}
      {isInstallable && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstallClick}
          className="hidden md:flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Install App
        </Button>
      )}

      {/* Install Prompt Dialog */}
      <Dialog open={showInstallPrompt} onOpenChange={setShowInstallPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install MindMate
            </DialogTitle>
            <DialogDescription>
              Get the full MindMate experience with faster loading, offline access, and native app features.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Offline Access</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use MindMate even without internet
                </p>
              </Card>
              
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">Faster Loading</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lightning-fast app performance
                </p>
              </Card>
            </div>

            <div className="flex gap-2">
              {deferredPrompt ? (
                <Button onClick={handleInstallClick} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install Now
                </Button>
              ) : (
                <Button onClick={showManualInstructions} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Show Instructions
                </Button>
              )}
              
              <Button variant="outline" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
