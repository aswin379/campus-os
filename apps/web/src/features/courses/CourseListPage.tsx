import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface CourseDto {
  id: string;
  name: string;
  code: string;
  durationValue: number;
  durationUnit: string;
  status: string;
}

export function CourseListPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('courses.manage');
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', durationValue: 6, durationUnit: 'months' });

  async function refresh() {
    setCourses(await api.get<CourseDto[]>('/courses'));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load courses'));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/courses', form);
      setForm({ name: '', code: '', durationValue: 6, durationUnit: 'months' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create course');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Courses</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No courses yet.
                </td>
              </tr>
            )}
            {courses.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>
                  <Link to={`/courses/${c.id}`}>{c.name}</Link>
                </td>
                <td>
                  {c.durationValue} {c.durationUnit}
                </td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="card">
          <h2 className="mt-0">Add Course</h2>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div>
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label>Code</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div>
                <label>Duration</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    value={form.durationValue}
                    onChange={(e) => setForm({ ...form, durationValue: Number(e.target.value) })}
                    style={{ width: 80 }}
                  />
                  <select value={form.durationUnit} onChange={(e) => setForm({ ...form, durationUnit: e.target.value })}>
                    <option value="months">months</option>
                    <option value="years">years</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit">Add Course</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
