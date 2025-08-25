'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  UserPlus, 
  X, 
  Check, 
  Clock, 
  AlertCircle, 
  Send,
  Copy,
  Trash2,
  RefreshCw,
  Shield,
  Eye,
  Edit,
  Crown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { TeamRole, TeamInvitation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TeamInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  onInviteSent?: (emails: string[], role: TeamRole, message?: string) => Promise<void>;
  existingInvitations?: TeamInvitation[];
  onResendInvite?: (invitationId: string) => Promise<void>;
  onRevokeInvite?: (invitationId: string) => Promise<void>;
}

const roleConfig = {
  owner: { 
    label: 'Owner', 
    description: 'Full control over team and all workspaces',
    icon: Crown,
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400',
    disabled: true
  },
  admin: { 
    label: 'Admin', 
    description: 'Manage team members and workspace settings',
    icon: Shield,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400'
  },
  member: { 
    label: 'Member', 
    description: 'Create and manage tasks, collaborate on projects',
    icon: Edit,
    color: 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
  },
  viewer: { 
    label: 'Viewer', 
    description: 'View tasks and progress, cannot edit',
    icon: Eye,
    color: 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400'
  }
};

export function TeamInviteDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  onInviteSent,
  existingInvitations = [],
  onResendInvite,
  onRevokeInvite
}: TeamInviteDialogProps) {
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<TeamRole>('member');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = () => {
    const trimmedEmail = emailInput.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (emails.includes(trimmedEmail)) {
      setEmailError('Email is already added');
      return;
    }

    // Check if email is already invited
    const existingInvite = existingInvitations.find(inv => 
      inv.email.toLowerCase() === trimmedEmail && inv.status === 'pending'
    );
    
    if (existingInvite) {
      setEmailError('This email already has a pending invitation');
      return;
    }

    setEmails(prev => [...prev, trimmedEmail]);
    setEmailInput('');
    setEmailError('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(prev => prev.filter(email => email !== emailToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSendInvites = async () => {
    if (emails.length === 0) {
      toast({
        title: 'No emails to send',
        description: 'Please add at least one email address.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await onInviteSent?.(emails, selectedRole, inviteMessage.trim() || undefined);
      
      toast({
        title: 'Invitations sent!',
        description: `Successfully sent ${emails.length} invitation${emails.length > 1 ? 's' : ''} to join ${teamName}.`
      });

      // Reset form
      setEmails([]);
      setEmailInput('');
      setInviteMessage('');
      setSelectedRole('member');
      onOpenChange(false);
      
    } catch (error) {
      toast({
        title: 'Failed to send invitations',
        description: 'Please try again or contact support.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendInvite = async (invitationId: string, email: string) => {
    try {
      await onResendInvite?.(invitationId);
      toast({
        title: 'Invitation resent',
        description: `Resent invitation to ${email}.`
      });
    } catch (error) {
      toast({
        title: 'Failed to resend invitation',
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleRevokeInvite = async (invitationId: string, email: string) => {
    try {
      await onRevokeInvite?.(invitationId);
      toast({
        title: 'Invitation revoked',
        description: `Revoked invitation for ${email}.`
      });
    } catch (error) {
      toast({
        title: 'Failed to revoke invitation',
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const getInvitationStatusColor = (status: TeamInvitation['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'accepted':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      case 'declined':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const pendingInvitations = existingInvitations.filter(inv => inv.status === 'pending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Members
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Invite people to collaborate in <span className="font-medium">{teamName}</span>
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Email Input Section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Addresses</Label>
              <div className="flex gap-2 mt-2">
                <div className="flex-1">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError('');
                    }}
                    onKeyPress={handleKeyPress}
                    className={emailError ? 'border-destructive' : ''}
                  />
                  {emailError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {emailError}
                    </p>
                  )}
                </div>
                <Button 
                  onClick={handleAddEmail} 
                  variant="outline"
                  disabled={!emailInput.trim()}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            {/* Added Emails */}
            {emails.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Added emails ({emails.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {emails.map((email) => (
                      <motion.div
                        key={email}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Badge 
                          variant="secondary" 
                          className="pl-3 pr-2 py-1 flex items-center gap-2"
                        >
                          <Mail className="h-3 w-3" />
                          {email}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveEmail(email)}
                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Role Selection */}
          <div className="space-y-3">
            <Label>Role</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.entries(roleConfig) as [TeamRole, typeof roleConfig[TeamRole]][]).map(([role, config]) => {
                const Icon = config.icon;
                const isSelected = selectedRole === role;
                const isDisabled = config.disabled;

                return (
                  <Card 
                    key={role}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-md",
                      isSelected && "ring-2 ring-primary ring-offset-2 border-primary/50",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !isDisabled && setSelectedRole(role)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg", config.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{config.label}</h4>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {config.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message to your invitation..."
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Pending Invitations ({pendingInvitations.length})
                </Label>
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <div 
                      key={invitation.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{invitation.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="secondary" 
                              className={getInvitationStatusColor(invitation.status)}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {invitation.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {roleConfig[invitation.role].label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResendInvite(invitation.id, invitation.email)}
                          className="h-8"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevokeInvite(invitation.id, invitation.email)}
                          className="h-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvites}
              disabled={emails.length === 0 || isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invites
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}