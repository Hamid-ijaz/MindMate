"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  Loader2, 
  TestTube
} from 'lucide-react';

export function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = user?.email === "hamid.ijaz91@gmail.com";

  const handleAdminPost = async () => {
    setIsLoading(true);
    try {
      toast({ 
        title: "Running test", 
        description: "Comprehensive check started." 
      });
      
      const res = await fetch("/api/notifications/comprehensive-check", { 
        method: "POST" 
      });
      
      if (res.ok) {
        toast({ 
          title: "Test completed", 
          description: "Check completed successfully." 
        });
      } else {
        toast({ 
          title: "Test failed", 
          description: "Check failed. Please try again.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "An error occurred during the test.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access admin tools.
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Admin tools can affect app functionality. Use with caution.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            System Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleAdminPost} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Test...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Run Comprehensive Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
