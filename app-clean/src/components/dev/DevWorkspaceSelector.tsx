import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const DevWorkspaceSelector: React.FC = () => {
  const { currentWorkspace, workspaces, switchWorkspace, isLoading, userRole } = useWorkspace();

  if (isLoading) return null;

  // We only show this in development or if explicitly needed
  if (process.env.NODE_ENV === 'production' && !localStorage.getItem('show_dev_workspace_selector')) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      right: '1rem',
      zIndex: 9999,
      background: 'rgba(30, 41, 59, 0.95)',
      color: 'white',
      padding: '0.75rem',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      fontSize: '12px',
      border: '1px solid #475569',
      backdropFilter: 'blur(4px)',
      maxWidth: '220px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <span>🛠 Workspace Dev</span>
        <span style={{ 
          fontSize: '10px', 
          background: '#3b82f6', 
          padding: '1px 4px', 
          borderRadius: '4px' 
        }}>
          {userRole || 'n/a'}
        </span>
      </div>
      
      <select 
        value={currentWorkspace?.id || 'personal'} 
        onChange={(e) => switchWorkspace(e.target.value)}
        style={{
          width: '100%',
          padding: '4px',
          background: '#0f172a',
          color: 'white',
          border: '1px solid #334155',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        <option value="personal">👤 Personal Workspace</option>
        {workspaces.map((w) => (
          <option key={w.org_id} value={w.org_id}>
            🏢 {w.organization.name}
          </option>
        ))}
      </select>

      <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontSize: '10px' }}>
        {currentWorkspace ? (
          <div>
            <div>ID: {currentWorkspace.id.substring(0, 8)}...</div>
          </div>
        ) : (
          "Modo Personal (org_id = NULL)"
        )}
      </div>
    </div>
  );
};

export default DevWorkspaceSelector;
