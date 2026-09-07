import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

interface CourseDto {
  id: string;
  name: string;
  code: string;
}

interface BatchDto {
  id: string;
  courseId: string;
  batchName: string;
  status: string;
}

interface RosterEntry {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  attendanceId: string | null;
  status: string | null;
}

interface MonthlySummary {
  enrollmentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
}

const STATUSES = ['present', 'absent', 'half_day'] as const;
const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
};

export function AttendancePage() {
  const { hasPermission } = useAuth();
  const canMark = hasPermission('attendance.mark');

  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<CourseDto[]>('/courses').then(setCourses);
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setBatches([]);
      setSelectedBatchId('');
      return;
    }
    api.get<BatchDto[]>(`/courses/${selectedCourseId}/batches`).then((list) => {
      setBatches(list);
      setSelectedBatchId(list[0]?.id ?? '');
    });
  }, [selectedCourseId]);

  async function loadRoster() {
    if (!selectedBatchId || !date) return;
    const list = await api.get<RosterEntry[]>(`/attendance/roster?batchId=${selectedBatchId}&date=${date}`);
    setRoster(list);
    setPendingStatus(Object.fromEntries(list.map((r) => [r.enrollmentId, r.status ?? ''])));
  }

  useEffect(() => {
    loadRoster().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load roster'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId, date]);

  async function loadSummary() {
    if (!selectedBatchId || !date) return;
    const [year, month] = date.split('-');
    const list = await api.get<MonthlySummary[]>(
      `/attendance/summary?batchId=${selectedBatchId}&year=${year}&month=${Number(month)}`,
    );
    setSummary(list);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const records = Object.entries(pendingStatus)
        .filter(([, status]) => status)
        .map(([enrollmentId, status]) => ({ enrollmentId, status }));
      await api.post('/attendance/mark', { batchId: selectedBatchId, date, records });
      await loadRoster();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Attendance</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="mt-0">Course</label>
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mt-0">Batch</label>
          <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mt-0">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {selectedBatchId && (
        <>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((r) => (
                  <tr key={r.enrollmentId}>
                    <td>{r.admissionNumber}</td>
                    <td>
                      {r.firstName} {r.lastName}
                    </td>
                    <td>
                      {STATUSES.map((s) => (
                        <label key={s} className="checkbox-inline" style={{ marginRight: 14 }}>
                          <input
                            type="radio"
                            name={`status-${r.enrollmentId}`}
                            checked={pendingStatus[r.enrollmentId] === s}
                            disabled={!canMark}
                            onChange={() => setPendingStatus((prev) => ({ ...prev, [r.enrollmentId]: s }))}
                          />
                          {STATUS_LABELS[s]}
                        </label>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canMark && (
            <div className="form-actions" style={{ marginTop: 0, marginBottom: 'var(--space-4)' }}>
              <button type="submit" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          )}

          <h2 className="section-heading">Monthly Summary</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => loadSummary().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load summary'))}
          >
            Load summary for {date.slice(0, 7)}
          </button>
          {summary.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'auto', marginTop: 'var(--space-3)' }}>
              <table>
                <thead>
                  <tr>
                    <th>Admission #</th>
                    <th>Name</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Half Day</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.enrollmentId}>
                      <td>{s.admissionNumber}</td>
                      <td>
                        {s.firstName} {s.lastName}
                      </td>
                      <td>{s.presentCount}</td>
                      <td>{s.absentCount}</td>
                      <td>{s.halfDayCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
