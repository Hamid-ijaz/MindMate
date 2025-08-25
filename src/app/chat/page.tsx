
"use client";

import React, { useState, useRef, useEffect, useTransition, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { chat } from '@/ai/flows/chat-flow';
import { chatService } from '@/lib/firestore';
import type { Task, ChatMessage, ChatSession, ChatContext, QuickAction, TaskReference, SuggestedTask } from '@/lib/types';
import { 
  Send, 
  Loader2, 
  PlusCircle, 
  Check, 
  Clock, 
  AlertCircle, 
  Calendar,
  Target,
  Zap,
  Brain,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Edit3,
  Play,
  CheckCircle
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  pageVariants, 
  chatMessageVariants, 
  chatInputVariants,
  quickActionVariants,
  chatContainerVariants,
  suggestedTaskVariants,
  typingIndicatorVariants
} from '@/lib/animations';
import { formatDistanceToNow } from 'date-fns';

interface EnhancedChatMessage extends ChatMessage {
  isTyping?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'list_overdue', label: 'Show Overdue', action: 'list_overdue', icon: 'AlertCircle' },
  { id: 'suggest_priorities', label: 'Suggest Priorities', action: 'suggest_priorities', icon: 'Target' },
  { id: 'plan_day', label: 'Plan Today', action: 'plan_day', icon: 'Calendar' },
  { id: 'review_progress', label: 'Review Progress', action: 'review_progress', icon: 'CheckCircle' },
];

const iconMap = {
  AlertCircle,
  Target,
  Calendar,
  CheckCircle,
  Clock,
  Brain,
  Zap,
  MessageSquare
};

export default function EnhancedChatPage() {
  // Delete a chat session and its messages
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await chatService.deleteSession(sessionId);
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      const allSessions = await chatService.getChatSessions(user?.email ?? '');
      setSessions(allSessions);
      toast({ title: 'Deleted', description: 'Chat session deleted.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete session.', variant: 'destructive' });
    }
  };

  // Delete all messages in the current session
  const handleDeleteChatHistory = async () => {
    if (!currentSession) return;
    if (!window.confirm('Delete all chat history for this session?')) return;
    try {
      await chatService.deleteSession(currentSession.id);
      setMessages([]);
      const allSessions = await chatService.getChatSessions(user?.email ?? '');
      setSessions(allSessions);
      toast({ title: 'Deleted', description: 'Chat history deleted.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete chat history.', variant: 'destructive' });
    }
  };
  const { tasks, addTask, updateTask, accomplishments, taskCategories, taskDurations, isLoading: tasksLoading } = useTasks();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Chat state
  const [messages, setMessages] = useState<EnhancedChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isMultiline, setIsMultiline] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set());
  const [sessionLoading, setSessionLoading] = useState(false);
  
  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize chat session
  useEffect(() => {
    const init = async () => {
      if (user?.email) {
        if (!currentSession) {
          await initializeChatSession();
        }
        const allSessions = await chatService.getChatSessions(user.email);
        setSessions(allSessions);
      }
    };
    init();
  }, [user, currentSession]);

  const initializeChatSession = async () => {
    if (!user?.email) return;
    
    setSessionLoading(true);
    try {
      // Try to get existing active session
      let session = await chatService.getActiveSession(user.email);
      
      if (!session) {
        // Create new session
        const sessionId = await chatService.createChatSession(user.email, 'Chat with MindMate');
        session = {
          id: sessionId,
          userEmail: user.email,
          title: 'Chat with MindMate',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
          isActive: true,
        };
      }
      
      setCurrentSession(session);
      
      // Load existing messages
      if (session.messageCount > 0) {
        const { messages: sessionMessages } = await chatService.getSessionMessages(session.id);
        setMessages(sessionMessages);
      } else {
        // Add welcome message for new sessions
        const welcomeMessage: EnhancedChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content: "Hello! I'm MindMate, your AI task companion. I'm here to help you manage your tasks, break down complex projects, and stay motivated. How can I help you today?",
          timestamp: Date.now(),
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Error initializing chat session:', error);
      toast({
        title: "Chat Error",
        description: "Failed to initialize chat session. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setSessionLoading(false);
    }
  };

  // Build comprehensive chat context
  const chatContext = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const completedTasks = tasks.filter(t => t.completedAt && t.completedAt > oneWeekAgo).length;
    const createdTasks = tasks.filter(t => t.createdAt > oneWeekAgo).length;
    const overdueTasks = tasks.filter(t => 
      !t.completedAt && 
      t.reminderAt && 
      t.reminderAt < now
    ).length;

    const chatTasks = tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      category: t.category,
      energyLevel: (t.priority === 'Low' ? 'Low' : t.priority === 'High' ? 'High' : 'Medium') as 'Low' | 'Medium' | 'High',
      duration: t.duration,
      timeOfDay: t.timeOfDay,
      completedAt: t.completedAt,
      parentId: t.parentId,
      priority: t.priority,
      createdAt: t.createdAt,
    }));

    return {
      tasks: chatTasks,
      categories: taskCategories,
      accomplishments: accomplishments?.slice(0, 5), // Recent accomplishments
      userSettings: {
        taskCategories,
        taskDurations,
      },
      recentActivity: {
        completedTasks,
        createdTasks,
        overdueTasksCount: overdueTasks,
      },
    };
  }, [tasks, taskCategories, taskDurations, accomplishments]);

  // Handle adding suggested tasks
  const handleAddTask = useCallback(async (suggestedTask: SuggestedTask) => {
    if (!user?.email || addedTasks.has(suggestedTask.title)) return;

    try {
      await addTask({
        title: suggestedTask.title,
        description: suggestedTask.description,
        category: suggestedTask.category || 'Personal',
        priority: suggestedTask.priority || 'Medium',
        duration: suggestedTask.duration || 30,
        timeOfDay: suggestedTask.timeOfDay || 'Afternoon',
        userEmail: user.email,
      });
      
      setAddedTasks(prev => new Set(prev).add(suggestedTask.title));
      
      // Note: Toast for task creation is handled by the task context
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task. Please try again.",
        variant: "destructive",
      });
    }
  }, [user?.email, addTask, addedTasks, toast]);

  // Handle quick actions
  const handleQuickAction = useCallback(async (action: QuickAction) => {
    const quickMessage = `Please ${action.label.toLowerCase()}`;
    await handleSendMessage(quickMessage);
  }, []);

  // Handle task references
  const handleTaskReference = useCallback(async (taskRef: TaskReference) => {
    const task = tasks.find(t => t.id === taskRef.taskId);
    if (!task) return;

    switch (taskRef.action) {
      case 'complete':
        // This would need to be implemented in the task context
        toast({
          title: "Task Action",
          description: `Action: ${taskRef.action} for "${task.title}"`,
        });
        break;
      case 'edit':
        toast({
          title: "Task Action", 
          description: `Action: ${taskRef.action} for "${task.title}"`,
        });
        break;
      default:
        toast({
          title: "Task Action",
          description: `Action: ${taskRef.action} for "${task.title}"`,
        });
    }
  }, [tasks, toast]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (messageText: string = input) => {
  console.log('handleSendMessage called', { messageText, user, currentSession, isPending });
  if (!messageText.trim() || !user?.email || !currentSession || isPending) return;

    const userMessage: EnhancedChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: Date.now(),
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsMultiline(false);

    // Add typing indicator
    const typingMessage: EnhancedChatMessage = {
      id: 'typing',
      role: 'assistant', 
      content: '',
      timestamp: Date.now(),
      isTyping: true,
    };
    setMessages(prev => [...prev, typingMessage]);

    startTransition(async () => {
      try {
        // Get recent conversation history
        const conversationHistory = messages.slice(-6).map(m => ({
          role: m.role,
          content: m.content,
        }));

        const result = await chat({
          message: messageText.trim(),
          context: {
            tasks: chatContext.tasks,
            categories: chatContext.categories,
            accomplishments: chatContext.accomplishments,
            userSettings: chatContext.userSettings,
            recentActivity: chatContext.recentActivity,
          },
          conversationHistory,
        });

        // Remove typing indicator and add AI response
        setMessages(prev => {
          const withoutTyping = prev.filter(m => m.id !== 'typing');
          const assistantMessage: EnhancedChatMessage = {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: result.response,
            timestamp: Date.now(),
            suggestedTasks: result.suggestedTasks ?? [],
            quickActions: result.quickActions,
            taskReferences: result.taskReferences ?? [],
          };
          return [...withoutTyping, assistantMessage];
        });

        // Save messages to Firestore
        await chatService.addMessage(currentSession.id, userMessage);
        await chatService.addMessage(currentSession.id, {
          role: 'assistant',
          content: result.response,
          timestamp: Date.now(),
          suggestedTasks: result.suggestedTasks ?? [],
          quickActions: result.quickActions,
          taskReferences: result.taskReferences ?? [],
        });

      } catch (error) {
        console.error("Chat error:", error);
        setMessages(prev => prev.filter(m => m.id !== 'typing'));
        toast({
          title: "AI Error",
          description: "Sorry, I couldn't get a response. Please try again.",
          variant: "destructive",
        });
      }
    });
  }, [input, user?.email, currentSession, isPending, messages, chatContext, toast]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
  e.preventDefault();
  console.log('handleSubmit called', { input });
  handleSendMessage();
  }, [handleSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        setIsMultiline(true);
      } else {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  }, [handleSubmit]);

  const renderMessage = useCallback((message: EnhancedChatMessage, index: number) => {
    const isUser = message.role === 'user';
    const IconComponent = iconMap[isUser ? 'Brain' : 'MessageSquare'];

    return (
      <motion.div
        key={message.id}
        className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}
        variants={chatMessageVariants}
        initial="initial"
        animate="animate"
        layout
      >
        {!isUser && (
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              M
            </AvatarFallback>
          </Avatar>
        )}
        
                        <div className={`flex flex-col max-w-[85%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`rounded-2xl px-4 py-3 shadow-sm ${
              isUser
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted/50 border rounded-bl-md'
            }`}
          >
            {message.isTyping ? (
              <motion.div
                className="flex items-center gap-1"
                variants={typingIndicatorVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
            )}
          </div>
          
          {/* Timestamp */}
          <span className="text-xs text-muted-foreground mt-1 px-1">
            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          </span>

          {/* Suggested Tasks */}
          {message.suggestedTasks && message.suggestedTasks.length > 0 && (
            <motion.div className="mt-3 space-y-2 w-full max-w-md" variants={chatContainerVariants}>
              <p className="text-sm font-medium text-muted-foreground mb-2">Suggested tasks:</p>
              {message.suggestedTasks.map((task, taskIndex) => {
                const isAdded = addedTasks.has(task.title);
                return (
                  <motion.div key={taskIndex} variants={suggestedTaskVariants}>
                    <Card className="bg-background/80 backdrop-blur-sm border shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {task.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {task.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {task.category}
                                </Badge>
                              )}
                              {task.duration && (
                                <Badge variant="outline" className="text-xs">
                                  {task.duration}m
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isAdded ? "secondary" : "default"}
                            onClick={() => !isAdded && handleAddTask(task)}
                            disabled={isAdded}
                            className="shrink-0"
                          >
                            {isAdded ? <Check className="h-3 w-3" /> : <PlusCircle className="h-3 w-3" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Quick Actions */}
          {message.quickActions && message.quickActions.length > 0 && (
            <motion.div className="mt-3 flex flex-wrap gap-2" variants={chatContainerVariants}>
              {message.quickActions.map((action) => {
                const IconComponent = iconMap[action.icon as keyof typeof iconMap] || Target;
                return (
                  <motion.div key={action.id} variants={quickActionVariants}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAction(action)}
                      className="text-xs h-8"
                    >
                      <IconComponent className="h-3 w-3 mr-1" />
                      {action.label}
                    </Button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Task References */}
          {message.taskReferences && message.taskReferences.length > 0 && (
            <motion.div className="mt-3 space-y-2 w-full max-w-md" variants={chatContainerVariants}>
              {message.taskReferences.map((taskRef) => (
                <motion.div key={taskRef.taskId} variants={suggestedTaskVariants}>
                  <Card className="bg-background/60 backdrop-blur-sm border">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{taskRef.taskTitle}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTaskReference(taskRef)}
                          className="text-xs h-6"
                        >
                          {taskRef.action}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {isUser && (
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-accent text-accent-foreground font-semibold text-sm">
              {user?.firstName?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
      </motion.div>
    );
  }, [addedTasks, handleAddTask, handleQuickAction, handleTaskReference, user]);

  if (!user) {
    return (
      <motion.div 
        className="container mx-auto max-w-2xl py-12 px-4 text-center"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-2">Please Sign In</h2>
            <p className="text-muted-foreground">You need to be signed in to chat with MindMate.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (sessionLoading) {
    return (
      <motion.div 
        className="flex items-center justify-center h-[calc(100vh-4rem)]"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        <Card>
          <CardContent className="p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Initializing chat session...</span>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Handler to create a new chat session
  const handleNewSession = async () => {
    if (!user?.email) return;
    setSessionLoading(true);
    try {
      if (currentSession) {
        await chatService.setSessionActive(currentSession.id, false);
      }
      const sessionId = await chatService.createChatSession(user.email, 'Chat with MindMate');
      const newSession = {
        id: sessionId,
        userEmail: user.email,
        title: 'Chat with MindMate',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
        lastMessage: '',
        isActive: true,
      };
      setCurrentSession(newSession);
      setMessages([]);
      // Refresh session list
      const allSessions = await chatService.getChatSessions(user.email);
      setSessions(allSessions);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create new chat session.',
        variant: 'destructive',
      });
    }
    setSessionLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Desktop Chat History Sidebar */}
      <div className="hidden lg:flex lg:w-80 border-r bg-muted/30 flex-col">
        <Card className="m-4 flex-1 bg-background/50 backdrop-blur-sm flex flex-col overflow-hidden">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex-1 flex flex-col overflow-hidden">
            <Button
              size="sm"
              variant="outline"
              className="w-full mb-3 flex-shrink-0"
              onClick={handleNewSession}
              disabled={sessionLoading}
            >
              + New Chat Session
            </Button>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-3">
              {sessions.map((session) => (
                <Card key={session.id} className={`border-primary/20 flex items-center ${session.id === currentSession?.id ? 'bg-primary/5' : 'bg-background/50'}`}>
                  <CardContent className="p-3 cursor-pointer flex-1" onClick={async () => {
                    setSessionLoading(true);
                    setCurrentSession(session);
                    if (session.messageCount > 0) {
                      const { messages: sessionMessages } = await chatService.getSessionMessages(session.id);
                      setMessages(sessionMessages);
                    } else {
                      setMessages([]);
                    }
                    setSessionLoading(false);
                  }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      <span className="text-sm font-medium">{session.title || 'Chat Session'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {session.messageCount} messages
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(session.updatedAt).toLocaleString()}
                    </p>
                  </CardContent>
                  <Button size="icon" variant="ghost" className="ml-2" title="Delete session" onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </Card>
              ))}
              </div>
            </ScrollArea>
            <div className="text-xs text-muted-foreground text-center py-2 flex-shrink-0">
              {sessions.length === 0 ? 'No chat sessions yet' : 'Click a session to switch'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Area */}
      <motion.div
        className="flex-1 flex flex-col overflow-hidden"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {/* Header Section */}
        <div className="flex-shrink-0 p-4 pb-0">
          <motion.div variants={chatMessageVariants} className="mb-4">
            <Card className="shadow-lg border-0 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      Chat with MindMate
                      <div className="flex items-center gap-1 ml-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-muted-foreground">Online</span>
                      </div>
                    </CardTitle>
                    <CardDescription>Your AI-powered task companion</CardDescription>
                  </div>
                  {tasks.length > 0 && (
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {tasks.filter(t => !t.completedAt).length} active tasks
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tasks.filter(t => t.completedAt).length} completed
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div className="mb-4" variants={chatInputVariants}>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => {
                const IconComponent = iconMap[action.icon as keyof typeof iconMap] || Target;
                return (
                  <motion.div key={action.id} variants={quickActionVariants}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickAction(action)}
                      disabled={isPending}
                      className="text-xs h-8 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-colors"
                    >
                      <IconComponent className="h-3 w-3 mr-1" />
                      {action.label}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 flex flex-col overflow-hidden px-4">
          <Card className="flex-1 flex flex-col overflow-hidden shadow-lg">
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1" ref={scrollAreaRef}>
                <div className="p-4">
                  <motion.div
                    className="space-y-6"
                    variants={chatContainerVariants}
                    initial="initial"
                    animate="animate"
                  >
                    <AnimatePresence mode="popLayout">
                      {messages.map((message, index) => renderMessage(message, index))}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </ScrollArea>

              <Separator />

              {/* Input Area */}
              <div className="flex-shrink-0">
                <motion.div className="p-4" variants={chatInputVariants}>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    {isMultiline ? (
                      <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me to break down a task, plan your day, or just chat..."
                        disabled={isPending || tasksLoading}
                        className="min-h-[100px] resize-none bg-background/50 backdrop-blur-sm"
                        autoFocus
                      />
                    ) : (
                      <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me to break down a task, plan your day, or just chat..."
                        disabled={isPending || tasksLoading}
                        className="text-sm bg-background/50 backdrop-blur-sm"
                      />
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {isMultiline ? 'Enter to send, Shift+Enter for new line' : 'Enter to send, Shift+Enter for multiline'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsMultiline(!isMultiline)}
                          className="text-xs"
                        >
                          {isMultiline ? 'Single line' : 'Multiline'}
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!input.trim() || isPending || tasksLoading}
                          className="min-w-[60px]"
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
