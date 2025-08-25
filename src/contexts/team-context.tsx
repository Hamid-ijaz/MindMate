'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { 
  teamService, 
  teamMemberService, 
  workspaceService, 
  teamTaskService 
} from '@/lib/firestore';
import { 
  demoTeamService,
  demoTeamMemberService,
  demoWorkspaceService,
  demoTeamTaskService,
  DEMO_MODE
} from '@/lib/demo-data';
import type { 
  Team, 
  TeamMember, 
  Workspace, 
  TeamTask, 
  TeamRole,
  TeamPermissions 
} from '@/lib/types';

interface TeamContextType {
  // Teams
  teams: Team[];
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
  createTeam: (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'memberCount'>) => Promise<string>;
  updateTeam: (teamId: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  
  // Team Members
  teamMembers: TeamMember[];
  addTeamMember: (teamId: string, userEmail: string, role: TeamRole) => Promise<string>;
  updateTeamMemberRole: (memberId: string, role: TeamRole) => Promise<void>;
  removeTeamMember: (memberId: string) => Promise<void>;
  getUserPermissions: (teamId: string) => TeamPermissions | null;
  
  // Workspaces
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (workspaceData: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'stats'>) => Promise<string>;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => Promise<void>;
  
  // Team Tasks
  teamTasks: TeamTask[];
  assignedTasks: TeamTask[];
  assignTask: (taskId: string, assigneeId: string, notes?: string) => Promise<void>;
  updateAssignmentStatus: (taskId: string, status: 'accepted' | 'declined') => Promise<void>;
  
  // Loading states
  isLoadingTeams: boolean;
  isLoadingMembers: boolean;
  isLoadingWorkspaces: boolean;
  isLoadingTasks: boolean;
  
  // Error states
  error: string | null;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Choose services based on demo mode
  const services = DEMO_MODE ? {
    teamService: demoTeamService,
    teamMemberService: demoTeamMemberService,
    workspaceService: demoWorkspaceService,
    teamTaskService: demoTeamTaskService,
  } : {
    teamService,
    teamMemberService,
    workspaceService,
    teamTaskService,
  };
  
  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<TeamTask[]>([]);
  
  // Loading states
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Load user's teams
  useEffect(() => {
    if (!user?.email) return;

    const loadTeams = async () => {
      try {
        setIsLoadingTeams(true);
        setError(null);
        const userTeams = await services.teamService.getUserTeams(user.email);
        setTeams(userTeams);
        
        // Set first team as current if none selected
        if (userTeams.length > 0 && !currentTeam) {
          setCurrentTeam(userTeams[0]);
        }
      } catch (err) {
        console.error('Error loading teams:', err);
        setError('Failed to load teams');
      } finally {
        setIsLoadingTeams(false);
      }
    };

    loadTeams();
  }, [user?.email]);

  // Load team members when current team changes
  useEffect(() => {
    if (!currentTeam) {
      setTeamMembers([]);
      return;
    }

    const loadTeamMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const members = await services.teamMemberService.getTeamMembers(currentTeam.id);
        setTeamMembers(members);
      } catch (err) {
        console.error('Error loading team members:', err);
        setError('Failed to load team members');
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadTeamMembers();
  }, [currentTeam]);

  // Load workspaces when current team changes
  useEffect(() => {
    if (!currentTeam) {
      setWorkspaces([]);
      return;
    }

    const loadWorkspaces = async () => {
      try {
        setIsLoadingWorkspaces(true);
        const teamWorkspaces = await services.workspaceService.getTeamWorkspaces(currentTeam.id);
        setWorkspaces(teamWorkspaces);
        
        // Set first workspace as current if none selected
        if (teamWorkspaces.length > 0 && !currentWorkspace) {
          setCurrentWorkspace(teamWorkspaces[0]);
        }
      } catch (err) {
        console.error('Error loading workspaces:', err);
        setError('Failed to load workspaces');
      } finally {
        setIsLoadingWorkspaces(false);
      }
    };

    loadWorkspaces();
  }, [currentTeam]);

  // Load tasks when current workspace changes
  useEffect(() => {
    if (!currentWorkspace || !user?.email) {
      setTeamTasks([]);
      setAssignedTasks([]);
      return;
    }

    const loadTasks = async () => {
      try {
        setIsLoadingTasks(true);
        
        // Load all workspace tasks
        const workspaceTasks = await services.teamTaskService.getWorkspaceTasks(currentWorkspace.id);
        setTeamTasks(workspaceTasks);
        
        // Load assigned tasks for current user
        const userAssignedTasks = await services.teamTaskService.getAssignedTasks(user.email, currentWorkspace.id);
        setAssignedTasks(userAssignedTasks);
      } catch (err) {
        console.error('Error loading tasks:', err);
        setError('Failed to load tasks');
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();

    // Set up real-time subscription for team tasks
    let unsubscribe: (() => void) | undefined;
    if (currentWorkspace?.id && !DEMO_MODE) {
      // Only use real-time subscriptions in non-demo mode
      unsubscribe = teamTaskService.subscribeToTeamTasks(
        currentWorkspace.id,
        (tasks) => {
          setTeamTasks(tasks);
          
          // Filter assigned tasks for current user
          if (user?.email) {
            const userTasks = tasks.filter(task => task.assigneeId === user.email);
            setAssignedTasks(userTasks);
          }
        }
      );
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentWorkspace, user?.email]);

  // Team operations
  const createTeam = async (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'memberCount'>): Promise<string> => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      const teamId = await services.teamService.createTeam({
        ...teamData,
        ownerId: user.email,
        ownerName: `${user.firstName} ${user.lastName}`,
      });
      
      // Reload teams
      const userTeams = await services.teamService.getUserTeams(user.email);
      setTeams(userTeams);
      
      return teamId;
    } catch (err) {
      console.error('Error creating team:', err);
      setError('Failed to create team');
      throw err;
    }
  };

  const updateTeam = async (teamId: string, updates: Partial<Team>): Promise<void> => {
    try {
      await services.teamService.updateTeam(teamId, updates);
      
      // Update local state
      setTeams(prev => prev.map(team => 
        team.id === teamId ? { ...team, ...updates } : team
      ));
      
      // Update current team if it's the one being updated
      if (currentTeam?.id === teamId) {
        setCurrentTeam(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error('Error updating team:', err);
      setError('Failed to update team');
      throw err;
    }
  };

  const deleteTeam = async (teamId: string): Promise<void> => {
    try {
      await services.teamService.deleteTeam(teamId);
      
      // Remove from local state
      setTeams(prev => prev.filter(team => team.id !== teamId));
      
      // Clear current team if it's the one being deleted
      if (currentTeam?.id === teamId) {
        setCurrentTeam(null);
        setCurrentWorkspace(null);
      }
    } catch (err) {
      console.error('Error deleting team:', err);
      setError('Failed to delete team');
      throw err;
    }
  };

  // Team member operations
  const addTeamMember = async (teamId: string, userEmail: string, role: TeamRole): Promise<string> => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      const memberId = await services.teamMemberService.addTeamMember(teamId, userEmail, role, user.email);
      
      // Reload team members
      if (currentTeam?.id === teamId) {
        const members = await services.teamMemberService.getTeamMembers(teamId);
        setTeamMembers(members);
      }
      
      return memberId;
    } catch (err) {
      console.error('Error adding team member:', err);
      setError('Failed to add team member');
      throw err;
    }
  };

  const updateTeamMemberRole = async (memberId: string, role: TeamRole): Promise<void> => {
    try {
      const permissions = generateDefaultPermissions(role);
      await services.teamMemberService.updateTeamMemberRole(memberId, role);
      
      // Update local state
      setTeamMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, role, permissions } : member
      ));
    } catch (err) {
      console.error('Error updating team member role:', err);
      setError('Failed to update member role');
      throw err;
    }
  };

  const removeTeamMember = async (memberId: string): Promise<void> => {
    if (!currentTeam) return;
    
    try {
      await services.teamMemberService.removeTeamMember(memberId);
      
      // Remove from local state
      setTeamMembers(prev => prev.filter(member => member.id !== memberId));
    } catch (err) {
      console.error('Error removing team member:', err);
      setError('Failed to remove team member');
      throw err;
    }
  };

  const getUserPermissions = (teamId: string): TeamPermissions | null => {
    if (!user?.email) return null;
    
    const member = teamMembers.find(m => m.teamId === teamId && m.userId === user.email);
    return member?.permissions || null;
  };

  // Workspace operations
  const createWorkspace = async (workspaceData: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<string> => {
    if (!user?.email || !currentTeam) throw new Error('User not authenticated or no team selected');
    
    try {
      const workspaceId = await services.workspaceService.createWorkspace({
        ...workspaceData,
        teamId: currentTeam.id,
        createdBy: user.email,
      });
      
      // Reload workspaces
      const teamWorkspaces = await services.workspaceService.getTeamWorkspaces(currentTeam.id);
      setWorkspaces(teamWorkspaces);
      
      return workspaceId;
    } catch (err) {
      console.error('Error creating workspace:', err);
      setError('Failed to create workspace');
      throw err;
    }
  };

  const updateWorkspace = async (workspaceId: string, updates: Partial<Workspace>): Promise<void> => {
    try {
      await services.workspaceService.updateWorkspace(workspaceId, updates);
      
      // Update local state
      setWorkspaces(prev => prev.map(workspace => 
        workspace.id === workspaceId ? { ...workspace, ...updates } : workspace
      ));
      
      // Update current workspace if it's the one being updated
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      console.error('Error updating workspace:', err);
      setError('Failed to update workspace');
      throw err;
    }
  };

  // Task operations
  const assignTask = async (taskId: string, assigneeId: string, notes?: string): Promise<void> => {
    if (!user?.email) throw new Error('User not authenticated');
    
    try {
      await services.teamTaskService.assignTask(taskId, assigneeId, notes);
      
      // Tasks will be updated via real-time subscription
    } catch (err) {
      console.error('Error assigning task:', err);
      setError('Failed to assign task');
      throw err;
    }
  };

  const updateAssignmentStatus = async (taskId: string, status: 'accepted' | 'declined'): Promise<void> => {
    try {
      await services.teamTaskService.updateAssignmentStatus(taskId, status);
      
      // Tasks will be updated via real-time subscription
    } catch (err) {
      console.error('Error updating assignment status:', err);
      setError('Failed to update assignment status');
      throw err;
    }
  };

  const contextValue: TeamContextType = {
    // Teams
    teams,
    currentTeam,
    setCurrentTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    
    // Team Members
    teamMembers,
    addTeamMember,
    updateTeamMemberRole,
    removeTeamMember,
    getUserPermissions,
    
    // Workspaces
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    createWorkspace,
    updateWorkspace,
    
    // Team Tasks
    teamTasks,
    assignedTasks,
    assignTask,
    updateAssignmentStatus,
    
    // Loading states
    isLoadingTeams,
    isLoadingMembers,
    isLoadingWorkspaces,
    isLoadingTasks,
    
    // Error state
    error,
  };

  return (
    <TeamContext.Provider value={contextValue}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}

// Helper function to generate default permissions (same as in firestore.ts)
function generateDefaultPermissions(role: TeamRole): TeamPermissions {
  switch (role) {
    case 'owner':
      return {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditAllTasks: true,
        canDeleteTasks: true,
        canManageMembers: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageTemplates: true,
      };
    case 'admin':
      return {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditAllTasks: true,
        canDeleteTasks: true,
        canManageMembers: true,
        canManageSettings: false,
        canViewAnalytics: true,
        canManageTemplates: true,
      };
    case 'member':
      return {
        canCreateTasks: true,
        canAssignTasks: false,
        canEditAllTasks: false,
        canDeleteTasks: false,
        canManageMembers: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageTemplates: false,
      };
    case 'viewer':
      return {
        canCreateTasks: false,
        canAssignTasks: false,
        canEditAllTasks: false,
        canDeleteTasks: false,
        canManageMembers: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageTemplates: false,
      };
    default:
      return {
        canCreateTasks: false,
        canAssignTasks: false,
        canEditAllTasks: false,
        canDeleteTasks: false,
        canManageMembers: false,
        canManageSettings: false,
        canViewAnalytics: false,
        canManageTemplates: false,
      };
  }
}