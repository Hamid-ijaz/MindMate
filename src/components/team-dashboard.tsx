'use client';

import React, { useState } from 'react';
import { useTeam } from '@/contexts/team-context';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Settings, 
  MoreHorizontal, 
  Calendar, 
  CheckSquare, 
  TrendingUp, 
  Briefcase,
  UserPlus,
  Trash2,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TeamRole } from '@/lib/types';

const roleColors = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  member: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const roleLabels = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export default function TeamDashboard() {
  const { user } = useAuth();
  const {
    teams,
    currentTeam,
    setCurrentTeam,
    teamMembers,
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    teamTasks,
    assignedTasks,
    createTeam,
    createWorkspace,
    addTeamMember,
    isLoadingTeams,
    isLoadingMembers,
    isLoadingWorkspaces,
    error
  } = useTeam();

  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>('member');

  const handleCreateTeam = async () => {
    if (!user?.email || !newTeamName.trim()) return;

    try {
      await createTeam({
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || undefined,
        ownerId: user.email,
        ownerName: `${user.firstName} ${user.lastName}`,
        settings: {
          allowMemberInvites: true,
          defaultMemberRole: 'member',
          requireApprovalForTasks: false,
          autoAssignTasks: false,
          notificationSettings: {
            memberJoined: true,
            taskAssigned: true,
            projectUpdates: true,
          },
        },
      });

      setIsCreateTeamOpen(false);
      setNewTeamName('');
      setNewTeamDescription('');
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!currentTeam || !user?.email || !newWorkspaceName.trim()) return;

    try {
      await createWorkspace({
        teamId: currentTeam.id,
        name: newWorkspaceName.trim(),
        description: newWorkspaceDescription.trim() || undefined,
        createdBy: user.email,
        isActive: true,
        memberIds: [user.email],
        settings: {
          defaultTaskCategory: 'Work',
          workingHours: { start: '09:00', end: '17:00', timezone: 'UTC' },
          holidays: [],
          taskAutoAssignment: false,
          notificationPreferences: {
            enabled: true,
            taskAssignments: true,
            taskUpdates: true,
            deadlineReminders: true,
            teamUpdates: true,
            dailyDigest: false,
          },
          calendarIntegration: false,
          timeTracking: false,
          requireTaskApproval: false,
        },
      });

      setIsCreateWorkspaceOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  };

  const handleAddMember = async () => {
    if (!currentTeam || !newMemberEmail.trim()) return;

    try {
      await addTeamMember(currentTeam.id, newMemberEmail.trim(), newMemberRole);

      setIsAddMemberOpen(false);
      setNewMemberEmail('');
      setNewMemberRole('member');
    } catch (error) {
      console.error('Failed to add team member:', error);
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoadingTeams) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No teams yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first team.</p>
        <div className="mt-6">
          <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Team Name</label>
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                  <Input
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Enter team description"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
                    Create Team
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Team Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select
            value={currentTeam?.id || ''}
            onValueChange={(teamId) => {
              const team = teams.find(t => t.id === teamId);
              setCurrentTeam(team || null);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>{team.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {team.memberCount} members
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentTeam && (
            <div className="text-sm text-muted-foreground">
              {currentTeam.description}
            </div>
          )}
        </div>

        <div className="flex space-x-2">
          <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Team Name</label>
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                  <Input
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Enter team description"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
                    Create Team
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {currentTeam && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Team Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentTeam.memberCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{workspaces.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{teamTasks.filter(t => !t.completedAt).length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assignedTasks.filter(t => !t.completedAt).length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center space-x-4 hover:bg-muted/30 p-2 rounded-lg transition-colors">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.assigneeName ? `Assigned to ${task.assigneeName}` : 'Unassigned'} • 
                          {new Date(task.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={task.completedAt ? 'default' : 'secondary'}>
                        {task.completedAt ? 'Completed' : task.priority}
                      </Badge>
                    </div>
                  ))}
                  {teamTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Team Members</h3>
              <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Email</label>
                      <Input
                        type="email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Role</label>
                      <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as TeamRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button onClick={handleAddMember} disabled={!newMemberEmail.trim()}>
                        Add Member
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingMembers ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {teamMembers.map((member) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={member.userAvatar} />
                              <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h4 className="font-medium">{member.userName || member.userId.split('@')[0]}</h4>
                              <p className="text-sm text-muted-foreground">{member.userId}</p>
                              <Badge className={`mt-2 ${roleColors[member.role]}`}>
                                {roleLabels[member.role]}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-4 text-xs text-muted-foreground">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="workspaces" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Workspaces</h3>
              <Dialog open={isCreateWorkspaceOpen} onOpenChange={setIsCreateWorkspaceOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Workspace</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Workspace Name</label>
                      <Input
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder="Enter workspace name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                      <Input
                        value={newWorkspaceDescription}
                        onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                        placeholder="Enter workspace description"
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim()}>
                        Create Workspace
                      </Button>
                      <Button variant="outline" onClick={() => setIsCreateWorkspaceOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingWorkspaces ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {workspaces.map((workspace) => (
                    <motion.div
                      key={workspace.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`cursor-pointer ${currentWorkspace?.id === workspace.id ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => setCurrentWorkspace(workspace)}
                    >
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">{workspace.name}</CardTitle>
                          {workspace.description && (
                            <p className="text-sm text-muted-foreground">{workspace.description}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{workspace.stats.totalMembers} members</span>
                            <span>{workspace.stats.activeTasks} active tasks</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            {currentWorkspace ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Tasks in {currentWorkspace.name}</h3>
                  <div className="flex space-x-2">
                    <Badge variant="secondary">
                      {teamTasks.filter(t => !t.completedAt).length} Active
                    </Badge>
                    <Badge variant="outline">
                      {teamTasks.filter(t => t.completedAt).length} Completed
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Assigned to Me */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Assigned to Me</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {assignedTasks.filter(t => !t.completedAt).slice(0, 5).map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Due: {task.timeOfDay} • {task.priority} priority
                            </p>
                          </div>
                          <Badge 
                            className={task.assignmentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' : ''}
                          >
                            {task.assignmentStatus || 'assigned'}
                          </Badge>
                        </div>
                      ))}
                      {assignedTasks.filter(t => !t.completedAt).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No tasks assigned to you</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* All Team Tasks */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">All Tasks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {teamTasks.filter(t => !t.completedAt).slice(0, 5).map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {task.assigneeName ? `Assigned to ${task.assigneeName}` : 'Unassigned'} • 
                              {task.priority} priority
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {task.category}
                          </Badge>
                        </div>
                      ))}
                      {teamTasks.filter(t => !t.completedAt).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">No active tasks</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground">Select a workspace</h3>
                <p className="mt-1 text-sm text-muted-foreground">Choose a workspace to view and manage tasks.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}