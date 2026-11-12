import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface CourseDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  durationValue: number;
  durationUnit: string;
  status: string;
}

interface AssessmentComponent {
  name: string;
  maxMarks: number;
  weightPercent: number;
  sequence: number;
}

interface BatchDto {
  id: string;
  batchName: string;
  startDate: string;
  endDatePlanned: string;
  endDateActual: string | null;
  status: string;
}

interface EnrollmentWithStudentDto {
  id: string;
  studentId: string;
  enrollmentDate: string;
  status: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
}

interface StudentSummary {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
}

const BATCH_STATUSES = ['upcoming', 'ongoing', 'completed', 'archived'];

interface FeeInstallmentInput {
  installmentNumber: number;
  amount: number;
  dueOffsetDays: number;
}

interface FeeChargeInput {
  name: string;
  amount: number;
  isOptional: boolean;
}

interface FeeStructureDto {
  id: string;
  name: string;
  totalAmount: number;
  effectiveFrom: string;
  isActive: boolean;
  installments: FeeInstallmentInput[];
  additionalCharges: FeeChargeInput[];
}

function FeeStructureSection({ courseId }: { courseId: string }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('fees.structure.manage');
  const [structures, setStructures] = useState<FeeStructureDto[]>([]);
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState<FeeInstallmentInput[]>([]);
  const [charges, setCharges] = useState<FeeChargeInput[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setStructures(await api.get<FeeStructureDto[]>(`/fee-structures?courseId=${courseId}`));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load fee structures'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const installmentsSum = Number(installments.reduce((s, i) => s + i.amount, 0).toFixed(2));
  const installmentsMismatch = installments.length > 0 && Math.abs(installmentsSum - totalAmount) > 0.01;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(totalAmount > 0)) {
      setError('Enter a total amount greater than zero');
      return;
    }
    const emptyInstallmentIndex = installments.findIndex((i) => !(i.amount > 0));
    if (emptyInstallmentIndex !== -1) {
      setError(`Installment #${emptyInstallmentIndex + 1} needs an amount greater than zero`);
      return;
    }
    if (installmentsMismatch) {
      setError(`Installment amounts (${installmentsSum}) must sum to the total amount (${totalAmount})`);
      return;
    }
    const emptyChargeIndex = charges.findIndex((c) => !c.name.trim() || !(c.amount > 0));
    if (emptyChargeIndex !== -1) {
      setError(`Additional charge #${emptyChargeIndex + 1} needs a name and an amount greater than zero`);
      return;
    }
    try {
      await api.post('/fee-structures', {
        courseId,
        name,
        totalAmount,
        effectiveFrom,
        installments: installments.length ? installments : undefined,
        additionalCharges: charges.length ? charges : undefined,
      });
      setName('');
      setTotalAmount(0);
      setInstallments([]);
      setCharges([]);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create fee structure');
    }
  }

  async function toggleActive(structure: FeeStructureDto) {
    try {
      await api.patch(`/fee-structures/${structure.id}/active`, { isActive: !structure.isActive });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update fee structure');
    }
  }

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {structures.length === 0 && <p className="text-muted mt-0">No fee structures defined yet.</p>}
      {structures.map((s) => (
        <div key={s.id} className="subcard">
          <div className="subcard-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{s.name}</strong>: Rs. {s.totalAmount} from {s.effectiveFrom}{' '}
              <StatusBadge status={s.isActive ? 'active' : 'inactive'} />
              {s.installments.length > 0 && <span className="text-muted"> ({s.installments.length} installments)</span>}
              {s.additionalCharges.length > 0 && (
                <span className="text-muted"> + {s.additionalCharges.map((c) => c.name).join(', ')}</span>
              )}
            </div>
            {canManage && (
              <button type="button" className="btn-secondary" onClick={() => toggleActive(s)}>
                {s.isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        </div>
      ))}

      {canManage && (
        <form onSubmit={handleCreate} className="card" style={{ marginTop: 'var(--space-4)' }}>
          <h4 className="mt-0">New Fee Structure</h4>
          <div className="form-grid">
            <div>
              <label>Plan name</label>
              <input placeholder="Plan name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label>Total amount</label>
              <input
                type="number"
                placeholder="Total amount"
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label>Effective from</label>
              <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <label className="mt-0">Installments (optional — leave empty for a single full-amount installment)</label>
            {installments.length > 0 && (
              <div className="subcard-row text-muted" style={{ fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 24 }}>#</span>
                <span style={{ width: 90 }}>Amount (Rs.)</span>
                <span style={{ width: 130 }}>Due (days after enrollment)</span>
              </div>
            )}
            {installments.map((inst, i) => (
              <div key={i} className="subcard-row" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="text-muted" style={{ width: 24 }}>
                  {inst.installmentNumber}
                </span>
                <input
                  type="number"
                  aria-label="Amount (Rs.)"
                  placeholder="Amount"
                  value={inst.amount}
                  onChange={(e) =>
                    setInstallments((prev) => prev.map((p, idx) => (idx === i ? { ...p, amount: Number(e.target.value) } : p)))
                  }
                  style={{ width: 90 }}
                />
                <input
                  type="number"
                  aria-label="Due, in days after enrollment"
                  placeholder="Days after enrollment"
                  value={inst.dueOffsetDays}
                  onChange={(e) =>
                    setInstallments((prev) =>
                      prev.map((p, idx) => (idx === i ? { ...p, dueOffsetDays: Number(e.target.value) } : p)),
                    )
                  }
                  style={{ width: 130 }}
                />
                <button type="button" className="btn-danger-text" onClick={() => setInstallments((prev) => prev.filter((_, idx) => idx !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setInstallments((prev) => [...prev, { installmentNumber: prev.length + 1, amount: 0, dueOffsetDays: 0 }])
              }
            >
              + Add installment
            </button>
            {installments.length > 0 && (
              <p
                className={installmentsMismatch ? '' : 'text-muted'}
                style={{ fontSize: 12, marginTop: 4, marginBottom: 0, ...(installmentsMismatch ? { color: 'var(--color-danger)' } : {}) }}
              >
                Installments total: {installmentsSum} {installmentsMismatch ? `(must equal ${totalAmount})` : '✓'}
              </p>
            )}
          </div>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <label className="mt-0">Additional charges</label>
            {charges.map((c, i) => (
              <div key={i} className="subcard-row" style={{ marginBottom: 'var(--space-2)' }}>
                <input
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) => setCharges((prev) => prev.map((p, idx) => (idx === i ? { ...p, name: e.target.value } : p)))}
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={c.amount}
                  onChange={(e) =>
                    setCharges((prev) => prev.map((p, idx) => (idx === i ? { ...p, amount: Number(e.target.value) } : p)))
                  }
                  style={{ width: 90 }}
                />
                <button type="button" className="btn-danger-text" onClick={() => setCharges((prev) => prev.filter((_, idx) => idx !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => setCharges((prev) => [...prev, { name: '', amount: 0, isOptional: false }])}>
              + Add charge
            </button>
          </div>

          <div className="form-actions">
            <button type="submit">Create Fee Structure</button>
          </div>
        </form>
      )}
    </div>
  );
}

function BatchRoster({ batchId, canAssign }: { batchId: string; canAssign: boolean }) {
  // The backend joins student display fields into the enrollment list
  // directly, so the roster never has to fetch each enrolled student one at
  // a time (a batch of 60 students would otherwise cost 60 extra requests).
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudentDto[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setEnrollments(await api.get<EnrollmentWithStudentDto[]>(`/enrollments?batchId=${batchId}`));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load roster'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    if (!search) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.get<StudentSummary[]>(`/students?search=${encodeURIComponent(search)}`).then(setResults);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  async function enroll(studentId: string) {
    try {
      await api.post('/enrollments', { studentId, courseBatchId: batchId, enrollmentDate: new Date().toISOString().slice(0, 10) });
      setSearch('');
      setResults([]);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to enroll student');
    }
  }

  return (
    <div className="subcard" style={{ marginTop: 'var(--space-2)' }}>
      {error && <div className="alert alert-error">{error}</div>}
      {enrollments.length === 0 && <p className="text-muted mt-0">No students enrolled in this batch yet.</p>}
      {enrollments.map((e) => (
        <div key={e.id} className="subcard-row" style={{ padding: '4px 0' }}>
          <span>
            {e.admissionNumber} — {e.firstName} {e.lastName}
          </span>
          <StatusBadge status={e.status} />
        </div>
      ))}
      {canAssign && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <input placeholder="Search student to enroll" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%' }} />
          {results.map((s) => (
            <div key={s.id} className="subcard-row" style={{ padding: '6px 0', justifyContent: 'space-between' }}>
              <span>
                {s.admissionNumber} — {s.firstName} {s.lastName}
              </span>
              <button type="button" className="btn-secondary" onClick={() => enroll(s.id)}>
                Enroll
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CourseDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('courses.manage');
  const canConfigureExams = hasPermission('exams.configure');
  const canAssign = hasPermission('courses.assign_students');

  const [course, setCourse] = useState<CourseDto | null>(null);
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [passPercentage, setPassPercentage] = useState(40);
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({ batchName: '', startDate: '', endDatePlanned: '' });
  const [error, setError] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: '', code: '', description: '', durationValue: 1, durationUnit: 'months', status: 'active' });
  const [savingCourse, setSavingCourse] = useState(false);

  async function refresh() {
    if (!id) return;
    const [courseData, structure, batchList] = await Promise.all([
      api.get<CourseDto>(`/courses/${id}`),
      api.get<{ components: AssessmentComponent[]; passPercentage: number | null }>(`/courses/${id}/assessment-structure`),
      api.get<BatchDto[]>(`/courses/${id}/batches`),
    ]);
    setCourse(courseData);
    setCourseForm({
      name: courseData.name,
      code: courseData.code,
      description: courseData.description ?? '',
      durationValue: courseData.durationValue,
      durationUnit: courseData.durationUnit,
      status: courseData.status,
    });
    setComponents(structure.components.length ? structure.components : [{ name: '', maxMarks: 100, weightPercent: 100, sequence: 0 }]);
    setPassPercentage(structure.passPercentage ?? 40);
    setBatches(batchList);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load course'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function updateComponent(i: number, patch: Partial<AssessmentComponent>) {
    setComponents((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function saveStructure() {
    setError(null);
    try {
      await api.put(`/courses/${id}/assessment-structure`, { components, passPercentage });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save assessment structure');
    }
  }

  async function handleSaveCourse(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingCourse(true);
    try {
      await api.patch(`/courses/${id}`, {
        name: courseForm.name,
        code: courseForm.code,
        description: courseForm.description || undefined,
        durationValue: courseForm.durationValue,
        durationUnit: courseForm.durationUnit,
        status: courseForm.status,
      });
      setEditingCourse(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update course');
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleCreateBatch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/courses/${id}/batches`, batchForm);
      setBatchForm({ batchName: '', startDate: '', endDatePlanned: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create batch');
    }
  }

  async function changeBatchStatus(batchId: string, status: string) {
    try {
      await api.patch(`/course-batches/${batchId}/status`, { status });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update batch status');
    }
  }

  if (!course) return <div>Loading…</div>;

  const totalWeight = components.reduce((sum, c) => sum + Number(c.weightPercent || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>
          {course.name} <span className="text-muted">({course.code})</span>
        </h1>
        {canManage && !editingCourse && (
          <button type="button" className="btn-secondary" onClick={() => setEditingCourse(true)}>
            Edit Course
          </button>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {editingCourse ? (
        <form onSubmit={handleSaveCourse} className="card">
          <div className="form-grid">
            <div>
              <label htmlFor="courseName">Name</label>
              <input
                id="courseName"
                value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="courseCode">Code</label>
              <input
                id="courseCode"
                value={courseForm.code}
                onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="courseDurationValue">Duration</label>
              <input
                id="courseDurationValue"
                type="number"
                min={1}
                value={courseForm.durationValue}
                onChange={(e) => setCourseForm({ ...courseForm, durationValue: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label htmlFor="courseDurationUnit">Duration Unit</label>
              <select
                id="courseDurationUnit"
                value={courseForm.durationUnit}
                onChange={(e) => setCourseForm({ ...courseForm, durationUnit: e.target.value })}
              >
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
            <div>
              <label htmlFor="courseStatus">Status</label>
              <select
                id="courseStatus"
                value={courseForm.status}
                onChange={(e) => setCourseForm({ ...courseForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="courseDescription">Description</label>
              <input
                id="courseDescription"
                value={courseForm.description}
                onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={savingCourse}>
              {savingCourse ? 'Saving…' : 'Save Course'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingCourse(false)} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p>
          Duration: {course.durationValue} {course.durationUnit} — Status: <StatusBadge status={course.status} />
          {course.description && <> — {course.description}</>}
        </p>
      )}

      <h2>Assessment Structure</h2>
      <div className="card">
        {components.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: canConfigureExams ? '1fr 90px 90px 70px' : '1fr 90px 90px',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>
              Component Name
            </span>
            <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>
              Max Marks
            </span>
            <span className="text-muted" style={{ fontSize: 12, fontWeight: 600 }}>
              Weight %
            </span>
          </div>
        )}
        {components.map((c, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: canConfigureExams ? '1fr 90px 90px 70px' : '1fr 90px 90px',
              gap: 'var(--space-2)',
              alignItems: 'center',
              marginBottom: 'var(--space-2)',
            }}
          >
            <input
              placeholder="Component name"
              value={c.name}
              onChange={(e) => updateComponent(i, { name: e.target.value })}
              disabled={!canConfigureExams}
              style={{ margin: 0, width: '100%' }}
            />
            <input
              type="number"
              placeholder="Max marks"
              value={c.maxMarks}
              onChange={(e) => updateComponent(i, { maxMarks: Number(e.target.value) })}
              disabled={!canConfigureExams}
              style={{ margin: 0, width: '100%' }}
            />
            <input
              type="number"
              placeholder="Weight %"
              value={c.weightPercent}
              onChange={(e) => updateComponent(i, { weightPercent: Number(e.target.value) })}
              disabled={!canConfigureExams}
              style={{ margin: 0, width: '100%' }}
            />
            {canConfigureExams && (
              <button type="button" className="btn-danger-text" onClick={() => setComponents((prev) => prev.filter((_, idx) => idx !== i))}>
                Remove
              </button>
            )}
          </div>
        ))}
        {canConfigureExams && (
          <button type="button" className="btn-secondary" onClick={() => setComponents((prev) => [...prev, { name: '', maxMarks: 100, weightPercent: 0, sequence: prev.length }])}>
            + Add component
          </button>
        )}
        <p className={totalWeight === 100 ? 'text-muted' : ''} style={totalWeight !== 100 ? { color: 'var(--color-danger)' } : undefined}>
          Total weight: {totalWeight}% (must equal 100%)
        </p>
        <div>
          <label>Pass percentage</label>
          <input
            type="number"
            value={passPercentage}
            onChange={(e) => setPassPercentage(Number(e.target.value))}
            style={{ width: 80 }}
            disabled={!canConfigureExams}
          />
        </div>
        {canConfigureExams && (
          <div className="form-actions">
            <button type="button" onClick={saveStructure}>
              Save Assessment Structure
            </button>
          </div>
        )}
      </div>

      {hasPermission('fees.structure.view') && (
        <>
          <h2>Fee Structure</h2>
          <FeeStructureSection courseId={id!} />
        </>
      )}

      <h2>Batches</h2>
      {batches.length === 0 && <p className="text-muted">No batches yet.</p>}
      {batches.map((b) => (
        <div key={b.id} className="card">
          <div className="subcard-row" style={{ justifyContent: 'space-between' }}>
            <div className="subcard-row">
              <button type="button" className="btn-text" onClick={() => setExpandedBatch(expandedBatch === b.id ? null : b.id)}>
                {expandedBatch === b.id ? '▾' : '▸'}
              </button>
              <strong>{b.batchName}</strong>
              <span className="text-muted">
                {b.startDate} → {b.endDatePlanned}
              </span>
              <StatusBadge status={b.status} />
            </div>
            {canManage && (
              <select value={b.status} onChange={(e) => changeBatchStatus(b.id, e.target.value)}>
                {BATCH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
          {expandedBatch === b.id && <BatchRoster batchId={b.id} canAssign={canAssign} />}
        </div>
      ))}

      {canManage && (
        <form onSubmit={handleCreateBatch} className="card">
          <h3 className="mt-0">Add Batch</h3>
          <div className="form-grid">
            <div>
              <label>Batch name</label>
              <input
                placeholder="Batch name"
                value={batchForm.batchName}
                onChange={(e) => setBatchForm({ ...batchForm, batchName: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Start date</label>
              <input
                type="date"
                value={batchForm.startDate}
                onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Planned end date</label>
              <input
                type="date"
                value={batchForm.endDatePlanned}
                onChange={(e) => setBatchForm({ ...batchForm, endDatePlanned: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit">Add Batch</button>
          </div>
        </form>
      )}
    </div>
  );
}
