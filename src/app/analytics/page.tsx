"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Calendar, Clock, Target, Trophy, 
  CheckSquare, AlertCircle, Zap, Timer
} from 'lucide-react';
import { useTasks } from '@/contexts/task-context';
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { motion } from 'framer-motion';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

export default function AnalyticsPage() {
  const { tasks } = useTasks();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

  const analytics = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = subDays(now, 30);

    const filteredTasks = tasks.filter(task => {
      if (timeRange === 'all') return true;
      const taskDate = new Date(task.createdAt);
      if (timeRange === 'week') {
        return isWithinInterval(taskDate, { start: weekStart, end: weekEnd });
      }
      return isWithinInterval(taskDate, { start: monthStart, end: now });
    });

    const completedTasks = filteredTasks.filter(t => t.completedAt);
    const pendingTasks = filteredTasks.filter(t => !t.completedAt && !t.isMuted);
    
    // Completion rate by category
    const categoryStats = filteredTasks.reduce((acc, task) => {
      if (!acc[task.category]) {
        acc[task.category] = { total: 0, completed: 0 };
      }
      acc[task.category].total++;
      if (task.completedAt) acc[task.category].completed++;
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    const categoryData = Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      total: stats.total,
      completed: stats.completed,
      rate: Math.round((stats.completed / stats.total) * 100)
    }));

    // Priority distribution
    const priorityStats = filteredTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityData = Object.entries(priorityStats).map(([priority, count]) => ({
      priority,
      count,
      percentage: Math.round((count / filteredTasks.length) * 100)
    }));

    // Daily completion trend (last 7 days)
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i);
      const dayTasks = completedTasks.filter(task => 
        format(new Date(task.completedAt!), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      return {
        date: format(date, 'MMM dd'),
        completed: dayTasks.length,
        timeSpent: dayTasks.reduce((sum, task) => sum + task.duration, 0)
      };
    });

    return {
      totalTasks: filteredTasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      completionRate: filteredTasks.length > 0 ? Math.round((completedTasks.length / filteredTasks.length) * 100) : 0,
      totalTimeSpent: completedTasks.reduce((sum, task) => sum + task.duration, 0),
      averageTaskDuration: completedTasks.length > 0 ? Math.round(completedTasks.reduce((sum, task) => sum + task.duration, 0) / completedTasks.length) : 0,
      categoryData,
      priorityData,
      dailyTrend,
      mostProductiveDay: dailyTrend.reduce((max, day) => day.completed > max.completed ? day : max, dailyTrend[0]),
      streakDays: calculateStreak(completedTasks)
    };
  }, [tasks, timeRange]);

  function calculateStreak(completedTasks: any[]) {
    const today = new Date();
    let streak = 0;
    let checkDate = today;

    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const hasTaskOnDate = completedTasks.some(task => 
        format(new Date(task.completedAt!), 'yyyy-MM-dd') === dateStr
      );

      if (hasTaskOnDate) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    return streak;
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Track your productivity and task completion patterns</p>
        </div>
        <Select value={timeRange} onValueChange={(value: 'week' | 'month' | 'all') => setTimeRange(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.completionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {analytics.completedTasks} of {analytics.totalTasks} tasks
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Time Invested</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(analytics.totalTimeSpent / 60)}h</div>
              <p className="text-xs text-muted-foreground">
                {analytics.totalTimeSpent} minutes total
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.streakDays}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.streakDays === 1 ? 'day' : 'days'} in a row
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Task Duration</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.averageTaskDuration}m</div>
              <p className="text-xs text-muted-foreground">
                Per completed task
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Completion Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Completion Trend</CardTitle>
            <CardDescription>Tasks completed over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.dailyTrend.some(d => d.completed > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="completed" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <CheckSquare className="h-12 w-12 mb-4 opacity-20" />
                <p>No completed tasks in the last 7 days</p>
                <p className="text-sm">Complete some tasks to see your progress!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Completion rates by task category</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="rate" fill="#82ca9d" name="Completion Rate" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <Target className="h-12 w-12 mb-4 opacity-20" />
                <p>No tasks found in this time range</p>
                <p className="text-sm">Add some tasks to see category stats!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>How your tasks are prioritized</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.priorityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ priority, percentage }) => `${priority} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <Zap className="h-12 w-12 mb-4 opacity-20" />
                <p>No tasks found in this time range</p>
                <p className="text-sm">Add some tasks to see priority distribution!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Your productivity patterns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                <Target className="h-3 w-3 mr-1" />
                Most Productive
              </Badge>
              <span className="text-sm">{analytics.mostProductiveDay?.date || 'No data'}</span>
            </div>
            
            {analytics.completionRate >= 80 && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <Trophy className="h-3 w-3 mr-1" />
                  High Performer
                </Badge>
                <span className="text-sm">Excellent completion rate!</span>
              </div>
            )}

            {analytics.streakDays >= 3 && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <CheckSquare className="h-3 w-3 mr-1" />
                  On Fire
                </Badge>
                <span className="text-sm">Great consistency!</span>
              </div>
            )}

            {analytics.pendingTasks > analytics.completedTasks && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Focus Needed
                </Badge>
                <span className="text-sm">More pending than completed tasks</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
