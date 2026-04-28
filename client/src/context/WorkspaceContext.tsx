import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getUserOrganizations } from '../services/organizationService'

export type AppRole = 'owner' | 'admin' | 'member' | 'viewer'
export interface Organization { id: string; name: string; slug: string | null; description: string | null; parent_id: string | null }
export interface WorkspaceMember { org_id: string; user_id: string; role: AppRole; organization: Organization }

interface WorkspaceContextType {
  currentWorkspace: Organization | null
  workspaces: WorkspaceMember[]
  isLoading: boolean
  isSuspended: boolean
  switchWorkspace: (orgId: string | null) => void
  refreshWorkspaces: () => Promise<void>
  userRole: AppRole | null
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [currentWorkspace, setCurrentWorkspace] = useState<Organization | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSuspended] = useState(false)
  const [userRole, setUserRole] = useState<AppRole | null>(null)

  const fetchWorkspaces = async () => {
    if (!user) { setWorkspaces([]); setCurrentWorkspace(null); setIsLoading(false); return }
    try {
      setIsLoading(true)
      const members = await getUserOrganizations(user.id)
      setWorkspaces(members as WorkspaceMember[])
      const savedOrgId = localStorage.getItem('last_workspace_id')
      if (savedOrgId && savedOrgId !== 'personal') {
        const found = members.find(m => m.org_id === savedOrgId)
        if (found) { setCurrentWorkspace(found.organization!); setUserRole(found.role) }
      }
    } catch (err) {
      console.error('[WorkspaceContext]', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchWorkspaces() }, [user?.id])

  const switchWorkspace = (orgId: string | null) => {
    if (!orgId || orgId === 'personal') {
      setCurrentWorkspace(null); setUserRole(null)
      localStorage.setItem('last_workspace_id', 'personal')
    } else {
      const found = workspaces.find(w => w.org_id === orgId)
      if (found) {
        setCurrentWorkspace(found.organization)
        setUserRole(found.role)
        localStorage.setItem('last_workspace_id', orgId)
      }
    }
  }

  return (
    <WorkspaceContext.Provider value={{ currentWorkspace, workspaces, isLoading, isSuspended, switchWorkspace, refreshWorkspaces: fetchWorkspaces, userRole }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
