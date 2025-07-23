
"use client";

import { useState, useRef, useEffect, useTransition } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '@/contexts/task-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chat } from '@/ai/flows/chat-flow';
import type { Task } from '@/lib/types';
import { Send, Loader2, PlusCircle, Check } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { pageVariants, messageVariants, staggerContainer } from '@/lib/animations';


interface SuggestedTask {
    title: string;
    description: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    suggestedTasks?: SuggestedTask[];
}

export default function ChatPage() {
    const { tasks, addTask, isLoading: tasksLoading } = useTasks();
    const { toast } = useToast();
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm MindMate. How can I help you plan your day? You can ask me to break down a large task into smaller ones!" }
    ]);
    const [input, setInput] = useState('');
    const [isPending, startTransition] = useTransition();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [addedTasks, setAddedTasks] = useState<string[]>([]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    const handleAddTask = (task: SuggestedTask) => {
        // Here we don't have a parent task context, so we add them as root tasks.
        addTask({
            title: task.title,
            description: task.description,
            category: 'personal', // Default category
            priority: 'Medium', // Default priority
            duration: 15, // Default duration
            timeOfDay: 'Afternoon', // Default time of day
            userEmail: user?.email || '', // Add missing userEmail
        });
        setAddedTasks(prev => [...prev, task.title]);
        toast({
            title: "Task Added!",
            description: `"${task.title}" has been added to your list.`,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isPending) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');

        startTransition(async () => {
            try {
                // We only need to serialize root tasks for the main chat context
                const serializableTasks = tasks.filter(t => !t.parentId).map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description || "",
                    category: t.category,
                    energyLevel: (t.priority === 'Low' ? 'Low' : t.priority === 'High' ? 'High' : 'Medium') as 'Low' | 'Medium' | 'High', // Map priority to energyLevel
                    duration: t.duration,
                    timeOfDay: t.timeOfDay,
                    completedAt: t.completedAt,
                }));

                const result = await chat({
                    message: currentInput,
                    tasks: serializableTasks,
                });
                
                const assistantMessage: Message = { 
                    role: 'assistant', 
                    content: result.response,
                    suggestedTasks: result.suggestedTasks,
                };
                setMessages(prev => [...prev, assistantMessage]);

            } catch (error) {
                console.error("Chat error:", error);
                toast({
                    title: "AI Error",
                    description: "Sorry, I couldn't get a response. Please try again.",
                    variant: "destructive",
                });
                setMessages(prev => prev.filter(m => m.content !== currentInput));
            }
        });
    };

    return (
        <motion.div 
            className="container mx-auto max-w-2xl py-4 md:py-12 px-4"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
        >
            <motion.div variants={messageVariants}>
                <Card className="h-[calc(100vh-8rem)] md:h-[calc(100vh-12rem)] flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-2xl">Chat with MindMate</CardTitle>
                        <CardDescription>Your AI-powered task companion</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
                            <motion.div 
                                className="space-y-6"
                                variants={staggerContainer}
                                initial="initial"
                                animate="animate"
                            >
                            {messages.map((message, index) => (
                                <motion.div 
                                    key={index} 
                                    className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}
                                    variants={messageVariants}
                                    initial="initial"
                                    animate="animate"
                                    layout
                                >
                                    {message.role === 'assistant' && (
                                        <Avatar className="w-10 h-10 border">
                                            <AvatarFallback className="bg-primary/20 text-primary font-bold">M</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={`rounded-lg p-3 max-w-md ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                        {message.suggestedTasks && (
                                            <div className="mt-4 space-y-2">
                                                <p className="text-sm font-semibold mb-2">Here are some smaller steps:</p>
                                                {message.suggestedTasks.map((task, taskIndex) => {
                                                    const isAdded = addedTasks.includes(task.title);
                                                    return (
                                                        <Card key={taskIndex} className="bg-background/50">
                                                            <CardContent className="p-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <p className="font-semibold break-words">{task.title}</p>
                                                                        <p className="text-sm text-muted-foreground">{task.description}</p>
                                                                    </div>
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant={isAdded ? "secondary" : "default"}
                                                                        onClick={() => !isAdded && handleAddTask(task)}
                                                                        disabled={isAdded}
                                                                        className="ml-4"
                                                                    >
                                                                        {isAdded ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                                                                    </Button>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {message.role === 'user' && (
                                        <Avatar className="w-10 h-10 border">
                                            <AvatarFallback className="bg-accent text-accent-foreground font-bold">Y</AvatarFallback>
                                        </Avatar>
                                    )}
                                </motion.div>
                            ))}
                             {isPending && (
                                <div className="flex items-start gap-4">
                                     <Avatar className="w-10 h-10 border">
                                        <AvatarFallback className="bg-primary/20 text-primary font-bold">M</AvatarFallback>
                                    </Avatar>
                                    <div className="rounded-lg p-3 max-w-md bg-muted flex items-center">
                                       <Loader2 className="h-5 w-5 animate-spin"/>
                                    </div>
                                </div>
                            )}
                            </motion.div>
                        </ScrollArea>
                        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-4">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask to break down a task..."
                                disabled={isPending || tasksLoading}
                            />
                            <Button type="submit" disabled={!input.trim() || isPending || tasksLoading}>
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
