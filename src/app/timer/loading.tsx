import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function TimerLoading() {
  return (
    <div className="container mx-auto max-w-6xl py-8 md:py-12 px-4">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-16" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 hidden md:block" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        
        <div className="grid md:grid-cols-3 gap-6">
          {/* Timer Card Skeleton */}
          <div className="md:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center space-y-4">
                  <Skeleton className="h-48 w-48 rounded-full" />
                  <Skeleton className="h-6 w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-10 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Task Selection Skeleton */}
          <Card className="h-full">
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
