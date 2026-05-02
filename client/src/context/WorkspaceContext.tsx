import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { getUserOrganizations } from '../services/organizationService'
import { storage } from '../lib/storage'

export type AppRole = 'owner' | 'admin' | 'member' | 'viewer'
export interface Organization {
  id: string
  name: string
  slug: string | null
  description: string | null
  parent_id: string | null
}
export interface WorkspaceMember {
  org_id: string
  user_id: string
  role: AppRole
  organization: Organization
}

interface WorkspaceContextType {
  currentWorkspace: Organization | null
  workspaces: WorkspaceMember[]
  isLoading: boolean
  isSuspended: boolean
  switchWorkspace: (orgId: string | null) => void
  refreshWorkspaces: () => Promise<void>
  userRole: AppRole | null
}

const WORKSPACE_KEY = 'last_workspace_id'
/**
 * Key written to localStorage when the active workspace changes.
 * Other tabs watch for this via the `storage` event (fix #5).
 */
const WORKSPACE_BROADCAST_KEY = 'workspace_switch'

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [currentWorkspace, setCurrentWorkspace] = useState<Organization | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSuspended] = useState(false)
  const [userRole, setUserRole] = useState<AppRole | null>(null)

  // ---------------------------------------------------------------------------
  // Reset when user logs out (fix #2)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setCurrentWorkspace(null)
      setWorkspaces([])
      setUserRole(null)
      setIsLoading(false)
    }
  }, [user])

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([])
      setCurrentWorkspace(null)
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const members = await getUserOrganizations(user.id)
      setWorkspaces(members as WorkspaceMember[])
      const savedOrgId = storage.get(WORKSPACE_KEY)
      if (savedOrgId && savedOrgId !== 'personal') {
        const found = (members as WorkspaceMember[]).find(m => m.org_id === savedOrgId)
        if (found) {
          setCurrentWorkspace(found.organization!)
          setUserRole(found.role)
        }
      }
    } catch (err) {
      console.error('[WorkspaceContext]', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => { fetchWorkspaces() }, [fetchWorkspaces])

  // ---------------------------------------------------------------------------
  // Cross-tab workspace sync (fix #5)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storage.key(WORKSPACE_BROADCAST_KEY) || !e.newValue) return
      // Another tab switched workspace — reload our workspaces to pick up the
      // same selection without a full page refresh.
      fetchWorkspaces()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [fetchWorkspaces])

  const switchWorkspace = useCallback(
    (orgId: string | null) => {
      if (!orgId || orgId === 'personal') {
        setCurrentWorkspace(null)
        setUserRole(null)
        storage.set(WORKSPACE_KEY, 'personal')
      } else {
        const found = workspaces.find(w => w.org_id === orgId)
        if (found) {
          setCurrentWorkspace(found.organization)
          setUserRole(found.role)
          storage.set(WORKSPACE_KEY, orgId)
        }
      }
      // Broadcast to other tabs (fix #5).
      storage.set(WORKSPACE_BROADCAST_KEY, String(Date.now()))
      storage.remove(WORKSPACE_BROADCAST_KEY)
    },
    [workspaces],
  )

  const value = useMemo(
    () => ({
      currentWorkspace,
      workspaces,
      isLoading,
      isSuspended,
      switchWorkspace,
      refreshWorkspaces: fetchWorkspaces,
      userRole,
    }),
    [currentWorkspace, workspaces, isLoading, isSuspended, switchWorkspace, fetchWorkspaces, userRole],
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
