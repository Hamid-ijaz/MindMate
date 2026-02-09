
"use client";

import { useState } from "react";
import { motion } from 'framer-motion';
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { pageVariants, cardVariants } from '@/lib/animations';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Detect if mobile device
    const isMobile = typeof window !== 'undefined' && (
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|phone/i.test(navigator.userAgent.toLowerCase()) ||
      (window.matchMedia('(max-width: 768px)').matches && 'ontouchstart' in window)
    );
    
    try {
      const success = await login(email, password);
      if (success) {
        // Only show success toast on web, not on mobile
        if (!isMobile) {
          toast({
            title: "Welcome back!",
            description: "You have been successfully logged in.",
          });
        }
        router.push('/');
        router.refresh(); // Ensures middleware is re-evaluated
      } else {
        // Show error toast on both web and mobile
        toast({
          title: "Login Failed",
          description: "Invalid email or password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Show error toast on both web and mobile
      toast({
        title: "Login Error",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div variants={cardVariants}>
        <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit}>
            <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Log in to manage your tasks with MindMate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <div className="text-right">
                    <Link 
                        href="/forgot-password" 
                        className="text-sm text-primary hover:underline"
                    >
                        Forgot password?
                    </Link>
                </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Log In"}
                </Button>
            </CardFooter>
        </form>
         <p className="text-sm text-center pb-6 text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
                Sign Up
            </Link>
        </p>
      </Card>
      </motion.div>
    </motion.div>
  );
}
