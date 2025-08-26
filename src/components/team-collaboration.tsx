'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTeam } from '@/contexts/team-context';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users,
  MessageSquare,
  Bell,
  Eye,
  Edit3,
  CheckCircle2,
  Clock,
  UserPlus,
  UserMinus,
  Send,
  Activity,
  Calendar,
  FileText,
  Target,
  AlertCircle,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import type { TeamMember } from '@/lib/types';

interface TeamCollaborationProps {
  workspaceId: string;
}

interface ActivityItem {
  id: string;
  type: 'task_created' | 'task_assigned' | 'task_completed' | 'member_joined' | 'member_left' | 'workspace_created' | 'comment_added';
  userId: string;
  userName?: string;
  userAvatar?: string;
  timestamp: Date;
  data: any;
  workspaceId: string;
}

interface OnlineUser {
  userId: string;
  userName?: string;
  userAvatar?: string;
  lastSeen: Date;
  currentView?: string;
  isTyping?: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  message: string;
  timestamp: Date;
  workspaceId: string;
  type: 'message' | 'system';
}

export default function TeamCollaboration({ workspaceId }: TeamCollaborationProps) {
  const { user } = useAuth();
  const { teamMembers, currentWorkspace } = useTeam();
  
  // State
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Simulate real-time updates (in production, these would come from Firestore)
  useEffect(() => {
    // Simulate online users
    const simulatedOnlineUsers: OnlineUser[] = teamMembers
      .filter(member => Math.random() > 0.3) // Simulate some users being online
      .map(member => ({
        userId: member.userId,
        userName: member.userName,
        userAvatar: member.userAvatar,
        lastSeen: new Date(Date.now() - Math.random() * 300000), // Last seen within 5 minutes
        currentView: Math.random() > 0.5 ? 'tasks' : 'workspace',
      }));
    
    setOnlineUsers(simulatedOnlineUsers);

    // Simulate recent activity
    const simulatedActivity: ActivityItem[] = [
      {
        id: '1',
        type: 'task_assigned',
        userId: 'user1@example.com',
        userName: 'Alice Johnson',
        timestamp: new Date(Date.now() - 300000),
        data: { taskTitle: 'Review Project Proposal', assigneeName: 'Bob Smith' },
        workspaceId,
      },
      {
        id: '2',
        type: 'task_completed',
        userId: 'user2@example.com',
        userName: 'Bob Smith',
        timestamp: new Date(Date.now() - 600000),
        data: { taskTitle: 'Update Documentation' },
        workspaceId,
      },
      {
        id: '3',
        type: 'member_joined',
        userId: 'user3@example.com',
        userName: 'Carol Davis',
        timestamp: new Date(Date.now() - 900000),
        data: {},
        workspaceId,
      },
      {
        id: '4',
        type: 'workspace_created',
        userId: user?.email || '',
        userName: user?.email?.split('@')[0],
        timestamp: new Date(Date.now() - 1200000),
        data: { workspaceName: currentWorkspace?.name },
        workspaceId,
      },
    ];
    
    setRecentActivity(simulatedActivity);

    // Simulate chat messages
    const simulatedMessages: ChatMessage[] = [
      {
        id: '1',
        userId: 'user1@example.com',
        userName: 'Alice Johnson',
        message: 'Hey team! Just assigned the project proposal review to Bob.',
        timestamp: new Date(Date.now() - 300000),
        workspaceId,
        type: 'message',
      },
      {
        id: '2',
        userId: 'user2@example.com',
        userName: 'Bob Smith',
        message: 'Thanks Alice! I\'ll get started on it right away.',
        timestamp: new Date(Date.now() - 290000),
        workspaceId,
        type: 'message',
      },
      {
        id: '3',
        userId: 'system',
        message: 'Carol Davis joined the workspace',
        timestamp: new Date(Date.now() - 280000),
        workspaceId,
        type: 'system',
      },
    ];
    
    setChatMessages(simulatedMessages);
  }, [teamMembers, workspaceId, currentWorkspace, user]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle typing indicators
  const handleMessageChange = (value: string) => {
    setNewMessage(value);
    
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      // In production, emit typing start event to Firestore
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // In production, emit typing stop event to Firestore
    }, 2000);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !user) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: user.email || '',
      userName: user.email?.split('@')[0],
      userAvatar: undefined,
      message: newMessage.trim(),
      timestamp: new Date(),
      workspaceId,
      type: 'message',
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
    setIsTyping(false);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // In production, send message to Firestore
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'task_created': return FileText;
      case 'task_assigned': return Target;
      case 'task_completed': return CheckCircle2;
      case 'member_joined': return UserPlus;
      case 'member_left': return UserMinus;
      case 'workspace_created': return Zap;
      case 'comment_added': return MessageSquare;
      default: return Activity;
    }
  };

  const getActivityMessage = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'task_created':
        return `created task "${activity.data.taskTitle}"`;
      case 'task_assigned':
        return `assigned "${activity.data.taskTitle}" to ${activity.data.assigneeName}`;
      case 'task_completed':
        return `completed task "${activity.data.taskTitle}"`;
      case 'member_joined':
        return 'joined the workspace';
      case 'member_left':
        return 'left the workspace';
      case 'workspace_created':
        return `created workspace "${activity.data.workspaceName}"`;
      case 'comment_added':
        return `commented on "${activity.data.taskTitle}"`;
      default:
        return 'performed an action';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Online Members & Activity */}
      <div className="space-y-6">
        {/* Online Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-green-500" />
              <span>Online Now</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                {onlineUsers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <AnimatePresence>
                {onlineUsers.map((user, index) => (
                  <motion.div
                    key={user.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.userAvatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.userName || user.userId.split('@')[0]}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>Viewing {user.currentView}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(user.lastSeen, { addSuffix: true })}</span>
                      </div>
                    </div>
                    {user.isTyping && (
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {onlineUsers.length === 0 && (
                <div className="text-center py-4">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">No one else online</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                <AnimatePresence>
                  {recentActivity.map((activity, index) => {
                    const ActivityIcon = getActivityIcon(activity.type);
                    
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <ActivityIcon className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">
                              {activity.userName || activity.userId.split('@')[0]}
                            </span>{' '}
                            <span className="text-muted-foreground">
                              {getActivityMessage(activity)}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Team Chat */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Team Chat</span>
            {typingUsers.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {typingUsers.length} typing...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Chat Messages */}
          <ScrollArea className="flex-1 h-96 mb-4">
            <div className="space-y-4">
              <AnimatePresence>
                {chatMessages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.02 }}
                    className={`flex ${message.type === 'system' ? 'justify-center' : 'items-start space-x-3'}`}
                  >
                    {message.type === 'system' ? (
                      <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        {message.message}
                      </div>
                    ) : (
                      <>
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={message.userAvatar} />
                          <AvatarFallback className="text-xs">
                            {getInitials(message.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="text-sm font-medium">
                              {message.userName || message.userId.split('@')[0]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(message.timestamp, 'HH:mm')}
                            </p>
                          </div>
                          <div className="bg-muted/30 rounded-lg px-3 py-2">
                            <p className="text-sm">{message.message}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Typing Indicators */}
          {typingUsers.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>
                  {typingUsers.length === 1 
                    ? `${typingUsers[0]} is typing...`
                    : `${typingUsers.length} people are typing...`
                  }
                </span>
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => handleMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
