import crypto from 'node:crypto';
import type { PoolClient } from '../../db/pool.js';
import { pool } from '../../db/pool.js';
import { sqlIn } from '../../db/sqlHelpers.js';

export interface StudentRow {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  religion: string | null;
  mobile_number: string | null;
  photo_key: string | null;
  status: string;
  admission_date: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  created_at: string;
}

export interface StudentContactRow {
  id: string;
  student_id: string;
  contact_type: string;
  relation: string | null;
  name: string;
  phone: string;
  email: string | null;
  is_primary: boolean;
}

export interface StudentContactInput {
  contactType: string;
  relation: string | null;
  name: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

/** Atomically allocates the next sequential admission number for the given year. */
export async function nextAdmissionNumber(client: PoolClient, year: number): Promise<string> {
  await client.query(
    `insert into admission_number_sequences (year, last_number)
     values (?, 1)
     on duplicate key update last_number = LAST_INSERT_ID(last_number + 1)`,
    [year],
  );
  const { rows } = await client.query<{ seq: number }>(`select LAST_INSERT_ID() as seq`);
  const seq = rows[0]!.seq;
  return `${year}/${String(seq).padStart(4, '0')}`;
}

async function replaceContacts(client: PoolClient, studentId: string, contacts: StudentContactInput[]): Promise<void> {
  await client.query(`delete from student_contacts where student_id = ?`, [studentId]);
  for (const c of contacts) {
    await client.query(
      `insert into student_contacts (id, student_id, contact_type, relation, name, phone, email, is_primary)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), studentId, c.contactType, c.relation, c.name, c.phone, c.email, c.isPrimary],
    );
  }
}

export interface CreateStudentInput {
  admissionNumber?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  religion: string | null;
  mobileNumber: string | null;
  admissionDate: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contacts: StudentContactInput[];
}

export async function createStudent(input: CreateStudentInput): Promise<StudentRow> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Parse the year directly from the 'YYYY-MM-DD' string rather than via
    // `new Date(...)`, which would parse it as UTC and could shift the year
    // when read back in a timezone behind UTC.
    const year = Number(input.admissionDate.slice(0, 4));
    // A manually-entered number (e.g. to match a pre-existing paper
    // register) skips the sequence entirely — the sequence only needs to
    // stay gap-free for numbers it generates itself.
    const admissionNumber = input.admissionNumber || (await nextAdmissionNumber(client, year));

    const id = crypto.randomUUID();
    await client.query(
      `insert into students
         (id, admission_number, first_name, last_name, date_of_birth, gender, blood_group, religion, mobile_number, admission_date, address, city, state, pincode)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        admissionNumber,
        input.firstName,
        input.lastName,
        input.dateOfBirth,
        input.gender,
        input.bloodGroup,
        input.religion,
        input.mobileNumber,
        input.admissionDate,
        input.address,
        input.city,
        input.state,
        input.pincode,
      ],
    );
    const { rows } = await client.query<StudentRow>(`select * from students where id = ?`, [id]);
    const student = rows[0]!;
    await replaceContacts(client, student.id, input.contacts);

    await client.query('commit');
    return student;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export interface UpdateStudentInput {
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
}

/**
 * coalesce(?, column) can't tell "field omitted, leave unchanged" apart
 * from "field explicitly cleared to null" — both arrive as a null bind
 * parameter otherwise. Only include a SET clause for keys actually present
 * on `input` (checked via `in`, so an explicit `null` still counts as
 * present), so omitted fields are left alone and explicit nulls take effect.
 */
export async function updateStudent(id: string, input: UpdateStudentInput): Promise<StudentRow | null> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const setClauses: string[] = ['updated_at = now()'];
    const setParams: unknown[] = [];
    function setField(column: string, value: unknown): void {
      setParams.push(value);
      setClauses.push(`${column} = ?`);
    }
    if ('admissionNumber' in input) setField('admission_number', input.admissionNumber);
    if ('firstName' in input) setField('first_name', input.firstName);
    if ('lastName' in input) setField('last_name', input.lastName);
    if ('dateOfBirth' in input) setField('date_of_birth', input.dateOfBirth);
    if ('gender' in input) setField('gender', input.gender);
    if ('bloodGroup' in input) setField('blood_group', input.bloodGroup);
    if ('religion' in input) setField('religion', input.religion);
    if ('mobileNumber' in input) setField('mobile_number', input.mobileNumber);
    if ('address' in input) setField('address', input.address);
    if ('city' in input) setField('city', input.city);
    if ('state' in input) setField('state', input.state);
    if ('pincode' in input) setField('pincode', input.pincode);
    if ('status' in input) setField('status', input.status);

    const result = await client.query(
      `update students set ${setClauses.join(', ')}
       where id = ? and deleted_at is null`,
      [...setParams, id],
    );
    if (result.rowCount === 0) {
      await client.query('rollback');
      return null;
    }

    const { rows } = await client.query<StudentRow>(`select * from students where id = ? and deleted_at is null`, [id]);
    const student = rows[0];
    if (!student) {
      await client.query('rollback');
      return null;
    }

    if (input.contacts) {
      await replaceContacts(client, id, input.contacts);
    }

    await client.query('commit');
    return student;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function getStudentById(id: string): Promise<StudentRow | null> {
  const { rows } = await pool.query<StudentRow>(`select * from students where id = ? and deleted_at is null`, [id]);
  return rows[0] ?? null;
}

export async function getContactsForStudent(studentId: string): Promise<StudentContactRow[]> {
  const { rows } = await pool.query<StudentContactRow>(
    `select * from student_contacts where student_id = ? order by is_primary desc, contact_type`,
    [studentId],
  );
  return rows;
}

export interface ListStudentsFilters {
  search?: string;
  status?: string;
}

export async function listStudents(filters: ListStudentsFilters): Promise<StudentRow[]> {
  const conditions: string[] = ['deleted_at is null'];
  const params: unknown[] = [];

  if (filters.search) {
    const like = `%${filters.search}%`;
    params.push(like, like, like);
    conditions.push(`(first_name like ? or last_name like ? or admission_number like ?)`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = ?`);
  }

  const { rows } = await pool.query<StudentRow>(
    `select * from students where ${conditions.join(' and ')} order by created_at desc limit 200`,
    params,
  );
  return rows;
}

/** Batched alternative to calling getContactsForStudent once per row (avoids an N+1 when listing students). */
export async function getContactsForStudents(studentIds: string[]): Promise<Map<string, StudentContactRow[]>> {
  const byStudent = new Map<string, StudentContactRow[]>();
  if (studentIds.length === 0) return byStudent;

  const { clause, params } = sqlIn(studentIds);
  const { rows } = await pool.query<StudentContactRow>(
    `select * from student_contacts where student_id in ${clause} order by is_primary desc, contact_type`,
    params,
  );
  for (const row of rows) {
    const existing = byStudent.get(row.student_id);
    if (existing) existing.push(row);
    else byStudent.set(row.student_id, [row]);
  }
  return byStudent;
}

export async function setStudentPhotoKey(id: string, photoKey: string | null): Promise<void> {
  await pool.query(`update students set photo_key = ?, updated_at = now() where id = ?`, [photoKey, id]);
}

export async function softDeleteStudent(id: string): Promise<void> {
  await pool.query(`update students set deleted_at = now() where id = ?`, [id]);
}
