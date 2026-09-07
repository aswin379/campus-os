import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  interestedCourseId: string | null;
  assignedTo: string | null;
  notes: string | null;
}

interface CourseDto {
  id: string;
  name: string;
  code: string;
}

interface StaffDto {
  id: string;
  fullName: string;
  isActive: boolean;
}

interface FollowupDto {
  id: string;
  followupDate: string;
  notes: string;
  nextFollowupDate: string | null;
  createdByName: string;
  createdAt: string;
}

const STATUSES = ['new', 'contacted', 'interested', 'converted', 'lost'];
const SOURCES = ['walk_in', 'phone', 'website', 'referral', 'social_media', 'advertisement', 'other'];

function FollowupPanel({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const [followups, setFollowups] = useState<FollowupDto[]>([]);
  const [followupDate, setFollowupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setFollowups(await api.get<FollowupDto[]>(`/leads/${leadId}/followups`));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load followups'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post(`/leads/${leadId}/followups`, {
        followupDate,
        notes,
        nextFollowupDate: nextFollowupDate || undefined,
      });
      setNotes('');
      setNextFollowupDate('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add followup');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 className="mt-0">Followups</h3>
      {error && <div className="alert alert-error">{error}</div>}

      {followups.length === 0 && <p className="text-muted">No followups logged yet.</p>}
      {followups.map((f) => (
        <div key={f.id} className="subcard">
          <div className="subcard-row" style={{ justifyContent: 'space-between' }}>
            <strong>{f.followupDate}</strong>
            <span className="text-muted">by {f.createdByName}</span>
          </div>
          <p className="mt-0" style={{ marginBottom: f.nextFollowupDate ? 4 : 0 }}>
            {f.notes}
          </p>
          {f.nextFollowupDate && <p className="text-muted mt-0" style={{ marginBottom: 0 }}>Next followup: {f.nextFollowupDate}</p>}
        </div>
      ))}

      {canEdit && (
        <form onSubmit={handleAdd} style={{ marginTop: 'var(--space-3)' }}>
          <h4>Add Followup</h4>
          <div className="form-grid">
            <div>
              <label>Followup date</label>
              <input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} required />
            </div>
            <div>
              <label>Next followup date (optional)</label>
              <input type="date" value={nextFollowupDate} onChange={(e) => setNextFollowupDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: '100%' }} required />
          </div>
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add Followup'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function LeadFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(isEdit ? 'leads.edit' : 'leads.create');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('walk_in');
  const [status, setStatus] = useState('new');
  const [interestedCourseId, setInterestedCourseId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<CourseDto[]>('/courses').then(setCourses);
    api.get<StaffDto[]>('/staff').then((list) => setStaff(list.filter((s) => s.isActive)));
  }, []);

  useEffect(() => {
    if (!id) return;
    api.get<LeadDto>(`/leads/${id}`).then((l) => {
      setFullName(l.fullName);
      setPhone(l.phone);
      setEmail(l.email ?? '');
      setSource(l.source);
      setStatus(l.status);
      setInterestedCourseId(l.interestedCourseId ?? '');
      setAssignedTo(l.assignedTo ?? '');
      setNotes(l.notes ?? '');
    });
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit) {
        await api.patch(`/leads/${id}`, {
          fullName,
          phone,
          email: email || null,
          source,
          status,
          interestedCourseId: interestedCourseId || null,
          assignedTo: assignedTo || null,
          notes: notes || null,
        });
      } else {
        const created = await api.post<LeadDto>('/leads', {
          fullName,
          phone,
          email: email || undefined,
          source,
          interestedCourseId: interestedCourseId || undefined,
          assignedTo: assignedTo || undefined,
          notes: notes || undefined,
        });
        navigate(`/leads/${created.id}`);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>
          {isEdit ? 'Edit Lead' : 'Add Lead'}
          {isEdit && (
            <>
              {' '}
              <StatusBadge status={status} />
            </>
          )}
        </h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={!canEdit}>
          <div className="card">
            <div className="form-grid">
              <div>
                <label htmlFor="fullName">Full name</label>
                <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="source">Source</label>
                <select id="source" value={source} onChange={(e) => setSource(e.target.value)}>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {isEdit && (
                <div>
                  <label htmlFor="status">Status</label>
                  <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="interestedCourse">Interested course</label>
                <select id="interestedCourse" value={interestedCourseId} onChange={(e) => setInterestedCourseId(e.target.value)}>
                  <option value="">— None —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assignedTo">Assigned to</label>
                <select id="assignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%' }} />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </fieldset>
      </form>

      {isEdit && <FollowupPanel leadId={id!} canEdit={hasPermission('leads.edit')} />}
    </div>
  );
}
