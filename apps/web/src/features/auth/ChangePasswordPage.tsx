import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Change Password</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">Password changed successfully.</div>}

      <div className="card" style={{ maxWidth: 420 }}>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div>
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
