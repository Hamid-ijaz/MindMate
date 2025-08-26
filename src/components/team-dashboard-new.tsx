'use client';

import React, { useState, useMemo } from 'react';
import { useTeam } from '@/contexts/team-context';
import { useAuth } from '@/contexts/auth-context';
import { useTasks } from '@/hooks/use-tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { WorkspaceCard } from '@/components/workspace-card';
import { TeamInviteDialog } from '@/components/team-invite-dialog';
import { AdvancedTaskManager } from '@/components/advanced-task-manager';
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
  Edit3,
  Crown,
  Shield,
  Eye,
  User,
  Clock,
  AlertCircle,
  Target,
  Activity,
  BarChart3,
  PieChart,
  Zap,
  ArrowRight,
  Building2,
  Users2,
  Filter,
  Search,
  SortAsc,
  Mail,
  Copy,
  ExternalLink,
  Star,
  CheckCircle2,
  XCircle,
  PlayCircle,
  PauseCircle,
  FileText,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TeamRole, TeamTask, Team, Workspace, TeamMember } from '@/lib/types';

// Enhanced role configurations
const roleConfig = {
  owner: {
    label: 'Owner',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    icon: Crown,
    description: 'Full access to all team features',
    permissions: ['manage_team', 'manage_members', 'manage_workspaces', 'manage_tasks', 'delete_team']
  },
  admin: {
    label: 'Admin',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    icon: Shield,
    description: 'Manage team members and workspaces',
    permissions: ['manage_members', 'manage_workspaces', 'manage_tasks']
  },
  member: {
    label: 'Member',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    icon: User,
    description: 'Create and manage tasks',
    permissions: ['manage_tasks']
  },
  viewer: {
    label: 'Viewer',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    icon: Eye,
    description: 'View-only access',
    permissions: []
  },
};

// Priority colors for tasks
const priorityConfig = {
  Low: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', icon: '🟢' },
  Medium: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', icon: '🟡' },
  High: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300', icon: '🟠' },
  Critical: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: '🔴' },
};

// Task status configurations
const taskStatusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', icon: Clock },
  accepted: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', icon: PlayCircle },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: XCircle },
};

interface TeamStatsProps {
  team: Team;
  tasks: TeamTask[];
  members: TeamMember[];
  workspaces: Workspace[];
}

function TeamStats({ team, tasks, members, workspaces }: TeamStatsProps) {
  const stats = useMemo(() => {
    const activeTasks = tasks.filter(t => !t.completedAt);
    const completedTasks = tasks.filter(t => t.completedAt);
    const overdueTasks = activeTasks.filter(t => {
      if (!t.reminderAt) return false;
      return new Date(t.reminderAt) < new Date();
    });
    
    const tasksByPriority = {
      Critical: tasks.filter(t => t.priority === 'Critical' && !t.completedAt).length,
      High: tasks.filter(t => t.priority === 'High' && !t.completedAt).length,
      Medium: tasks.filter(t => t.priority === 'Medium' && !t.completedAt).length,
      Low: tasks.filter(t => t.priority === 'Low' && !t.completedAt).length,
    };

    const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    
    return {
      totalTasks: tasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      tasksByPriority,
      completionRate,
      activeMembers: members.filter(m => new Date(m.lastActiveAt || 0) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
      activeWorkspaces: workspaces.filter(w => w.isActive).length
    };
  }, [tasks, members, workspaces]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Active Tasks</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{stats.activeTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Completion</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-200">{stats.completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Overdue</p>
                <p className="text-lg font-bold text-orange-800 dark:text-orange-200">{stats.overdueTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Active Members</p>
                <p className="text-lg font-bold text-purple-800 dark:text-purple-200">{stats.activeMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function TeamDashboard() {
  const { user } = useAuth();
  const { tasks } = useTasks();
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
    updateTeamMemberRole,
    removeTeamMember,
    assignTask,
    updateAssignmentStatus,
    getUserPermissions,
    isLoadingTeams,
    isLoadingMembers,
    isLoadingWorkspaces,
    isLoadingTasks,
    error
  } = useTeam();

  // State for UI interactions
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  
  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  
  // Filter and search states
  const [taskFilter, setTaskFilter] = useState<'all' | 'assigned' | 'unassigned' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'created'>('priority');

  // Get current user permissions
  const userPermissions = currentTeam ? getUserPermissions(currentTeam.id) : null;
  const canManageTeam = userPermissions?.canManageTeam || false;
  const canManageMembers = userPermissions?.canManageMembers || false;
  const canManageTasks = userPermissions?.canManageTasks || false;

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let filtered = teamTasks;

    // Apply filters
    switch (taskFilter) {
      case 'assigned':
        filtered = filtered.filter(t => t.assigneeId === user?.email);
        break;
      case 'unassigned':
        filtered = filtered.filter(t => !t.assigneeId);
        break;
      case 'overdue':
        filtered = filtered.filter(t => {
          if (!t.reminderAt || t.completedAt) return false;
          return new Date(t.reminderAt) < new Date();
        });
        break;
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigneeName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'dueDate':
          return (a.reminderAt || 0) - (b.reminderAt || 0);
        case 'created':
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    });

    return filtered;
  }, [teamTasks, taskFilter, searchQuery, sortBy, user?.email]);

  // Event handlers
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

  const handleInviteMembers = async (emails: string[], role: TeamRole, message?: string) => {
    if (!currentTeam) return;

    try {
      const invitePromises = emails.map(email => 
        addTeamMember(currentTeam.id, email, role)
      );
      await Promise.all(invitePromises);
      setIsInviteDialogOpen(false);
    } catch (error) {
      console.error('Failed to invite members:', error);
    }
  };

  const handleAssignTask = async (taskId: string, assigneeId: string) => {
    try {
      await assignTask(taskId, assigneeId);
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  };

  const handleTaskStatusUpdate = async (taskId: string, status: 'accepted' | 'declined') => {
    try {
      await updateAssignmentStatus(taskId, status);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Loading state
  if (isLoadingTeams) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading teams...</p>
        </div>
      </div>
    );
  }

  // No teams state
  if (teams.length === 0) {
    return (
      <div className="text-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <div className="rounded-full bg-muted/50 p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Users className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-semibold text-foreground mb-3">Welcome to Team Collaboration</h3>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Create your first team to start collaborating with others. 
            Organize workspaces, assign tasks, and track progress together.
          </p>
          <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="px-8">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Team
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Create New Team</span>
                </DialogTitle>
                <DialogDescription>
                  Set up a new team to collaborate with others on projects and tasks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Team Name</label>
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g., Marketing Team, Development Squad"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Textarea
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Describe your team's purpose and goals"
                    className="w-full"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()} className="flex-1">
                    <Users className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    );
  }

  // Main dashboard with team selected
  return (
    <div className="space-y-6">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </motion.div>
      )}

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <Select
              value={currentTeam?.id || ''}
              onValueChange={(teamId) => {
                const team = teams.find(t => t.id === teamId);
                setCurrentTeam(team || null);
                setCurrentWorkspace(null); // Reset workspace when team changes
              }}
            >
              <SelectTrigger className="w-auto min-w-[250px]">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4" />
                  <SelectValue placeholder="Select a team" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${team.memberCount > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-muted-foreground">{team.memberCount} members</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentTeam && canManageTeam && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Team Settings</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Team
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileText className="h-4 w-4 mr-2" />
                    Export Data
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {currentTeam && (
            <p className="text-sm text-muted-foreground">
              {currentTeam.description || "No description"}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">New Team</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>
                  Set up a new team to collaborate with others.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Team Name</label>
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Textarea
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="Enter team description"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()} className="flex-1">
                    Create Team
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateTeamOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {currentTeam && canManageMembers && (
            <Button onClick={() => setIsInviteDialogOpen(true)} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Invite</span>
            </Button>
          )}
        </div>
      </div>

      {/* Team Statistics */}
      {currentTeam && (
        <TeamStats 
          team={currentTeam} 
          tasks={teamTasks} 
          members={teamMembers} 
          workspaces={workspaces} 
        />
      )}

      {/* Main Content Tabs */}
      {currentTeam ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs sm:text-sm">
              <CheckSquare className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="workspaces" className="text-xs sm:text-sm">
              <Briefcase className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Workspaces</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm">
              <Users className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Members</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm hidden lg:flex">
              <PieChart className="h-4 w-4 mr-1" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <div className="space-y-3">
                      {teamTasks.slice(0, 5).map((task, index) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className={`w-2 h-2 rounded-full ${priorityConfig[task.priority]?.color.includes('green') ? 'bg-green-500' : 
                                         priorityConfig[task.priority]?.color.includes('yellow') ? 'bg-yellow-500' :
                                         priorityConfig[task.priority]?.color.includes('orange') ? 'bg-orange-500' : 'bg-red-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.assigneeName ? `Assigned to ${task.assigneeName}` : 'Unassigned'}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {task.priority}
                          </Badge>
                        </motion.div>
                      ))}
                      {teamTasks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No recent activity
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setIsCreateWorkspaceOpen(true)}
                    disabled={!canManageTeam}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setIsInviteDialogOpen(true)}
                    disabled={!canManageMembers}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Team Member
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('tasks')}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    View All Tasks
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    disabled
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Workspace Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="h-5 w-5" />
                    <span>Active Workspaces</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('workspaces')}
                  >
                    View All
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingWorkspaces ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : workspaces.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workspaces.slice(0, 3).map((workspace) => (
                      <WorkspaceCard
                        key={workspace.id}
                        workspace={workspace}
                        isSelected={currentWorkspace?.id === workspace.id}
                        onClick={() => setCurrentWorkspace(workspace)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No workspaces</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Create your first workspace to get started.</p>
                    <Button 
                      className="mt-4"
                      onClick={() => setIsCreateWorkspaceOpen(true)}
                      disabled={!canManageTeam}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Workspace
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6">
            {currentWorkspace ? (
              <div className="space-y-6">
                {/* Task Filters and Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold">Tasks in {currentWorkspace.name}</h3>
                    <Badge variant="secondary">
                      {filteredTasks.filter(t => !t.completedAt).length} active
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64"
                      />
                    </div>
                    
                    <Select value={taskFilter} onValueChange={(value: any) => setTaskFilter(value)}>
                      <SelectTrigger className="w-full sm:w-32">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tasks</SelectItem>
                        <SelectItem value="assigned">Assigned to Me</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SortAsc className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="dueDate">Due Date</SelectItem>
                        <SelectItem value="created">Created</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advanced Task Manager */}
                <AdvancedTaskManager workspaceId={currentWorkspace.id} />
              </div>
            ) : (
              <div className="text-center py-16">
                <Briefcase className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold text-foreground">Select a workspace</h3>
                <p className="mt-2 text-muted-foreground">Choose a workspace to view and manage tasks.</p>
                <Button 
                  className="mt-6"
                  onClick={() => setActiveTab('workspaces')}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Browse Workspaces
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Team Workspaces</h3>
              <Dialog open={isCreateWorkspaceOpen} onOpenChange={setIsCreateWorkspaceOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!canManageTeam}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <Briefcase className="h-5 w-5" />
                      <span>Create New Workspace</span>
                    </DialogTitle>
                    <DialogDescription>
                      Create a dedicated workspace for your team's projects and tasks.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Workspace Name</label>
                      <Input
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        placeholder="e.g., Q4 Marketing Campaign, Mobile App Development"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description (Optional)</label>
                      <Textarea
                        value={newWorkspaceDescription}
                        onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                        placeholder="Describe the workspace's purpose and scope"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim()} className="flex-1">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Create Workspace
                      </Button>
                      <Button variant="outline" onClick={() => setIsCreateWorkspaceOpen(false)} className="flex-1">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {workspaces.map((workspace, index) => (
                    <motion.div
                      key={workspace.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <WorkspaceCard
                        workspace={workspace}
                        isSelected={currentWorkspace?.id === workspace.id}
                        onClick={() => setCurrentWorkspace(workspace)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {workspaces.length === 0 && !isLoadingWorkspaces && (
              <div className="text-center py-16">
                <Briefcase className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold text-foreground">No workspaces yet</h3>
                <p className="mt-2 text-muted-foreground">Create your first workspace to organize your team's work.</p>
                {canManageTeam && (
                  <Button 
                    className="mt-6"
                    onClick={() => setIsCreateWorkspaceOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Team Members</h3>
              {canManageMembers && (
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              )}
            </div>

            {isLoadingMembers ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {teamMembers.map((member, index) => {
                    const roleInfo = roleConfig[member.role];
                    const IconComponent = roleInfo.icon;
                    
                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-center space-x-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={member.userAvatar} />
                                <AvatarFallback className="bg-primary/10">
                                  {getInitials(member.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-semibold truncate">
                                    {member.userName || member.userId.split('@')[0]}
                                  </h4>
                                  {member.role === 'owner' && (
                                    <Star className="h-4 w-4 text-yellow-500" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {member.userId}
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                  <Badge className={roleInfo.color}>
                                    <IconComponent className="h-3 w-3 mr-1" />
                                    {roleInfo.label}
                                  </Badge>
                                </div>
                              </div>
                              
                              {canManageMembers && member.role !== 'owner' && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setSelectedMember(member)}>
                                      <Edit3 className="h-4 w-4 mr-2" />
                                      Change Role
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Mail className="h-4 w-4 mr-2" />
                                      Send Message
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => removeTeamMember(member.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove Member
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                                <span>
                                  {member.lastActiveAt 
                                    ? `Active ${new Date(member.lastActiveAt).toLocaleDateString()}`
                                    : 'Never active'
                                  }
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {teamMembers.length === 0 && !isLoadingMembers && (
              <div className="text-center py-16">
                <Users className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-xl font-semibold text-foreground">No team members</h3>
                <p className="mt-2 text-muted-foreground">Invite people to join your team.</p>
                {canManageMembers && (
                  <Button 
                    className="mt-6"
                    onClick={() => setIsInviteDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite First Member
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Task Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="h-5 w-5" />
                    <span>Task Distribution</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries({
                      Critical: teamTasks.filter(t => t.priority === 'Critical' && !t.completedAt).length,
                      High: teamTasks.filter(t => t.priority === 'High' && !t.completedAt).length,
                      Medium: teamTasks.filter(t => t.priority === 'Medium' && !t.completedAt).length,
                      Low: teamTasks.filter(t => t.priority === 'Low' && !t.completedAt).length,
                    }).map(([priority, count]) => {
                      const total = teamTasks.filter(t => !t.completedAt).length;
                      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                      const config = priorityConfig[priority as keyof typeof priorityConfig];
                      
                      return (
                        <div key={priority} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span>{config.icon}</span>
                              <span className="font-medium">{priority}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{count} tasks</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Member Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Member Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {teamMembers.slice(0, 5).map((member) => {
                      const memberTasks = teamTasks.filter(t => t.assigneeId === member.userId);
                      const completedTasks = memberTasks.filter(t => t.completedAt);
                      const completionRate = memberTasks.length > 0 
                        ? Math.round((completedTasks.length / memberTasks.length) * 100) 
                        : 0;
                      
                      return (
                        <div key={member.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={member.userAvatar} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.userName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">
                                {member.userName?.split(' ')[0] || member.userId.split('@')[0]}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {completionRate}% completed
                            </span>
                          </div>
                          <Progress value={completionRate} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Workspace Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Workspace Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workspaces.map((workspace) => {
                    const workspaceTasks = teamTasks.filter(t => t.workspaceId === workspace.id);
                    const activeTasks = workspaceTasks.filter(t => !t.completedAt);
                    const completedTasks = workspaceTasks.filter(t => t.completedAt);
                    
                    return (
                      <Card key={workspace.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm truncate">{workspace.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {workspace.memberIds.length} members
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>Active Tasks</span>
                              <span className="font-medium">{activeTasks.length}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Completed</span>
                              <span className="font-medium">{completedTasks.length}</span>
                            </div>
                            <Progress 
                              value={workspaceTasks.length > 0 ? (completedTasks.length / workspaceTasks.length) * 100 : 0} 
                              className="h-1"
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-16">
          <Building2 className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold text-foreground">Select a team</h3>
          <p className="mt-2 text-muted-foreground">Choose a team from the dropdown above to get started.</p>
        </div>
      )}

      {/* Team Invite Dialog */}
      {currentTeam && (
        <TeamInviteDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          teamId={currentTeam.id}
          teamName={currentTeam.name}
          onInviteSent={handleInviteMembers}
        />
      )}

      {/* Member Role Change Dialog */}
      {selectedMember && (
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Member Role</DialogTitle>
              <DialogDescription>
                Update the role for {selectedMember.userName || selectedMember.userId}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-3">
                {Object.entries(roleConfig).map(([role, config]) => {
                  if (role === 'owner') return null; // Can't change to owner
                  
                  const IconComponent = config.icon;
                  return (
                    <div 
                      key={role}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedMember.role === role ? 'border-primary bg-primary/10' : ''
                      }`}
                      onClick={async () => {
                        await updateTeamMemberRole(selectedMember.id, role as TeamRole);
                        setSelectedMember(null);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <IconComponent className="h-5 w-5" />
                        <div>
                          <h4 className="font-medium">{config.label}</h4>
                          <p className="text-sm text-muted-foreground">{config.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
