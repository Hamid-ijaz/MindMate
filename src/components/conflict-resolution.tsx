'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Calendar,
  MapPin,
  User,
  FileText,
  ArrowLeft,
  ArrowRight,
  Merge,
  RefreshCw
} from 'lucide-react';
import type { SyncConflict, Task } from '@/lib/types';

interface ConflictResolutionProps {
  onConflictsResolved?: () => void;
}

interface ConflictDetails extends SyncConflict {
  localVersion: Task;
  externalVersion: Task;
}

export function ConflictResolution({ onConflictsResolved }: ConflictResolutionProps) {
  const [conflicts, setConflicts] = useState<ConflictDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictDetails | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch conflicts on component mount
  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/calendar/sync?action=conflicts');
      if (!response.ok) {
        throw new Error('Failed to fetch conflicts');
      }

      const data = await response.json();
      setConflicts(data.conflicts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conflicts');
    } finally {
      setLoading(false);
    }
  };

  const resolveConflict = async (
    conflictId: string, 
    resolution: 'local' | 'external' | 'merge',
    mergedData?: Partial<Task>
  ) => {
    try {
      setResolving(conflictId);
      setError(null);

      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resolve_conflict',
          conflictId,
          resolution,
          mergedData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflict');
      }

      // Remove resolved conflict from list
      setConflicts(prev => prev.filter(c => c.id !== conflictId));
      setSelectedConflict(null);
      
      onConflictsResolved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve conflict');
    } finally {
      setResolving(null);
    }
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const getConflictTypeColor = (fields: string[]) => {
    if (fields.includes('title')) return 'bg-red-100 text-red-800 border-red-200';
    if (fields.includes('scheduledAt')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const TaskVersionCard = ({ 
    task, 
    label, 
    icon: Icon,
    onSelect,
    isSelected,
    disabled 
  }: {
    task: Task;
    label: string;
    icon: React.ElementType;
    onSelect: () => void;
    isSelected?: boolean;
    disabled?: boolean;
  }) => (
    <Card className={`cursor-pointer transition-all ${
      isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
          <Button
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={onSelect}
            disabled={disabled}
          >
            {isSelected ? 'Selected' : 'Select'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="font-medium text-sm text-muted-foreground">Title</h4>
          <p className="text-sm">{task.title}</p>
        </div>
        
        {task.description && (
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Description</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          </div>
        )}

        {task.scheduledAt && (
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Scheduled</h4>
            <div className="flex items-center space-x-2 text-sm">
              <Calendar className="h-3 w-3" />
              <span>{formatDateTime(task.scheduledAt)}</span>
            </div>
          </div>
        )}

        {task.duration && (
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Duration</h4>
            <div className="flex items-center space-x-2 text-sm">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(task.duration)}</span>
            </div>
          </div>
        )}

        {task.location && (
          <div>
            <h4 className="font-medium text-sm text-muted-foreground">Location</h4>
            <div className="flex items-center space-x-2 text-sm">
              <MapPin className="h-3 w-3" />
              <span>{task.location}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last modified</span>
          <span>{formatDateTime(task.updatedAt || task.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );

  const ConflictDialog = ({ conflict }: { conflict: ConflictDetails }) => {
    const [selectedVersion, setSelectedVersion] = useState<'local' | 'external' | 'merge' | null>(null);

    return (
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span>Resolve Sync Conflict</span>
          </DialogTitle>
          <DialogDescription>
            Choose which version to keep or merge the changes. Conflicting fields: {conflict.conflictFields.join(', ')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <TaskVersionCard
              task={conflict.localVersion}
              label="Local Version"
              icon={User}
              onSelect={() => setSelectedVersion('local')}
              isSelected={selectedVersion === 'local'}
              disabled={resolving === conflict.id}
            />
            <TaskVersionCard
              task={conflict.externalVersion}
              label="External Version"  
              icon={Calendar}
              onSelect={() => setSelectedVersion('external')}
              isSelected={selectedVersion === 'external'}
              disabled={resolving === conflict.id}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Suggested Resolution</h4>
              <p className="text-sm text-muted-foreground">
                Based on the conflict analysis: <strong>{conflict.suggestedResolution}</strong>
              </p>
            </div>
            <Badge className={getConflictTypeColor(conflict.conflictFields)}>
              {conflict.conflictFields.length} field{conflict.conflictFields.length !== 1 ? 's' : ''} affected
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => resolveConflict(conflict.id, 'local')}
              disabled={resolving === conflict.id}
              className="flex-1"
            >
              {resolving === conflict.id ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowLeft className="h-4 w-4 mr-2" />
              )}
              Use Local
            </Button>
            <Button
              variant="outline"
              onClick={() => resolveConflict(conflict.id, 'external')}
              disabled={resolving === conflict.id}
              className="flex-1"
            >
              {resolving === conflict.id ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Use External
            </Button>
            <Button
              onClick={() => resolveConflict(conflict.id, conflict.suggestedResolution)}
              disabled={resolving === conflict.id}
              className="flex-1"
            >
              {resolving === conflict.id ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Use Suggested
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading Conflicts...</span>
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (conflicts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>No Conflicts</span>
          </CardTitle>
          <CardDescription>
            All calendar synchronization conflicts have been resolved.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sync Conflicts</h3>
          <p className="text-sm text-muted-foreground">
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} need{conflicts.length === 1 ? 's' : ''} resolution
          </p>
        </div>
        <Button variant="outline" onClick={fetchConflicts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {conflicts.map((conflict) => (
          <Card key={conflict.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">{conflict.localVersion.title}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {conflict.conflictFields.length} conflict{conflict.conflictFields.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Conflicting fields: {conflict.conflictFields.join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Suggested: {conflict.suggestedResolution}
                  </p>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Resolve
                    </Button>
                  </DialogTrigger>
                  <ConflictDialog conflict={conflict} />
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
