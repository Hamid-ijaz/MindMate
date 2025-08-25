'use client';

import React from 'react';
import { TeamProvider } from '@/contexts/team-context';
import AdvancedTaskManager from '@/components/advanced-task-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  FileText, // Using FileText instead of Template
  CheckSquare, 
  Zap,
  BarChart3,
  Users,
  GitBranch,
  Clock,
  Target
} from 'lucide-react';

export default function AdvancedTasksPage() {
  return (
    <TeamProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Advanced Task Management</h1>
            <p className="mt-2 text-gray-600">
              Powerful tools for managing tasks at scale with templates, batch operations, and advanced search.
            </p>
          </div>

          <Tabs defaultValue="tasks" className="space-y-6">
            <TabsList className="grid w-full grid-cols-1 lg:grid-cols-4">
              <TabsTrigger value="tasks">Task Manager</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-6">
              <AdvancedTaskManager />
            </TabsContent>

            <TabsContent value="templates" className="space-y-6">
              {/* Template Management */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Project Templates</span>
                    </CardTitle>
                    <CardDescription>
                      Pre-built templates for common project types
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: 'Software Development Sprint', tasks: 12, category: 'Development' },
                      { name: 'Marketing Campaign Launch', tasks: 8, category: 'Marketing' },
                      { name: 'Product Launch Checklist', tasks: 15, category: 'Product' },
                      { name: 'Employee Onboarding', tasks: 10, category: 'HR' },
                    ].map((template, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-gray-500">{template.tasks} tasks</p>
                        </div>
                        <Badge variant="secondary">{template.category}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CheckSquare className="h-5 w-5" />
                      <span>Task Templates</span>
                    </CardTitle>
                    <CardDescription>
                      Individual task templates for quick creation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: 'Code Review', duration: 30, category: 'Development' },
                      { name: 'Client Meeting', duration: 60, category: 'Meetings' },
                      { name: 'Weekly Report', duration: 45, category: 'Reporting' },
                      { name: 'Bug Fix', duration: 90, category: 'Development' },
                    ].map((template, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          <p className="text-xs text-gray-500">{template.duration} min</p>
                        </div>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="h-5 w-5" />
                      <span>Quick Actions</span>
                    </CardTitle>
                    <CardDescription>
                      Common batch operations and automations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: 'Assign to Team Lead', icon: Users, description: 'Bulk assign selected tasks' },
                      { name: 'Set High Priority', icon: Target, description: 'Mark tasks as high priority' },
                      { name: 'Schedule for Tomorrow', icon: Clock, description: 'Batch reschedule tasks' },
                      { name: 'Mark Complete', icon: CheckSquare, description: 'Complete multiple tasks' },
                    ].map((action, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                        <action.icon className="h-4 w-4 text-gray-600" />
                        <div>
                          <h4 className="font-medium text-sm">{action.name}</h4>
                          <p className="text-xs text-gray-500">{action.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="dependencies" className="space-y-6">
              {/* Task Dependencies */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <GitBranch className="h-5 w-5" />
                      <span>Dependency Types</span>
                    </CardTitle>
                    <CardDescription>
                      Understanding task relationship types
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { type: 'Finish-to-Start (FS)', description: 'Task B cannot start until Task A finishes', example: 'Design → Development' },
                      { type: 'Start-to-Start (SS)', description: 'Task B cannot start until Task A starts', example: 'Planning → Documentation' },
                      { type: 'Finish-to-Finish (FF)', description: 'Task B cannot finish until Task A finishes', example: 'Development → Testing' },
                      { type: 'Start-to-Finish (SF)', description: 'Task B cannot finish until Task A starts', example: 'Old System → New System' },
                    ].map((dep, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <h4 className="font-medium text-sm mb-1">{dep.type}</h4>
                        <p className="text-xs text-gray-600 mb-2">{dep.description}</p>
                        <Badge variant="outline" className="text-xs">{dep.example}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dependency Visualization</CardTitle>
                    <CardDescription>
                      Visual representation of task relationships
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                        <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Dependency Graph</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Interactive diagram showing task relationships and critical path
                        </p>
                        <div className="mt-4">
                          <Badge variant="secondary">Coming Soon</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Analytics Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">156</div>
                    <p className="text-xs text-muted-foreground">
                      +12% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">87%</div>
                    <p className="text-xs text-muted-foreground">
                      +3% from last week
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Task Duration</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">2.4h</div>
                    <p className="text-xs text-muted-foreground">
                      -15min from last week
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Team Productivity</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">94</div>
                    <p className="text-xs text-muted-foreground">
                      +7 points this week
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Distribution by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { category: 'Development', count: 45, percentage: 35 },
                        { category: 'Marketing', count: 28, percentage: 22 },
                        { category: 'Design', count: 32, percentage: 25 },
                        { category: 'Testing', count: 23, percentage: 18 },
                      ].map((item) => (
                        <div key={item.category} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-sm">{item.category}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{item.count}</span>
                            <span className="text-xs text-gray-500">({item.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                        <div key={day} className="flex items-center justify-between">
                          <span className="text-sm w-12">{day}</span>
                          <div className="flex-1 mx-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{ width: `${Math.random() * 100}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 w-8">{Math.floor(Math.random() * 20) + 5}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TeamProvider>
  );
}