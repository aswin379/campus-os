import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface RoleDto {
  id: string;
  name: string;
}

interface StaffDto {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  roleIds: string[];
}

export function StaffListPage() {
  const { hasPermission } = useAuth();
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', roleId: '' });
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const canCreate = hasPermission('staff.create');
  const canEdit = hasPermission('staff.edit');

  async function refresh() {
    const [staffList, roleList] = await Promise.all([
      api.get<StaffDto[]>('/staff'),
      api.get<RoleDto[]>('/roles'),
    ]);
    setStaff(staffList);
    setRoles(roleList);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.roleId) {
      setError('Select a role (e.g. Admin or Staff) for this staff member');
      return;
    }
    try {
      await api.post('/staff', { fullName: form.fullName, email: form.email, password: form.password, roleIds: [form.roleId] });
      setForm({ fullName: '', email: '', password: '', roleId: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create staff');
    }
  }

  async function toggleActive(s: StaffDto) {
    try {
      await api.patch(`/staff/${s.id}/active`, { isActive: !s.isActive });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update staff');
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTargetId) return;
    setError(null);
    setResetting(true);
    try {
      await api.post(`/staff/${resetTargetId}/reset-password`, { newPassword: resetPassword });
      setResetTargetId(null);
      setResetPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Staff</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.fullName}</td>
                <td>{s.email}</td>
                <td>{s.isSuperAdmin ? 'Super Admin' : roles.filter((r) => s.roleIds.includes(r.id)).map((r) => r.name).join(', ')}</td>
                <td>
                  <StatusBadge status={s.isActive ? 'active' : 'inactive'} />
                </td>
                {canEdit && (
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!s.isSuperAdmin && (
                        <button type="button" className="btn-secondary" onClick={() => toggleActive(s)}>
                          {s.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setResetTargetId(s.id);
                          setResetPassword('');
                        }}
                      >
                        Reset Password
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetTargetId && (
        <div className="card">
          <h2 className="mt-0">Reset Password for {staff.find((s) => s.id === resetTargetId)?.fullName}</h2>
          <form onSubmit={handleResetPassword}>
            <div className="subcard-row">
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                minLength={8}
                required
                autoFocus
              />
              <button type="submit" disabled={resetting}>
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setResetTargetId(null)}>
                Cancel
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
              This immediately signs the staff member out of any devices they're currently logged in on.
            </p>
          </form>
        </div>
      )}

      {canCreate && (
        <div className="card">
          <h2 className="mt-0">Add Staff</h2>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div>
                <label>Full name</label>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div>
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label>Role *</label>
                <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} required>
                  <option value="">Select a role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit">Add Staff</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
