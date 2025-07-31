"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Target, Plus, Calendar, TrendingUp, Award, 
  Clock, CheckCircle2, AlertTriangle, Zap
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  type: 'count' | 'duration' | 'completion';
  startDate: number;
  endDate: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  milestones: Milestone[];
}

interface Milestone {
  id: string;
  title: string;
  targetValue: number;
  completedAt?: number;
  reward?: string;
}

export function GoalTracker() {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      title: 'Complete 50 Tasks This Month',
      description: 'Focus on productivity and task completion',
      category: 'Productivity',
      targetValue: 50,
      currentValue: 23,
      unit: 'tasks',
      type: 'count',
      startDate: Date.now() - 20 * 24 * 60 * 60 * 1000,
      endDate: Date.now() + 10 * 24 * 60 * 60 * 1000,
      priority: 'High',
      createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
      milestones: [
        { id: '1', title: 'First 10 tasks', targetValue: 10, completedAt: Date.now() - 15 * 24 * 60 * 60 * 1000 },
        { id: '2', title: 'Halfway there', targetValue: 25, reward: 'Treat yourself to coffee' },
        { id: '3', title: 'Final push', targetValue: 45, reward: 'Movie night' },
      ]
    },
    {
      id: '2',
      title: 'Spend 40 Hours Learning',
      description: 'Dedicated time for skill development and learning',
      category: 'Education',
      targetValue: 40,
      currentValue: 18.5,
      unit: 'hours',
      type: 'duration',
      startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
      endDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      priority: 'Medium',
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
      milestones: [
        { id: '1', title: 'First week', targetValue: 10, completedAt: Date.now() - 20 * 24 * 60 * 60 * 1000 },
        { id: '2', title: 'Halfway point', targetValue: 20, reward: 'New course book' },
        { id: '3', title: 'Expert level', targetValue: 35, reward: 'Certificate celebration' },
      ]
    }
  ]);
  
  const [showNewGoalDialog, setShowNewGoalDialog] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'Personal',
    targetValue: 1,
    unit: 'tasks',
    type: 'count' as Goal['type'],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'Medium' as Goal['priority'],
  });

  const calculateProgress = (goal: Goal) => {
    return Math.min((goal.currentValue / goal.targetValue) * 100, 100);
  };

  const getDaysRemaining = (endDate: number) => {
    const days = Math.ceil((endDate - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, days);
  };

  const getGoalStatus = (goal: Goal) => {
    if (goal.completedAt) return 'completed';
    if (Date.now() > goal.endDate) return 'overdue';
    if (calculateProgress(goal) >= 100) return 'achieved';
    if (getDaysRemaining(goal.endDate) <= 3) return 'urgent';
    return 'active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'achieved': return 'bg-green-100 text-green-800 border-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const activeGoals = goals.filter(goal => !goal.completedAt && Date.now() <= goal.endDate);
  const completedGoals = goals.filter(goal => goal.completedAt || calculateProgress(goal) >= 100);

  const addGoal = () => {
    if (!newGoal.title.trim()) return;

    const goal: Goal = {
      id: Date.now().toString(),
      ...newGoal,
      currentValue: 0,
      startDate: Date.now(),
      endDate: new Date(newGoal.endDate).getTime(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      milestones: []
    };

    setGoals(prev => [...prev, goal]);
    setShowNewGoalDialog(false);
    setNewGoal({
      title: '',
      description: '',
      category: 'Personal',
      targetValue: 1,
      unit: 'tasks',
      type: 'count',
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'Medium',
    });

    toast({
      title: "Goal created!",
      description: "Your new goal has been added to the tracker.",
    });
  };

  const updateGoalProgress = (goalId: string, increment: number) => {
    setGoals(prev => prev.map(goal => 
      goal.id === goalId 
        ? { 
            ...goal, 
            currentValue: Math.max(0, goal.currentValue + increment),
            updatedAt: Date.now()
          }
        : goal
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Goal Tracker
          </h1>
          <p className="text-muted-foreground">
            Track your progress and achieve your objectives
          </p>
        </div>
        
        <Dialog open={showNewGoalDialog} onOpenChange={setShowNewGoalDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Goal Title</Label>
                <Input
                  id="title"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Complete 30 tasks this month"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What you want to achieve and why"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={newGoal.category} onValueChange={(value) => setNewGoal(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Personal">Personal</SelectItem>
                      <SelectItem value="Work">Work</SelectItem>
                      <SelectItem value="Health">Health</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newGoal.priority} onValueChange={(value) => setNewGoal(prev => ({ ...prev, priority: value as Goal['priority'] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={newGoal.type} onValueChange={(value) => setNewGoal(prev => ({ ...prev, type: value as Goal['type'] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Count</SelectItem>
                      <SelectItem value="duration">Duration</SelectItem>
                      <SelectItem value="completion">Completion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="target">Target</Label>
                  <Input
                    id="target"
                    type="number"
                    min="1"
                    value={newGoal.targetValue}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, targetValue: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="tasks, hours, etc."
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newGoal.endDate}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              
              <Button onClick={addGoal} className="w-full">
                Create Goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Active Goals</span>
            </div>
            <p className="text-2xl font-bold">{activeGoals.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold">{completedGoals.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Avg Progress</span>
            </div>
            <p className="text-2xl font-bold">
              {activeGoals.length > 0 
                ? Math.round(activeGoals.reduce((acc, goal) => acc + calculateProgress(goal), 0) / activeGoals.length)
                : 0}%
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">Success Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {goals.length > 0 
                ? Math.round((completedGoals.length / goals.length) * 100)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Active Goals</CardTitle>
          <CardDescription>Goals you're currently working on</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeGoals.map(goal => {
              const progress = calculateProgress(goal);
              const status = getGoalStatus(goal);
              const daysRemaining = getDaysRemaining(goal.endDate);
              
              return (
                <Card key={goal.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium flex items-center gap-2">
                          {goal.title}
                          <Badge variant={
                            goal.priority === 'Critical' ? 'destructive' :
                            goal.priority === 'High' ? 'default' : 'secondary'
                          } className="text-xs">
                            {goal.priority}
                          </Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground">{goal.description}</p>
                      </div>
                      
                      <Badge className={getStatusColor(status)}>
                        {status === 'urgent' ? 'Urgent' : 
                         status === 'achieved' ? 'Achieved' : 'Active'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {daysRemaining} days left
                          </span>
                          <span>Category: {goal.category}</span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateGoalProgress(goal.id, -1)}
                            disabled={goal.currentValue <= 0}
                          >
                            -1
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateGoalProgress(goal.id, 1)}
                          >
                            +1
                          </Button>
                        </div>
                      </div>
                      
                      {/* Milestones */}
                      {goal.milestones.length > 0 && (
                        <div className="border-t pt-3">
                          <h5 className="text-sm font-medium mb-2">Milestones</h5>
                          <div className="space-y-1">
                            {goal.milestones.map(milestone => (
                              <div key={milestone.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  {milestone.completedAt ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  ) : goal.currentValue >= milestone.targetValue ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <div className="h-3 w-3 border rounded-full" />
                                  )}
                                  <span>{milestone.title}</span>
                                </div>
                                <span className="text-muted-foreground">
                                  {milestone.targetValue} {goal.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {activeGoals.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No active goals. Create your first goal to get started!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Goals</CardTitle>
            <CardDescription>Goals you've successfully achieved</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedGoals.slice(0, 6).map(goal => (
                <Card key={goal.id} className="border border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-green-600" />
                      <h4 className="font-medium">{goal.title}</h4>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {goal.currentValue} / {goal.targetValue} {goal.unit} • {goal.category}
                    </div>
                    <Progress value={100} className="h-2 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GoalTracker;
