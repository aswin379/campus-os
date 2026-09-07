import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import { storage } from '../../lib/storage/index.js';
import * as repo from './repository.js';

export interface StudentDto {
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
  createdAt: string;
  contacts: {
    id: string;
    contactType: string;
    relation: string | null;
    name: string;
    phone: string;
    email: string | null;
    isPrimary: boolean;
  }[];
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ER_DUP_ENTRY';
}

function toDto(row: repo.StudentRow, contacts: repo.StudentContactRow[]): StudentDto {
  return {
    id: row.id,
    admissionNumber: row.admission_number,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    bloodGroup: row.blood_group,
    religion: row.religion,
    mobileNumber: row.mobile_number,
    hasPhoto: Boolean(row.photo_key),
    status: row.status,
    admissionDate: row.admission_date,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    createdAt: row.created_at,
    contacts: contacts.map((c) => ({
      id: c.id,
      contactType: c.contact_type,
      relation: c.relation,
      name: c.name,
      phone: c.phone,
      email: c.email,
      isPrimary: c.is_primary,
    })),
  };
}

export interface StudentContactInput {
  contactType: string;
  relation?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  isPrimary?: boolean;
}

function normalizeContacts(contacts: StudentContactInput[]): repo.StudentContactInput[] {
  return contacts.map((c) => ({
    contactType: c.contactType,
    relation: c.relation ?? null,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    isPrimary: c.isPrimary ?? false,
  }));
}

export async function listStudents(filters: { search?: string; status?: string }): Promise<StudentDto[]> {
  const rows = await repo.listStudents(filters);
  const contactsByStudent = await repo.getContactsForStudents(rows.map((r) => r.id));
  return rows.map((row) => toDto(row, contactsByStudent.get(row.id) ?? []));
}

export async function getStudent(id: string): Promise<StudentDto> {
  const row = await repo.getStudentById(id);
  if (!row) throw new HttpError(404, 'Student not found');
  const contacts = await repo.getContactsForStudent(id);
  return toDto(row, contacts);
}

export async function createStudent(
  actorId: string,
  input: {
    admissionNumber?: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    religion?: string;
    mobileNumber?: string;
    admissionDate: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    contacts: StudentContactInput[];
  },
): Promise<StudentDto> {
  let created: repo.StudentRow;
  try {
    created = await repo.createStudent({
      admissionNumber: input.admissionNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      bloodGroup: input.bloodGroup ?? null,
      religion: input.religion ?? null,
      mobileNumber: input.mobileNumber ?? null,
      admissionDate: input.admissionDate,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      contacts: normalizeContacts(input.contacts),
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'A student with this admission number already exists');
    throw err;
  }

  await recordAudit({
    actorStaffId: actorId,
    action: 'student.create',
    entityType: 'student',
    entityId: created.id,
    afterData: { admissionNumber: created.admission_number, firstName: input.firstName, lastName: input.lastName },
  });

  return getStudent(created.id);
}

export async function updateStudent(
  actorId: string,
  id: string,
  input: {
    admissionNumber?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    bloodGroup?: string | null;
    religion?: string | null;
    mobileNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    status?: string;
    contacts?: StudentContactInput[];
  },
): Promise<StudentDto> {
  const before = await repo.getStudentById(id);
  if (!before) throw new HttpError(404, 'Student not found');

  let updated: repo.StudentRow | null;
  try {
    updated = await repo.updateStudent(id, {
      ...input,
      contacts: input.contacts ? normalizeContacts(input.contacts) : undefined,
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'A student with this admission number already exists');
    throw err;
  }
  if (!updated) throw new HttpError(404, 'Student not found');

  await recordAudit({
    actorStaffId: actorId,
    action: 'student.update',
    entityType: 'student',
    entityId: id,
    beforeData: before,
    afterData: input,
  });

  return getStudent(id);
}

export async function deleteStudent(actorId: string, id: string): Promise<void> {
  const student = await repo.getStudentById(id);
  if (!student) throw new HttpError(404, 'Student not found');

  await repo.softDeleteStudent(id);
  await recordAudit({
    actorStaffId: actorId,
    action: 'student.delete',
    entityType: 'student',
    entityId: id,
  });
}

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function uploadStudentPhoto(
  actorId: string,
  id: string,
  file: { buffer: Buffer; mimetype: string; size: number },
): Promise<void> {
  const student = await repo.getStudentById(id);
  if (!student) throw new HttpError(404, 'Student not found');

  if (!ALLOWED_PHOTO_TYPES.has(file.mimetype)) {
    throw new HttpError(400, 'Photo must be JPEG, PNG, or WebP');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new HttpError(400, 'Photo must be 5MB or smaller');
  }

  const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const key = `students/${id}/photo.${ext}`;

  if (student.photo_key && student.photo_key !== key) {
    await storage.delete(student.photo_key).catch(() => undefined);
  }

  await storage.save(key, file.buffer, file.mimetype);
  await repo.setStudentPhotoKey(id, key);

  await recordAudit({
    actorStaffId: actorId,
    action: 'student.photo_upload',
    entityType: 'student',
    entityId: id,
  });
}

export async function getStudentPhoto(id: string): Promise<{ buffer: Buffer; key: string } | null> {
  const student = await repo.getStudentById(id);
  if (!student?.photo_key) return null;
  const buffer = await storage.read(student.photo_key);
  return { buffer, key: student.photo_key };
}
