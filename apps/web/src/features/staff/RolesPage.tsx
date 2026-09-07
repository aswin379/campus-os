import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';

interface PermissionDto {
  key: string;
  module: string;
  description: string | null;
}

interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
}

export function RolesPage() {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [permissions, setPermissions] = useState<PermissionDto[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [roleList, permissionList] = await Promise.all([
      api.get<RoleDto[]>('/roles'),
      api.get<PermissionDto[]>('/permissions'),
    ]);
    setRoles(roleList);
    setPermissions(permissionList);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, []);

  async function handleCreateRole(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/roles', { name: newRoleName, permissionKeys: [] });
      setNewRoleName('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create role');
    }
  }

  async function togglePermission(role: RoleDto, key: string) {
    const next = role.permissionKeys.includes(key)
      ? role.permissionKeys.filter((k) => k !== key)
      : [...role.permissionKeys, key];
    try {
      await api.patch(`/roles/${role.id}/permissions`, { permissionKeys: next });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  }

  const modules = Array.from(new Set(permissions.map((p) => p.module)));

  return (
    <div>
      <div className="page-header">
        <h1>Roles & Permissions</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleCreateRole} className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input placeholder="New role name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required style={{ flex: 1 }} />
        <button type="submit">Add Role</button>
      </form>

      {roles.map((role) => (
        <div key={role.id} className="card">
          <h3 className="mt-0">
            {role.name} {role.isSystem && <span className="badge" style={{ marginLeft: 8 }}>system</span>}
          </h3>
          {modules.map((mod) => (
            <div key={mod} className="subcard">
              <div className="text-muted" style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                {mod}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                {permissions
                  .filter((p) => p.module === mod)
                  .map((p) => (
                    <label key={p.key} className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={role.permissionKeys.includes(p.key)}
                        onChange={() => togglePermission(role, p.key)}
                      />
                      {p.key}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
