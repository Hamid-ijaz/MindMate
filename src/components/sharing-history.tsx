"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  Users, 
  Eye, 
  Edit3, 
  Clock, 
  Activity, 
  UserCheck, 
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  Share2,
  Link2,
  Trash2
} from 'lucide-react';
import { sharingService } from '@/lib/firestore';
import { useAuth } from '@/contexts/auth-context';
import type { SharedItem, ShareHistoryEntry } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { safeDateFormat } from '@/lib/utils';

interface SharingHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'task' | 'note';
  itemTitle: string;
}

export function SharingHistory({ isOpen, onClose, itemId, itemType, itemTitle }: SharingHistoryProps) {
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedShare, setSelectedShare] = useState<SharedItem | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user?.email) {
      loadSharingData();
    }
  }, [isOpen, user?.email, itemId]);

  const loadSharingData = async () => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const items = await sharingService.getSharedItemsByOwner(user.email);
      const itemShares = items.filter(item => item.itemId === itemId);
      setSharedItems(itemShares);
      
      if (itemShares.length > 0) {
        setSelectedShare(itemShares[0]);
      }
    } catch (error) {
      console.error('Error loading sharing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'viewed_item':
        return <Eye className="h-4 w-4" />;
      case 'updated_field':
      case 'edited_title':
      case 'edited_description':
        return <Edit3 className="h-4 w-4" />;
      case 'marked_complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'marked_incomplete':
        return <XCircle className="h-4 w-4 text-orange-600" />;
      case 'added_subtask':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'link_created':
        return <Link2 className="h-4 w-4 text-purple-600" />;
      case 'permission_changed':
        return <UserCheck className="h-4 w-4 text-indigo-600" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'viewed_item':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
      case 'updated_field':
      case 'edited_title':
      case 'edited_description':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950';
      case 'marked_complete':
        return 'text-green-600 bg-green-50 dark:bg-green-950';
      case 'marked_incomplete':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950';
      case 'added_subtask':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
      case 'link_created':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950';
      case 'permission_changed':
        return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950';
    }
  };

  const aggregateStats = () => {
    const allHistory = sharedItems.flatMap(item => item.history || []);
    
    const stats = {
      totalViews: allHistory.filter(h => h.action === 'viewed_item').length,
      totalEdits: allHistory.filter(h => h.action.includes('updated') || h.action.includes('edited')).length,
      uniqueUsers: new Set(allHistory.filter(h => h.userId).map(h => h.userId)).size,
      anonymousViews: allHistory.filter(h => h.action === 'viewed_item' && !h.userId).length,
      lastActivity: allHistory.length > 0 ? Math.max(...allHistory.map(h => h.timestamp)) : null
    };
    
    return stats;
  };

  const stats = aggregateStats();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Sharing History - "{itemTitle}"
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Stats Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Activity Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Views</span>
                  <Badge variant="outline">{stats.totalViews}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Edits</span>
                  <Badge variant="outline">{stats.totalEdits}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Unique Users</span>
                  <Badge variant="outline">{stats.uniqueUsers}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Anonymous Views</span>
                  <Badge variant="outline">{stats.anonymousViews}</Badge>
                </div>
                {stats.lastActivity && (
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Last activity: {formatTimeAgo(stats.lastActivity)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Shares */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Active Shares</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  </div>
                ) : sharedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No shares found
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sharedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedShare?.id === item.id 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedShare(item)}
                      >
                        <div className="flex items-center justify-between">
                          <Badge 
                            variant={item.permission === 'edit' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {item.permission === 'edit' ? (
                              <Edit3 className="h-3 w-3 mr-1" />
                            ) : (
                              <Eye className="h-3 w-3 mr-1" />
                            )}
                            {item.permission}
                          </Badge>
                          {!item.isActive && (
                            <Badge variant="destructive" className="text-xs">
                              Revoked
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {formatTimeAgo(item.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(item.history || []).length} activities
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Activity Timeline */}
          <div className="lg:col-span-2">
            <Card className="h-[500px]">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Activity Timeline
                  {selectedShare && (
                    <Badge variant="outline" className="ml-2">
                      {selectedShare.permission} access
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px] px-6">
                  {!selectedShare ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a share to view its activity</p>
                      </div>
                    </div>
                  ) : (selectedShare.history || []).length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No activity recorded yet</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-6">
                      {selectedShare.history
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((entry, index) => (
                        <motion.div
                          key={`${entry.id}-${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex gap-3"
                        >
                          <div className={`p-2 rounded-full flex-shrink-0 ${getActionColor(entry.action)}`}>
                            {getActionIcon(entry.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </p>
                                {entry.details && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {entry.details}
                                  </p>
                                )}
                                {entry.fieldChanged && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    <span className="font-mono bg-muted px-1 rounded">
                                      {entry.fieldChanged}
                                    </span>
                                    {entry.oldValue && entry.newValue && (
                                      <>
                                        : "{entry.oldValue.toString()}" → "{entry.newValue.toString()}"
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  {formatTimeAgo(entry.timestamp)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {safeDateFormat(entry.timestamp, 'MMM d, HH:mm', 'Invalid date')}
                                </p>
                              </div>
                            </div>
                            {entry.userName && (
                              <div className="flex items-center gap-1 mt-1">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  by {entry.userName}
                                </span>
                              </div>
                            )}
                            {entry.userId && !entry.userName && (
                              <div className="flex items-center gap-1 mt-1">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground font-mono">
                                  {entry.userId}
                                </span>
                              </div>
                            )}
                            {!entry.userId && (
                              <div className="flex items-center gap-1 mt-1">
                                <Eye className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Anonymous user
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
