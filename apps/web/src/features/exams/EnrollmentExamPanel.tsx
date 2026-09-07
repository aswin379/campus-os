import { useEffect, useState } from 'react';
import { api, ApiError, BASE_URL } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface MarkDto {
  componentId: string;
  componentName: string;
  maxMarks: number;
  weightPercent: number;
  marksObtained: number | null;
}

interface ResultDto {
  totalPercentage: number | null;
  resultStatus: string;
  passPercentage: number;
  publishedAt: string | null;
  certificateNumber: string | null;
}

interface EnrollmentDto {
  id: string;
  status: string;
  courseName: string;
  courseCode: string;
  batchName: string;
}

export function StudentExamPanel({ studentId }: { studentId: string }) {
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<EnrollmentDto[]>(`/enrollments?studentId=${studentId}`)
      .then(setEnrollments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load enrollments'));
  }, [studentId]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (enrollments.length === 0) return <p className="text-muted">No course enrollments yet.</p>;

  return (
    <div>
      {enrollments.map((e) => (
        <EnrollmentExamPanel
          key={e.id}
          enrollmentId={e.id}
          courseName={e.courseName}
          courseCode={e.courseCode}
          batchName={e.batchName}
        />
      ))}
    </div>
  );
}

function EnrollmentExamPanel({
  enrollmentId,
  courseName,
  courseCode,
  batchName,
}: {
  enrollmentId: string;
  courseName: string;
  courseCode: string;
  batchName: string;
}) {
  const { hasPermission } = useAuth();
  const canEnter = hasPermission('exams.enter_marks');
  const canPublish = hasPermission('exams.publish_results');

  const [marks, setMarks] = useState<MarkDto[]>([]);
  const [result, setResult] = useState<ResultDto | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [publishing, setPublishing] = useState(false);

  async function refresh() {
    const [marksList, resultData] = await Promise.all([
      api.get<MarkDto[]>(`/exams/marks/${enrollmentId}`),
      api.get<ResultDto>(`/exams/results/${enrollmentId}`),
    ]);
    setMarks(marksList);
    setPending(Object.fromEntries(marksList.map((m) => [m.componentId, m.marksObtained?.toString() ?? ''])));
    setResult(resultData);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load exam info'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentId]);

  async function saveMark(componentId: string) {
    setError(null);
    const value = pending[componentId];
    if (value === undefined || value === '') return;
    setSavingCount((c) => c + 1);
    try {
      await api.post('/exams/marks', { enrollmentId, assessmentComponentId: componentId, marksObtained: Number(value) });
      // Only resync the computed result, not the whole marks/pending map —
      // a full refresh() here would overwrite marks the user is still
      // typing into a different (not yet blurred) field with stale server
      // data, discarding an unsaved edit that was in progress at the same time.
      setResult(await api.get<ResultDto>(`/exams/results/${enrollmentId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save marks');
    } finally {
      setSavingCount((c) => c - 1);
    }
  }

  async function handlePublish() {
    setError(null);
    if (publishing || savingCount > 0) return; // avoid publishing against marks a concurrent save hasn't finished writing yet
    setPublishing(true);
    try {
      await api.post(`/exams/results/${enrollmentId}/publish`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish result');
    } finally {
      setPublishing(false);
    }
  }

  if (marks.length === 0)
    return (
      <p className="text-muted">
        {courseName} ({courseCode}) — {batchName}: no assessment structure configured for this course.
      </p>
    );

  return (
    <div className="card">
      <h4 className="mt-0">
        {courseName} ({courseCode}) <span className="text-muted">— {batchName}</span>
      </h4>
      {error && <div className="alert alert-error">{error}</div>}
      <table style={{ marginBottom: 8 }}>
        <thead>
          <tr>
            <th>Component</th>
            <th>Max Marks</th>
            <th>Weight %</th>
            <th>Marks Obtained</th>
          </tr>
        </thead>
        <tbody>
          {marks.map((m) => (
            <tr key={m.componentId}>
              <td>{m.componentName}</td>
              <td>{m.maxMarks}</td>
              <td>{m.weightPercent}</td>
              <td>
                <input
                  type="number"
                  value={pending[m.componentId] ?? ''}
                  onChange={(e) => setPending((prev) => ({ ...prev, [m.componentId]: e.target.value }))}
                  onBlur={() => saveMark(m.componentId)}
                  disabled={!canEnter}
                  style={{ width: 80 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {result && (
        <p>
          Total: {result.totalPercentage === null ? 'Not yet computed' : `${result.totalPercentage}%`} (pass mark{' '}
          {result.passPercentage}%) — Status: <StatusBadge status={result.resultStatus} />
          {result.publishedAt && <span className="text-muted"> (published)</span>}
        </p>
      )}

      {canPublish && !result?.publishedAt && (
        <button onClick={handlePublish} disabled={result?.resultStatus === 'incomplete' || publishing || savingCount > 0}>
          {publishing ? 'Publishing…' : 'Publish Result'}
        </button>
      )}

      {result?.publishedAt && (
        <div className="form-actions">
          <a href={`${BASE_URL}/exams/results/${enrollmentId}/marksheet`} target="_blank" rel="noreferrer">
            Mark Sheet
          </a>
          {result.certificateNumber && (
            <a href={`${BASE_URL}/exams/results/${enrollmentId}/certificate`} target="_blank" rel="noreferrer">
              Certificate ({result.certificateNumber})
            </a>
          )}
        </div>
      )}
    </div>
  );
}
