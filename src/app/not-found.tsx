"use client";

import { NotificationProvider } from "@/contexts/notification-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();
  return (
    <NotificationProvider>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h2 className="text-lg font-semibold">Page Not Found</h2>
                <p className="text-muted-foreground mt-2">
                  The page you are looking for does not exist or has been deleted.
                </p>
              </div>
              <Button onClick={() => router.push("/pending")}> 
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tasks
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </NotificationProvider>
  );
}
