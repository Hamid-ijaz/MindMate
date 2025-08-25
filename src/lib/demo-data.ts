// Demo data store for development mode
import type { Team, TeamMember, Workspace, TeamTask, TaskTemplate, ProjectTemplate } from './types';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// In-memory store for demo data
class DemoDataStore {
  private teams: Map<string, Team> = new Map();
  private teamMembers: Map<string, TeamMember> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private teamTasks: Map<string, TeamTask> = new Map();
  private taskTemplates: Map<string, TaskTemplate> = new Map();
  private projectTemplates: Map<string, ProjectTemplate> = new Map();
  
  // Generate unique IDs
  private generateId(): string {
    return 'demo_' + Math.random().toString(36).substr(2, 9);
  }

  // Team operations
  createTeam(teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'memberCount'>): string {
    const id = this.generateId();
    const team: Team = {
      ...teamData,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      memberCount: 1,
      isActive: true,
    };
    
    this.teams.set(id, team);
    
    // Add owner as first team member
    const memberId = this.generateId();
    const teamMember: TeamMember = {
      id: memberId,
      teamId: id,
      userId: teamData.ownerId,
      userName: teamData.ownerName,
      role: 'owner',
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      invitedBy: teamData.ownerId,
      status: 'active',
      permissions: {
        canCreateTasks: true,
        canAssignTasks: true,
        canEditAllTasks: true,
        canDeleteTasks: true,
        canManageMembers: true,
        canManageSettings: true,
        canViewAnalytics: true,
        canManageTemplates: true,
      },
    };
    this.teamMembers.set(memberId, teamMember);
    
    return id;
  }

  getTeam(teamId: string): Team | null {
    return this.teams.get(teamId) || null;
  }

  getUserTeams(userEmail: string): Team[] {
    const userTeamIds = Array.from(this.teamMembers.values())
      .filter(member => member.userId === userEmail && member.status === 'active')
      .map(member => member.teamId);
    
    return userTeamIds
      .map(teamId => this.teams.get(teamId))
      .filter((team): team is Team => team !== undefined);
  }

  updateTeam(teamId: string, updates: Partial<Team>): void {
    const team = this.teams.get(teamId);
    if (team) {
      this.teams.set(teamId, {
        ...team,
        ...updates,
        updatedAt: Date.now(),
      });
    }
  }

  deleteTeam(teamId: string): void {
    this.teams.delete(teamId);
    // Also delete related team members
    Array.from(this.teamMembers.entries()).forEach(([memberId, member]) => {
      if (member.teamId === teamId) {
        this.teamMembers.delete(memberId);
      }
    });
  }

  // Team Member operations
  addTeamMember(teamId: string, userEmail: string, role: 'owner' | 'admin' | 'member' | 'viewer', invitedBy: string): string {
    const id = this.generateId();
    const permissions = this.getRolePermissions(role);
    
    const teamMember: TeamMember = {
      id,
      teamId,
      userId: userEmail,
      userName: userEmail.split('@')[0], // Simple fallback
      role,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      invitedBy,
      status: 'active',
      permissions,
    };
    
    this.teamMembers.set(id, teamMember);
    
    // Update team member count
    const team = this.teams.get(teamId);
    if (team) {
      team.memberCount++;
      team.updatedAt = Date.now();
    }
    
    return id;
  }

  getTeamMembers(teamId: string): TeamMember[] {
    return Array.from(this.teamMembers.values())
      .filter(member => member.teamId === teamId);
  }

  updateTeamMemberRole(memberId: string, role: 'owner' | 'admin' | 'member' | 'viewer'): void {
    const member = this.teamMembers.get(memberId);
    if (member) {
      this.teamMembers.set(memberId, {
        ...member,
        role,
        permissions: this.getRolePermissions(role),
      });
    }
  }

  removeTeamMember(memberId: string): void {
    const member = this.teamMembers.get(memberId);
    if (member) {
      this.teamMembers.delete(memberId);
      
      // Update team member count
      const team = this.teams.get(member.teamId);
      if (team) {
        team.memberCount = Math.max(0, team.memberCount - 1);
        team.updatedAt = Date.now();
      }
    }
  }

  // Workspace operations
  createWorkspace(workspaceData: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): string {
    const id = this.generateId();
    const workspace: Workspace = {
      ...workspaceData,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        totalTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        overdueTasks: 0,
        totalMembers: workspaceData.memberIds.length,
        lastActivityAt: Date.now(),
      },
    };
    
    this.workspaces.set(id, workspace);
    return id;
  }

  getWorkspace(workspaceId: string): Workspace | null {
    return this.workspaces.get(workspaceId) || null;
  }

  getTeamWorkspaces(teamId: string): Workspace[] {
    return Array.from(this.workspaces.values())
      .filter(workspace => workspace.teamId === teamId);
  }

  updateWorkspace(workspaceId: string, updates: Partial<Workspace>): void {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      this.workspaces.set(workspaceId, {
        ...workspace,
        ...updates,
        updatedAt: Date.now(),
      });
    }
  }

  // Helper function to get role permissions
  private getRolePermissions(role: 'owner' | 'admin' | 'member' | 'viewer'): TeamMember['permissions'] {
    const permissions = {
      canCreateTasks: false,
      canAssignTasks: false,
      canEditAllTasks: false,
      canDeleteTasks: false,
      canManageMembers: false,
      canManageSettings: false,
      canViewAnalytics: false,
      canManageTemplates: false,
    };

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
          canAssignTasks: true,
          canEditAllTasks: false,
          canDeleteTasks: false,
          canManageMembers: false,
          canManageSettings: false,
          canViewAnalytics: false,
          canManageTemplates: false,
        };
      case 'viewer':
        return permissions; // All false
    }
  }

  // Clear all data (for testing)
  clear(): void {
    this.teams.clear();
    this.teamMembers.clear();
    this.workspaces.clear();
    this.teamTasks.clear();
    this.taskTemplates.clear();
    this.projectTemplates.clear();
  }
}

// Export singleton instance
export const demoDataStore = new DemoDataStore();

// Demo mode team services
export const demoTeamService = {
  createTeam: (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'memberCount'>) => 
    Promise.resolve(demoDataStore.createTeam(teamData)),
    
  getTeam: (teamId: string) => 
    Promise.resolve(demoDataStore.getTeam(teamId)),
    
  getUserTeams: (userEmail: string) => 
    Promise.resolve(demoDataStore.getUserTeams(userEmail)),
    
  updateTeam: (teamId: string, updates: Partial<Team>) => 
    Promise.resolve(demoDataStore.updateTeam(teamId, updates)),
    
  deleteTeam: (teamId: string) => 
    Promise.resolve(demoDataStore.deleteTeam(teamId)),
};

export const demoTeamMemberService = {
  addTeamMember: (teamId: string, userEmail: string, role: 'owner' | 'admin' | 'member' | 'viewer', invitedBy: string) =>
    Promise.resolve(demoDataStore.addTeamMember(teamId, userEmail, role, invitedBy)),
    
  getTeamMembers: (teamId: string) =>
    Promise.resolve(demoDataStore.getTeamMembers(teamId)),
    
  updateTeamMemberRole: (memberId: string, role: 'owner' | 'admin' | 'member' | 'viewer') =>
    Promise.resolve(demoDataStore.updateTeamMemberRole(memberId, role)),
    
  removeTeamMember: (memberId: string) =>
    Promise.resolve(demoDataStore.removeTeamMember(memberId)),
};

export const demoWorkspaceService = {
  createWorkspace: (workspaceData: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'stats'>) =>
    Promise.resolve(demoDataStore.createWorkspace(workspaceData)),
    
  getWorkspace: (workspaceId: string) =>
    Promise.resolve(demoDataStore.getWorkspace(workspaceId)),
    
  getTeamWorkspaces: (teamId: string) =>
    Promise.resolve(demoDataStore.getTeamWorkspaces(teamId)),
    
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) =>
    Promise.resolve(demoDataStore.updateWorkspace(workspaceId, updates)),
};

export const demoTeamTaskService = {
  // Placeholder implementations - can be expanded as needed
  getTeamTasks: () => Promise.resolve([]),
  getAssignedTasks: () => Promise.resolve([]),
  assignTask: () => Promise.resolve(),
  updateAssignmentStatus: () => Promise.resolve(),
};

export { DEMO_MODE };