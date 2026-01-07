import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

export type AppRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
}

export interface WorkspaceMember {
  org_id: string;
  user_id: string;
  role: AppRole;
  organization: Organization;
}

interface WorkspaceContextType {
  currentWorkspace: Organization | null; // null means Personal Workspace
  workspaces: WorkspaceMember[];
  isLoading: boolean;
  switchWorkspace: (orgId: string | null) => void;
  userRole: AppRole | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Organization | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);

  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        return;
      }

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          org_id,
          user_id,
          role,
          organization:organizations (
            id,
            name,
            slug
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('[WorkspaceContext] Error fetching workspaces:', error);
        return;
      }

      setWorkspaces(data as any[]);
      console.log('[WorkspaceContext] Fetched workspaces:', data); // DIAGNOSTIC LOG
      
      // Load last used workspace from localStorage if available
      const savedOrgId = localStorage.getItem('last_workspace_id');
      if (savedOrgId && savedOrgId !== 'personal') {
        const found = (data as any[]).find(w => w.org_id === savedOrgId);
        if (found) {
          setCurrentWorkspace(found.organization);
          setUserRole(found.role);
        }
      }
    } catch (err) {
      console.error('[WorkspaceContext] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchWorkspaces();
      } else if (event === 'SIGNED_OUT') {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setUserRole(null);
        localStorage.removeItem('last_workspace_id');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const switchWorkspace = (orgId: string | null) => {
    if (!orgId || orgId === 'personal') {
      setCurrentWorkspace(null);
      setUserRole(null);
      localStorage.setItem('last_workspace_id', 'personal');
    } else {
      const found = workspaces.find(w => w.org_id === orgId);
      if (found) {
        setCurrentWorkspace(found.organization);
        setUserRole(found.role);
        localStorage.setItem('last_workspace_id', orgId);
      }
    }
  };

  return (
    <WorkspaceContext.Provider value={{ 
      currentWorkspace, 
      workspaces, 
      isLoading, 
      switchWorkspace,
      userRole 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
