import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface LeadDto {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  interestedCourseName: string | null;
  assignedToName: string | null;
  nextFollowupDate: string | null;
  createdAt: string;
}

const STATUSES = ['new', 'contacted', 'interested', 'converted', 'lost'];
const SOURCES = ['walk_in', 'phone', 'website', 'referral', 'social_media', 'advertisement', 'other'];

function formatSource(source: string): string {
  return source
    .split('_')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

const today = new Date().toISOString().slice(0, 10);

export function LeadListPage() {
  const { hasPermission } = useAuth();
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [dueToday, setDueToday] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    if (dueToday) params.set('followupDueToday', 'true');
    const query = params.toString();
    api
      .get<LeadDto[]>(`/leads${query ? `?${query}` : ''}`)
      .then(setLeads)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load leads'));
  }, [search, status, source, dueToday]);

  return (
    <div>
      <div className="page-header">
        <h1>Leads</h1>
        {hasPermission('leads.create') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/leads/bulk-upload">
              <button type="button" className="btn-secondary">
                Bulk Upload
              </button>
            </Link>
            <Link to="/leads/new">
              <button type="submit">+ Add Lead</button>
            </Link>
          </div>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search name, phone, or email" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {formatSource(s)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={dueToday ? '' : 'btn-secondary'}
          onClick={() => setDueToday((v) => !v)}
          title="Show only leads whose next followup is scheduled for today"
        >
          📅 Due Today
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Source</th>
              <th>Interested Course</th>
              <th>Assigned To</th>
              <th>Next Followup</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No leads found.
                </td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link to={`/leads/${l.id}`}>{l.fullName}</Link>
                </td>
                <td>{l.phone}</td>
                <td>{formatSource(l.source)}</td>
                <td>{l.interestedCourseName ?? <span className="text-muted">—</span>}</td>
                <td>{l.assignedToName ?? <span className="text-muted">Unassigned</span>}</td>
                <td>
                  {l.nextFollowupDate ? (
                    <span style={l.nextFollowupDate === today ? { color: 'var(--color-warning)', fontWeight: 700 } : undefined}>
                      {l.nextFollowupDate}
                      {l.nextFollowupDate === today && ' (today)'}
                      {l.nextFollowupDate < today && ' (overdue)'}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
