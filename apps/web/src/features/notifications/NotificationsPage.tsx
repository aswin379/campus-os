import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';
import { formatIST } from '../../lib/formatDate';

interface TemplateDto {
  key: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
}

interface SettingDto {
  channel: string;
  providerName: string;
  config: Record<string, unknown>;
}

interface LogDto {
  id: string;
  recipientType: string;
  recipientId: string;
  channel: string;
  templateKey: string;
  status: string;
  providerName: string;
  sentAt: string | null;
  createdAt: string;
}

function TemplateEditor({ template, canManage, onSaved }: { template: TemplateDto; canManage: boolean; onSaved: () => void }) {
  const [subject, setSubject] = useState(template.subject ?? '');
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate);
  const [isActive, setIsActive] = useState(template.isActive);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await api.put('/notifications/templates', {
        key: template.key,
        channel: template.channel,
        subject: subject || undefined,
        bodyTemplate,
        isActive,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
    }
  }

  return (
    <div className="subcard">
      <h4 className="mt-0">
        {template.key} <span className="text-muted">({template.channel})</span>
      </h4>
      {error && <div className="alert alert-error">{error}</div>}
      {template.channel === 'email' && (
        <div>
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canManage} style={{ width: '100%' }} />
        </div>
      )}
      <div>
        <label>Body (use {'{{variableName}}'} placeholders)</label>
        <textarea
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          disabled={!canManage}
          rows={3}
          style={{ width: '100%' }}
        />
      </div>
      <label className="checkbox-inline" style={{ marginTop: 'var(--space-2)' }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={!canManage} />
        Active
      </label>
      {canManage && (
        <div className="form-actions" style={{ marginTop: 'var(--space-3)' }}>
          <button type="button" onClick={save}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('notifications.manage');
  const canViewLogs = hasPermission('notifications.view_logs');

  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [settings, setSettings] = useState<SettingDto[]>([]);
  const [logs, setLogs] = useState<LogDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refreshTemplates() {
    setTemplates(await api.get<TemplateDto[]>('/notifications/templates'));
  }

  useEffect(() => {
    if (canManage) {
      refreshTemplates().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load templates'));
      api.get<SettingDto[]>('/notifications/settings').then(setSettings);
    }
    if (canViewLogs) {
      api.get<LogDto[]>('/notifications/logs').then(setLogs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProvider(channel: string, providerName: string) {
    try {
      await api.put('/notifications/settings', { channel, providerName, config: {} });
      setSettings(await api.get<SettingDto[]>('/notifications/settings'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save provider setting');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Notifications</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {canManage && (
        <>
          <h2>Provider Settings</h2>
          <div className="card">
            <p className="mt-0">
              Only "console" is implemented today — it logs the message server-side instead of sending a real SMS/email.
              Real gateways (MSG91, Twilio, SendGrid, etc.) can be added later without changing this screen.
            </p>
            {(['sms', 'email'] as const).map((channel) => {
              const current = settings.find((s) => s.channel === channel)?.providerName ?? 'console';
              return (
                <div key={channel} className="subcard-row" style={{ marginBottom: 8 }}>
                  <label className="mt-0" style={{ textTransform: 'uppercase' }}>
                    {channel}
                  </label>
                  <select value={current} onChange={(e) => saveProvider(channel, e.target.value)}>
                    <option value="console">console (default)</option>
                  </select>
                </div>
              );
            })}
          </div>

          <h2>Templates</h2>
          {templates.map((t) => (
            <TemplateEditor key={t.key} template={t} canManage={canManage} onSaved={refreshTemplates} />
          ))}
        </>
      )}

      {canViewLogs && (
        <>
          <h2>Notification Logs</h2>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Template</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Provider</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                      No notifications sent yet.
                    </td>
                  </tr>
                )}
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{formatIST(l.createdAt)}</td>
                    <td>{l.templateKey}</td>
                    <td>{l.channel}</td>
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                    <td>{l.providerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
