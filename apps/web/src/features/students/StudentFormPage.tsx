import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, BASE_URL } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { EnrollmentFeePanel } from '../fees/EnrollmentFeePanel';
import { StudentExamPanel } from '../exams/EnrollmentExamPanel';

interface StudentContact {
  contactType: 'guardian' | 'emergency';
  relation: string;
  name: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

interface StudentDto {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  religion: string | null;
  mobileNumber: string | null;
  hasPhoto: boolean;
  status: string;
  admissionDate: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contacts: StudentContact[];
  qualifications: StudentQualification[];
}

interface StudentQualification {
  qualificationName: string;
  institution: string;
  boardOrUniversity: string;
  yearOfPassing: string;
  percentageOrGrade: string;
}

interface StudentRemark {
  id: string;
  remark: string;
  createdByName: string;
  createdAt: string;
}

const emptyQualification: StudentQualification = {
  qualificationName: '',
  institution: '',
  boardOrUniversity: '',
  yearOfPassing: '',
  percentageOrGrade: '',
};

function StudentRemarksPanel({ studentId }: { studentId: string }) {
  const { hasPermission } = useAuth();
  const canAdd = hasPermission('students.remarks');
  const [remarks, setRemarks] = useState<StudentRemark[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    return api.get<StudentRemark[]>(`/students/${studentId}/remarks`).then(setRemarks);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load remarks'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.post(`/students/${studentId}/remarks`, { remark: text.trim() });
      setText('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add remark');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      {error && <div className="alert alert-error">{error}</div>}
      {canAdd && (
        <form onSubmit={handleAdd} className="subcard-row" style={{ marginBottom: 'var(--space-3)' }}>
          <input
            placeholder="Add a remark about this student"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={saving || !text.trim()}>
            {saving ? 'Adding…' : 'Add Remark'}
          </button>
        </form>
      )}
      {remarks.length === 0 && <p className="text-muted mt-0">No remarks yet.</p>}
      {remarks.map((r) => (
        <div key={r.id} className="subcard" style={{ marginBottom: 'var(--space-2)' }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{r.remark}</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {r.createdByName} · {new Date(r.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyContact: StudentContact = {
  contactType: 'guardian',
  relation: '',
  name: '',
  phone: '',
  email: '',
  isPrimary: true,
};

const STATUSES = ['enquiry', 'active', 'completed', 'dropped', 'suspended'];
const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];

interface CourseDto {
  id: string;
  name: string;
  code: string;
}

interface BatchDto {
  id: string;
  batchName: string;
  status: string;
}

function EnrollInCoursePanel({ studentId, onEnrolled }: { studentId: string; onEnrolled: () => void }) {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission('courses.assign_students');

  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!canAssign) return;
    api.get<CourseDto[]>('/courses').then(setCourses);
  }, [canAssign]);

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

  if (!canAssign) return null;

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedBatchId) {
      setError('Select a course batch to enroll into');
      return;
    }
    setEnrolling(true);
    try {
      await api.post('/enrollments', { studentId, courseBatchId: selectedBatchId, enrollmentDate });
      setSelectedCourseId('');
      onEnrolled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to enroll student');
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div className="card">
      <h4 className="mt-0">Enroll in a Course</h4>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleEnroll}>
        <div className="subcard-row">
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} disabled={!selectedCourseId}>
            {batches.length === 0 && <option value="">No batches</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchName} ({b.status})
              </option>
            ))}
          </select>
          <input type="date" value={enrollmentDate} onChange={(e) => setEnrollmentDate(e.target.value)} required />
          <button type="submit" disabled={enrolling || !selectedBatchId}>
            {enrolling ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(isEdit ? 'students.edit' : 'students.create');

  const [admissionNumber, setAdmissionNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [religion, setReligion] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [admissionDate, setAdmissionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [status, setStatus] = useState('enquiry');
  const [contacts, setContacts] = useState<StudentContact[]>([emptyContact]);
  const [qualifications, setQualifications] = useState<StudentQualification[]>([]);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enrollmentVersion, setEnrollmentVersion] = useState(0);

  useEffect(() => {
    if (!id) return;
    api.get<StudentDto>(`/students/${id}`).then((s) => {
      setAdmissionNumber(s.admissionNumber);
      setFirstName(s.firstName);
      setLastName(s.lastName);
      setDateOfBirth(s.dateOfBirth ?? '');
      setGender(s.gender ?? '');
      setBloodGroup(s.bloodGroup ?? '');
      setReligion(s.religion ?? '');
      setMobileNumber(s.mobileNumber ?? '');
      setAdmissionDate(s.admissionDate);
      setAddress(s.address ?? '');
      setCity(s.city ?? '');
      setState(s.state ?? '');
      setPincode(s.pincode ?? '');
      setStatus(s.status);
      setContacts(
        s.contacts.length
          ? s.contacts.map((c) => ({ ...c, relation: c.relation ?? '', email: c.email ?? '' }))
          : [emptyContact],
      );
      setQualifications(
        s.qualifications.map((q) => ({
          qualificationName: q.qualificationName,
          institution: q.institution ?? '',
          boardOrUniversity: q.boardOrUniversity ?? '',
          yearOfPassing: q.yearOfPassing ?? '',
          percentageOrGrade: q.percentageOrGrade ?? '',
        })),
      );
      setHasPhoto(s.hasPhoto);
    });
  }, [id]);

  function updateContact(index: number, patch: Partial<StudentContact>) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function setPrimaryContact(index: number) {
    setContacts((prev) => prev.map((c, i) => ({ ...c, isPrimary: i === index })));
  }

  function addContact() {
    setContacts((prev) => [...prev, { ...emptyContact, isPrimary: false }]);
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQualification(index: number, patch: Partial<StudentQualification>) {
    setQualifications((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function removeQualification(index: number) {
    setQualifications((prev) => prev.filter((_, i) => i !== index));
  }

  const qualificationsPayload = qualifications
    .filter((q) => q.qualificationName.trim())
    .map((q) => ({
      qualificationName: q.qualificationName.trim(),
      institution: q.institution.trim() || undefined,
      boardOrUniversity: q.boardOrUniversity.trim() || undefined,
      yearOfPassing: q.yearOfPassing.trim() || undefined,
      percentageOrGrade: q.percentageOrGrade.trim() || undefined,
    }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    // The backend validates contact email with z.string().email(), which
    // rejects an empty string — send undefined for an unfilled (optional)
    // email instead, or every save with a blank guardian email would 400.
    const contactsPayload = contacts.map((c) => ({ ...c, relation: c.relation || undefined, email: c.email || undefined }));
    try {
      if (isEdit) {
        // Edit always submits the full current state of every field, so an
        // empty value here means the operator cleared it — send an explicit
        // null so the backend actually blanks it out, not `undefined` (which
        // the backend correctly treats as "field omitted, leave unchanged").
        await api.patch(`/students/${id}`, {
          admissionNumber,
          firstName,
          lastName,
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
          bloodGroup: bloodGroup || null,
          religion: religion || null,
          mobileNumber: mobileNumber || null,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          status,
          contacts: contactsPayload,
          qualifications: qualificationsPayload,
        });
        setSuccess('Student updated.');
      } else {
        const created = await api.post<StudentDto>('/students', {
          admissionNumber: admissionNumber || undefined,
          firstName,
          lastName,
          dateOfBirth: dateOfBirth || undefined,
          gender: gender || undefined,
          bloodGroup: bloodGroup || undefined,
          religion: religion || undefined,
          mobileNumber: mobileNumber || undefined,
          admissionDate,
          address: address || undefined,
          city: city || undefined,
          state: state || undefined,
          pincode: pincode || undefined,
          contacts: contactsPayload,
          qualifications: qualificationsPayload,
        });
        navigate(`/students/${created.id}`);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save student');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.upload(`/students/${id}/photo`, formData);
      setHasPhoto(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload photo');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isEdit ? 'Edit Student' : 'Add Student'}</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {isEdit && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {hasPhoto ? (
            <img src={`${BASE_URL}/students/${id}/photo`} alt="Student" className="avatar-lg" />
          ) : (
            <div
              className="avatar-lg text-muted"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: 'var(--color-bg)' }}
            >
              No photo
            </div>
          )}
          {canEdit && (
            <div>
              <label htmlFor="photo" className="mt-0">
                Upload photo
              </label>
              <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={!canEdit}>
          <div className="card">
            <div className="form-grid">
              <div>
                <label htmlFor="admissionNumber">
                  Admission number
                  {isEdit && <span className="required-mark">*</span>}
                </label>
                <input
                  id="admissionNumber"
                  name="admissionNumber"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  placeholder={isEdit ? undefined : 'Auto-generated if left blank'}
                  required={isEdit}
                />
              </div>
              <div>
                <label htmlFor="firstName">
                  First name<span className="required-mark">*</span>
                </label>
                <input id="firstName" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="lastName">
                  Last name<span className="required-mark">*</span>
                </label>
                <input id="lastName" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="dateOfBirth">Date of birth</label>
                <input id="dateOfBirth" name="dateOfBirth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div>
                <label htmlFor="gender">Gender</label>
                <select id="gender" name="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select gender</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bloodGroup">Blood group</label>
                <select id="bloodGroup" name="bloodGroup" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="religion">Religion</label>
                <select id="religion" name="religion" value={religion} onChange={(e) => setReligion(e.target.value)}>
                  <option value="">Select religion</option>
                  {RELIGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mobileNumber">Mobile number</label>
                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
              <div>
                <label htmlFor="admissionDate">
                  Admission date<span className="required-mark">*</span>
                </label>
                <input
                  id="admissionDate"
                  name="admissionDate"
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  required
                />
              </div>
              {isEdit && (
                <div>
                  <label htmlFor="status">Status</label>
                  <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="address">Address</label>
                <input id="address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label htmlFor="city">City</label>
                <input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label htmlFor="state">State</label>
                <input id="state" name="state" value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div>
                <label htmlFor="pincode">Pincode</label>
                <input
                  id="pincode"
                  name="pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="mt-0">Contacts</h3>
            {contacts.map((c, i) => (
              <div key={i} className="subcard">
                <div className="subcard-row">
                  <select
                    value={c.contactType}
                    onChange={(e) => updateContact(i, { contactType: e.target.value as StudentContact['contactType'] })}
                  >
                    <option value="guardian">Guardian</option>
                    <option value="emergency">Emergency</option>
                  </select>
                  <input placeholder="Relation" value={c.relation} onChange={(e) => updateContact(i, { relation: e.target.value })} />
                  <input placeholder="Name *" value={c.name} onChange={(e) => updateContact(i, { name: e.target.value })} required />
                  <input
                    placeholder="Phone *"
                    value={c.phone}
                    onChange={(e) => updateContact(i, { phone: e.target.value.replace(/\D/g, '') })}
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                  <input placeholder="Email" value={c.email} onChange={(e) => updateContact(i, { email: e.target.value })} />
                  <label className="checkbox-inline">
                    <input type="radio" name="primaryContact" checked={c.isPrimary} onChange={() => setPrimaryContact(i)} />
                    Primary
                  </label>
                  <button type="button" className="btn-danger-text" onClick={() => removeContact(i)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={addContact}>
              + Add contact
            </button>
          </div>

          <div className="card">
            <h3 className="mt-0">Academic & Other Qualifications</h3>
            {qualifications.length === 0 && <p className="text-muted mt-0">No qualifications added yet.</p>}
            {qualifications.map((q, i) => (
              <div key={i} className="subcard">
                <div className="subcard-row">
                  <input
                    placeholder="Qualification *"
                    value={q.qualificationName}
                    onChange={(e) => updateQualification(i, { qualificationName: e.target.value })}
                  />
                  <input placeholder="Institution" value={q.institution} onChange={(e) => updateQualification(i, { institution: e.target.value })} />
                  <input
                    placeholder="Board / University"
                    value={q.boardOrUniversity}
                    onChange={(e) => updateQualification(i, { boardOrUniversity: e.target.value })}
                  />
                  <input
                    placeholder="Year"
                    value={q.yearOfPassing}
                    onChange={(e) => updateQualification(i, { yearOfPassing: e.target.value })}
                    style={{ width: 90 }}
                  />
                  <input
                    placeholder="% / Grade"
                    value={q.percentageOrGrade}
                    onChange={(e) => updateQualification(i, { percentageOrGrade: e.target.value })}
                    style={{ width: 110 }}
                  />
                  <button type="button" className="btn-danger-text" onClick={() => removeQualification(i)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => setQualifications((prev) => [...prev, { ...emptyQualification }])}>
              + Add qualification
            </button>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </fieldset>
      </form>

      {isEdit && (
        <>
          <h2 className="section-heading">Courses & Fees</h2>
          <EnrollInCoursePanel studentId={id!} onEnrolled={() => setEnrollmentVersion((v) => v + 1)} />
          <EnrollmentFeePanel key={`fees-${enrollmentVersion}`} studentId={id!} />

          <h2 className="section-heading">Examination & Results</h2>
          <StudentExamPanel key={`exams-${enrollmentVersion}`} studentId={id!} />

          {hasPermission('students.remarks') && (
            <>
              <h2 className="section-heading">Remarks</h2>
              <StudentRemarksPanel studentId={id!} />
            </>
          )}
        </>
      )}
    </div>
  );
}
