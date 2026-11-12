import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

type StaffStatus = 'present' | 'absent' | 'leave';

interface RosterItem {
  staffId: string;
  fullName: string;
  status: StaffStatus | null;
}

interface MonthlySummaryItem {
  staffId: string;
  fullName: string;
  present: number;
  absent: number;
  leave: number;
}

const STATUS_OPTIONS: { value: StaffStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
];

const today = () => new Date().toISOString().slice(0, 10);

export function StaffAttendancePage() {
  const { hasPermission } = useAuth();
  const canMark = hasPermission('staff_attendance.mark');
  const [date, setDate] = useState(today);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [draft, setDraft] = useState<Record<string, StaffStatus | null>>({});
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [summary, setSummary] = useState<MonthlySummaryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setError(null);
    setSuccess(null);
    api
      .get<RosterItem[]>(`/staff-attendance/roster?date=${date}`)
      .then((list) => {
        setRoster(list);
        setDraft(Object.fromEntries(list.map((r) => [r.staffId, r.status])));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load roster'));
  }, [date]);

  useEffect(() => {
    api
      .get<MonthlySummaryItem[]>(`/staff-attendance/summary?year=${year}&month=${month}`)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load summary'));
  }, [year, month]);

  const markedRecords = roster
    .filter((r) => draft[r.staffId])
    .map((r) => ({ staffId: r.staffId, status: draft[r.staffId] as StaffStatus }));
  const unmarkedCount = roster.length - markedRecords.length;

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (markedRecords.length === 0) {
      setError('Mark at least one staff member before saving');
      return;
    }
    setSaving(true);
    try {
      await api.post('/staff-attendance/mark', { date, records: markedRecords });
      setSuccess(`Saved attendance for ${markedRecords.length} staff member(s).`);
      setSummary(await api.get<MonthlySummaryItem[]>(`/staff-attendance/summary?year=${year}&month=${month}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Staff Attendance</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="subcard-row" style={{ justifyContent: 'space-between' }}>
          <div className="subcard-row">
            <label className="mt-0">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
          </div>
          <span className="text-muted">
            {unmarkedCount > 0 ? `${unmarkedCount} not yet marked` : 'All staff marked'}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              {STATUS_OPTIONS.map((o) => (
                <th key={o.value} style={{ textAlign: 'center' }}>
                  {o.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No active staff members.
                </td>
              </tr>
            )}
            {roster.map((r) => (
              <tr key={r.staffId}>
                <td>{r.fullName}</td>
                {STATUS_OPTIONS.map((o) => (
                  <td key={o.value} style={{ textAlign: 'center' }}>
                    <input
                      type="radio"
                      name={`staff-${r.staffId}`}
                      checked={draft[r.staffId] === o.value}
                      disabled={!canMark}
                      onChange={() => setDraft((prev) => ({ ...prev, [r.staffId]: o.value }))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canMark && roster.length > 0 && (
        <div className="form-actions">
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Attendance'}
          </button>
        </div>
      )}

      <h2 className="section-heading">Monthly Summary</h2>
      <div className="card">
        <div className="subcard-row" style={{ marginBottom: 'var(--space-3)' }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 'auto' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}
              </option>
            ))}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }} />
        </div>
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th style={{ textAlign: 'right' }}>Present</th>
              <th style={{ textAlign: 'right' }}>Absent</th>
              <th style={{ textAlign: 'right' }}>Leave</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No active staff members.
                </td>
              </tr>
            )}
            {summary.map((s) => (
              <tr key={s.staffId}>
                <td>{s.fullName}</td>
                <td style={{ textAlign: 'right' }}>{s.present}</td>
                <td style={{ textAlign: 'right' }}>{s.absent}</td>
                <td style={{ textAlign: 'right' }}>{s.leave}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
