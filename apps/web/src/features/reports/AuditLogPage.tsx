import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { formatIST } from '../../lib/formatDate';

interface AuditLogEntry {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
    api
      .get<AuditLogEntry[]>(`/reports/audit-log${query}`)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load audit log'));
  }, [entityType]);

  return (
    <div>
      <div className="page-header">
        <h1>Audit Log</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <input
          placeholder="Filter by entity type (e.g. student, fee_transaction)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          style={{ width: 340 }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>When (IST)</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No audit entries found.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{formatIST(e.createdAt)}</td>
                <td>{e.actorName ?? 'system'}</td>
                <td>{e.action}</td>
                <td className="text-muted">
                  {e.entityType} / {e.entityId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
