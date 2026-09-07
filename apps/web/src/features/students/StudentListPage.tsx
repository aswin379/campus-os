import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface StudentDto {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  status: string;
}

const STATUSES = ['enquiry', 'active', 'completed', 'dropped', 'suspended'];

export function StudentListPage() {
  const { hasPermission } = useAuth();
  const [students, setStudents] = useState<StudentDto[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const query = params.toString();
    api
      .get<StudentDto[]>(`/students${query ? `?${query}` : ''}`)
      .then(setStudents)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load students'));
  }, [search, status]);

  return (
    <div>
      <div className="page-header">
        <h1>Students</h1>
        {hasPermission('students.create') && (
          <Link to="/students/new">
            <button type="submit">+ Add Student</button>
          </Link>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input placeholder="Search name or admission #" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

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
            {students.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No students found.
                </td>
              </tr>
            )}
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.admissionNumber}</td>
                <td>
                  <Link to={`/students/${s.id}`}>
                    {s.firstName} {s.lastName}
                  </Link>
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
