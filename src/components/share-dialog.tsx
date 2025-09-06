"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Share2, 
  Copy, 
  Eye, 
  Edit3, 
  Users, 
  Settings, 
  BarChart3,
  Clock,
  Shield,
  Link2,
  Plus,
  X,
  RefreshCw,
  Download,
  MessageSquare,
  History,
  Globe,
  Trash2,
  Check,
  AlertTriangle,
  Activity,
  UserPlus,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { sharingService, userService } from '@/lib/firestore';
import type { SharedItem, SharePermission, ShareHistoryEntry, ShareAnalytics, ShareCollaborator } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'task' | 'note';
  itemTitle: string;
  itemId: string;
}

export function ShareDialog({ isOpen, onClose, itemType, itemTitle, itemId }: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState('share');
  const [permission, setPermission] = useState<SharePermission>('view');
  const [shareLink, setShareLink] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shareHistory, setShareHistory] = useState<ShareHistoryEntry[]>([]);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorPermission, setCollaboratorPermission] = useState<SharePermission>('view');
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [analytics, setAnalytics] = useState<ShareAnalytics | null>(null);
  const [shareSettings, setShareSettings] = useState({
    allowComments: true,
    allowDownload: true,
    expiresAt: undefined as number | undefined,
  });
  const [currentShareToken, setCurrentShareToken] = useState<string>('');
  
  const { toast } = useToast();
  const { user } = useAuth();

  // Load existing shared items on dialog open
  useEffect(() => {
    if (isOpen && user?.email) {
      loadSharedItems();
    }
  }, [isOpen, user?.email, itemId]);

  // Load analytics when share link exists
  useEffect(() => {
    if (currentShareToken && activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [currentShareToken, activeTab]);

  const loadSharedItems = async () => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const items = await sharingService.getSharedItemsByOwner(user.email);
      const itemShares = items.filter(item => item.itemId === itemId);
      setSharedItems(itemShares);
      
      // Aggregate history from all shares
      const allHistory = itemShares.flatMap(item => item.history || []);
      const sortedHistory = allHistory.sort((a, b) => b.timestamp - a.timestamp);
      setShareHistory(sortedHistory);
      
      // Set existing share link if available
      const existingShare = itemShares.find(item => item.isActive);
      if (existingShare) {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const url = `${baseUrl}/share/${itemType}/${itemId}?token=${existingShare.shareToken}&permission=${existingShare.permission}`;
        setShareLink(url);
        setPermission(existingShare.permission);
        setCurrentShareToken(existingShare.shareToken);
        setShareSettings({
          allowComments: existingShare.allowComments ?? true,
          allowDownload: existingShare.allowDownload ?? true,
          expiresAt: existingShare.expiresAt || undefined,
        });
      }
    } catch (error) {
      console.error('Error loading shared items:', error);
      toast({
        title: "Error",
        description: "Failed to load sharing information",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!currentShareToken) return;
    
    try {
      const analyticsData = await sharingService.getShareAnalytics(currentShareToken);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "destructive"
      });
    }
  };

  const generateShareLink = async () => {
    if (!user?.email) return;
    
    setIsGeneratingLink(true);
    try {
      const result = await sharingService.createOrGetShareLink(
        itemId,
        itemType,
        user.email,
        permission
      );
      
      setShareLink(result.url);
      setCurrentShareToken(result.shareToken);
      
      toast({ 
        title: result.isNew ? "Share link created!" : "Share link retrieved!",
        description: result.isNew ? "Your share link has been generated" : "Using existing share link with same permissions"
      });
      
      // Reload shared items to update the list
      await loadSharedItems();
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: "Error",
        description: "Failed to generate share link",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) {
      toast({
        title: "Nothing to copy",
        description: "No share link available",
        variant: "destructive"
      });
      return;
    }

    // Ensure we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof document === 'undefined') {
      toast({
        title: "Copy not available",
        description: "Clipboard functionality is not available",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if clipboard API is available and supported
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast({ title: "Link copied to clipboard!" });
        return;
      }

      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      textArea.setAttribute('readonly', '');
      textArea.setAttribute('contenteditable', 'true');
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        toast({ title: "Link copied to clipboard!" });
        return;
      }
      
      // If we get here, copying failed
      throw new Error('Copy command failed');
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      
      // Final fallback - show the text for manual copying
      toast({
        title: "Copy failed",
        description: "Please copy the link manually from the input field",
        variant: "destructive"
      });
    }
  };

  const addCollaborator = async () => {
    if (!collaboratorEmail.trim()) return;

    setIsAddingCollaborator(true);
    try {
      // Ensure there's a share token. If not, create one automatically so collaborator can be added.
      if (!currentShareToken) {
        if (!user?.email) {
          toast({ title: 'Sign in required', description: 'You must be signed in to share items', variant: 'destructive' });
          setIsAddingCollaborator(false);
          return;
        }

        try {
          const result = await sharingService.createOrGetShareLink(
            itemId,
            itemType,
            user.email,
            permission
          );
          setShareLink(result.url);
          setCurrentShareToken(result.shareToken);
          toast({ title: result.isNew ? 'Share link created' : 'Using existing share link' });
          // reload shared items to reflect new link
          await loadSharedItems();
        } catch (linkError) {
          console.error('Failed to create share link before adding collaborator:', linkError);
          toast({ title: 'Error', description: 'Failed to create share link', variant: 'destructive' });
          setIsAddingCollaborator(false);
          return;
        }
      }

      // Check if user exists
      const userExists = await userService.userExists?.(collaboratorEmail.trim());
      if (!userExists) {
        toast({
          title: "User not found",
          description: "The user needs to create an account first",
          variant: "destructive"
        });
        return;
      }

      // If collaborator requires 'edit' but the share's base permission is 'view', upgrade the share permission
      try {
        const currentShare = sharedItems.find(item => item.shareToken === currentShareToken || item.isActive);
        const currentBasePermission = currentShare?.permission || permission;
        if (collaboratorPermission === 'edit' && currentBasePermission === 'view') {
          await sharingService.updateSharePermission(currentShareToken, 'edit');
          setPermission('edit');
          // Update shareLink's permission query param if present
          if (shareLink) {
            try {
              const baseUrl = shareLink.split('?')[0];
              const newUrl = `${baseUrl}?token=${currentShareToken}&permission=edit`;
              setShareLink(newUrl);
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (permError) {
        console.error('Failed to update share permission before adding collaborator:', permError);
      }

      await sharingService.addCollaborator(
        currentShareToken,
        collaboratorEmail.trim(),
        collaboratorPermission,
        user?.email || ''
      );
      
      // Send email notification about the shared item
      try {
        await fetch('/api/email/share-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientEmail: collaboratorEmail.trim(),
            sharedItemId: itemId,
            sharedItemTitle: itemTitle,
            sharedItemType: itemType,
            sharedByEmail: user?.email,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send share notification email:', emailError);
        // Don't fail the sharing if email fails
      }
      
      const addedEmail = collaboratorEmail.trim();
      setCollaboratorEmail('');
      toast({
        title: "Collaborator added!",
        description: `${addedEmail} has been added with ${collaboratorPermission} permission. They'll receive an email notification.`
      });

      // Optimistically update local state for the matching share so collaborator appears immediately
      setSharedItems(prev => {
        // Try to find by currentShareToken first, then by itemId, then fallback to any active share
        const idxByToken = currentShareToken ? prev.findIndex(item => item.shareToken === currentShareToken) : -1;
        const idxByItem = prev.findIndex(item => item.itemId === itemId);
        const idxActive = prev.findIndex(item => item.isActive);
        const idx = idxByToken !== -1 ? idxByToken : (idxByItem !== -1 ? idxByItem : idxActive);
        if (idx === -1) return prev;
        const updated = [...prev];
        const curr = { ...updated[idx] } as any;
        const newCollab = {
          email: addedEmail,
          name: addedEmail.split('@')[0],
          permission: collaboratorPermission,
          addedAt: Date.now(),
          addedBy: user?.email || ''
        };
        curr.collaborators = Array.isArray(curr.collaborators) ? [...curr.collaborators, newCollab] : [newCollab];
        updated[idx] = curr;
        return updated;
      });

      // Reload from server to ensure fresh state
      await loadSharedItems();
    } catch (error) {
      console.error('Error adding collaborator:', error);
      toast({
        title: "Error",
        description: "Failed to add collaborator",
        variant: "destructive"
      });
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const removeCollaborator = async (collaboratorEmail: string) => {
    if (!currentShareToken) return;
    
    try {
      await sharingService.removeCollaborator(currentShareToken, collaboratorEmail, user?.email || '');
      toast({
        title: "Collaborator removed",
        description: `${collaboratorEmail} has been removed from collaborators`
      });
      await loadSharedItems();
    } catch (error) {
      console.error('Error removing collaborator:', error);
      toast({
        title: "Error",
        description: "Failed to remove collaborator",
        variant: "destructive"
      });
    }
  };

  const updatePermission = async (newPermission: SharePermission) => {
    if (!currentShareToken) return;
    
    try {
      await sharingService.updateSharePermission(currentShareToken, newPermission);
      setPermission(newPermission);
      
      // Update the URL with new permission
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const newUrl = `${baseUrl}/share/${itemType}/${itemId}?token=${currentShareToken}&permission=${newPermission}`;
      setShareLink(newUrl);
      
      toast({
        title: "Permission updated!",
        description: `Share permission changed to ${newPermission}`
      });
      
      await loadSharedItems();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive"
      });
    }
  };

  const regenerateLink = async () => {
    if (!currentShareToken) return;
    
    try {
      const newToken = await sharingService.regenerateShareToken(currentShareToken);
      setCurrentShareToken(newToken);
      
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const newUrl = `${baseUrl}/share/${itemType}/${itemId}?token=${newToken}&permission=${permission}`;
      setShareLink(newUrl);
      
      toast({
        title: "Link regenerated!",
        description: "Your share link has been updated for security"
      });
      
      await loadSharedItems();
    } catch (error) {
      console.error('Error regenerating link:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate link",
        variant: "destructive"
      });
    }
  };

  const revokeAccess = async () => {
    if (!currentShareToken) return;
    
    try {
      await sharingService.revokeShareAccess(currentShareToken);
      setShareLink('');
      setCurrentShareToken('');
      
      toast({
        title: "Access revoked!",
        description: "The share link has been deactivated"
      });
      
      await loadSharedItems();
    } catch (error) {
      console.error('Error revoking access:', error);
      toast({
        title: "Error",
        description: "Failed to revoke access",
        variant: "destructive"
      });
    }
  };

  const updateSettings = async (newSettings: Partial<typeof shareSettings>) => {
    if (!currentShareToken) return;
    
    try {
      await sharingService.updateShareSettings(currentShareToken, newSettings);
      setShareSettings(prev => ({ ...prev, ...newSettings }));
      
      toast({
        title: "Settings updated!",
        description: "Share settings have been saved"
      });
      
      await loadSharedItems();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    }
  };

  const renderShareTab = () => (
    <div className="space-y-6">
      {/* Permission Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">Access Level</Label>
          <p className="text-sm text-muted-foreground mb-3">Choose who can do what with your shared {itemType}</p>
        </div>
        
        <div className="grid gap-3 px-1"> {/* Added padding to prevent clipping */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              permission === 'view' 
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setPermission('view')}
          >
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 mt-0.5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">View Access</h3>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 flex-shrink-0">
                    Safe
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  People can view and read the {itemType} but cannot make changes
                </p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              permission === 'edit' 
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setPermission('edit')}
          >
            <div className="flex items-start gap-3">
              <Edit3 className="w-5 h-5 mt-0.5 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">Edit Access</h3>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 flex-shrink-0">
                    Collaborative
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  People can view, edit, and make changes to the {itemType}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Generate/Update Link */}
      <div className="space-y-4">
        {!shareLink ? (
          <Button
            onClick={generateShareLink}
            disabled={isGeneratingLink}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isGeneratingLink ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating Link...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 mr-2" />
                Create Share Link
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Link Display */}
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="flex-1 bg-muted/30 font-mono text-sm"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('Copy button clicked with shareLink:', shareLink);
                    copyToClipboard(shareLink);
                  }}
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Copy link to clipboard"
                  disabled={!shareLink}
                >
                  {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Select
                value={permission}
                onValueChange={(value: SharePermission) => updatePermission(value)}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Access</SelectItem>
                  <SelectItem value="edit">Edit Access</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                onClick={regenerateLink}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                New Link
              </Button>
              
              <Button
                onClick={revokeAccess}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Revoke
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Current Share Info */}
      {currentShareToken && sharedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Share Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sharedItems.filter(item => item.isActive).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <div>
                    <p className="font-medium">Active Share</p>
                    <p className="text-sm text-muted-foreground">
                      {item.viewCount} views • Created {formatDistanceToNow(item.createdAt)} ago
                    </p>
                  </div>
                </div>
                <Badge variant={item.permission === 'edit' ? 'default' : 'secondary'}>
                  {item.permission}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCollaboratorsTab = () => {
    const currentShare = sharedItems.find(item => item.isActive);
    const collaborators = currentShare?.collaborators || [];
    
    return (
      <div className="space-y-6">
        {/* Add Collaborator */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Add Collaborator</Label>
            <p className="text-sm text-muted-foreground">
              Give specific people access to your {itemType}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              value={collaboratorEmail}
              onChange={(e) => setCollaboratorEmail(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addCollaborator();
                }
              }}
            />
            <Select
              value={collaboratorPermission}
              onValueChange={(value: SharePermission) => setCollaboratorPermission(value)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={addCollaborator}
              disabled={!collaboratorEmail.trim() || isAddingCollaborator}
              size="icon"
            >
              {isAddingCollaborator ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Collaborators List */}
        {collaborators.length > 0 && (
          <div className="space-y-4">
            <Label className="text-base font-medium">Collaborators ({collaborators.length})</Label>
            <div className="space-y-2">
              {collaborators.map((collaborator) => (
                <motion.div
                  key={collaborator.email}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">{collaborator.name || collaborator.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Added {formatDistanceToNow(collaborator.addedAt)} ago
                        {collaborator.lastAccessAt && (
                          <> • Last active {formatDistanceToNow(collaborator.lastAccessAt)} ago</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={collaborator.permission === 'edit' ? 'default' : 'secondary'}>
                      {collaborator.permission}
                    </Badge>
                    <Button
                      onClick={() => removeCollaborator(collaborator.email)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        
        {collaborators.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No collaborators yet</p>
            <p className="text-sm">Add people to collaborate on this {itemType}</p>
          </div>
        )}
      </div>
    );
  };

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      {analytics ? (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{analytics.totalViews}</p>
                    <p className="text-sm text-muted-foreground">Total Views</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{analytics.uniqueViewers}</p>
                    <p className="text-sm text-muted-foreground">Unique Viewers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{analytics.totalEdits}</p>
                    <p className="text-sm text-muted-foreground">Total Edits</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">{analytics.uniqueEditors}</p>
                    <p className="text-sm text-muted-foreground">Contributors</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Actions */}
          {analytics.topActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.topActions.map((action, index) => (
                    <div key={action.action} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{action.action.replace('_', ' ')}</span>
                      <Badge variant="outline">{action.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          {analytics.recentActivity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 max-h-48">
                  <div className="space-y-3 pr-4">
                    {analytics.recentActivity.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
                        <Activity className="w-4 h-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">
                              {entry.userName || 'Anonymous User'}
                            </span>
                            {' '}{entry.details || entry.action}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(entry.timestamp)} ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No analytics available</p>
          <p className="text-sm">Create a share link to start tracking activity</p>
        </div>
      )}
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">Share Settings</Label>
          <p className="text-sm text-muted-foreground">
            Control how people can interact with your shared {itemType}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow-comments">Allow Comments</Label>
              <p className="text-sm text-muted-foreground">
                Let people add comments to your {itemType}
              </p>
            </div>
            <Switch
              id="allow-comments"
              checked={shareSettings.allowComments}
              onCheckedChange={(checked) => 
                updateSettings({ allowComments: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow-download">Allow Download</Label>
              <p className="text-sm text-muted-foreground">
                Let people duplicate this {itemType} to their account
              </p>
            </div>
            <Switch
              id="allow-download"
              checked={shareSettings.allowDownload}
              onCheckedChange={(checked) => 
                updateSettings({ allowDownload: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Expiration Settings */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-medium">Link Expiration</Label>
          <p className="text-sm text-muted-foreground">
            Set when this share link should stop working
          </p>
        </div>

        <Select
          value={shareSettings.expiresAt ? 'custom' : 'never'}
          onValueChange={(value) => {
            if (value === 'never') {
              updateSettings({ expiresAt: undefined });
            } else if (value === '7d') {
              const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
              updateSettings({ expiresAt });
            } else if (value === '30d') {
              const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
              updateSettings({ expiresAt });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="never">Never expires</SelectItem>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="custom">Custom date</SelectItem>
          </SelectContent>
        </Select>

        {shareSettings.expiresAt && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Link expires on {format(shareSettings.expiresAt, 'PPP')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{itemTitle}"
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0 mb-4">
            <TabsTrigger value="share" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </TabsTrigger>
            <TabsTrigger value="collaborators" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">People</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="pr-4 pb-8">
                <TabsContent value="share" className="mt-0 space-y-6">
                  {renderShareTab()}
                </TabsContent>

                <TabsContent value="collaborators" className="mt-0 space-y-6">
                  {renderCollaboratorsTab()}
                </TabsContent>

                <TabsContent value="analytics" className="mt-0 space-y-6">
                  {renderAnalyticsTab()}
                </TabsContent>

                <TabsContent value="settings" className="mt-0 space-y-6">
                  {renderSettingsTab()}
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
