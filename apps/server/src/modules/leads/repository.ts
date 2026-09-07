import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';

export interface LeadRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  interested_course_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeadFollowupRow {
  id: string;
  lead_id: string;
  followup_date: string;
  notes: string;
  next_followup_date: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateLeadInput {
  fullName: string;
  phone: string;
  email: string | null;
  source: string;
  interestedCourseId: string | null;
  assignedTo: string | null;
  notes: string | null;
  createdBy: string;
}

export async function createLead(input: CreateLeadInput): Promise<LeadRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into leads
       (id, full_name, phone, email, source, interested_course_id, assigned_to, notes, created_by)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.fullName,
      input.phone,
      input.email,
      input.source,
      input.interestedCourseId,
      input.assignedTo,
      input.notes,
      input.createdBy,
    ],
  );
  const { rows } = await pool.query<LeadRow>(`select * from leads where id = ?`, [id]);
  return rows[0]!;
}

export interface LeadWithNamesRow extends LeadRow {
  assigned_to_name: string | null;
  interested_course_name: string | null;
  next_followup_date: string | null;
}

// The lateral join picks each lead's MOST RECENTLY LOGGED followup (not just
// any followup with a matching date) — that followup's next_followup_date
// is the one currently-active reminder for the lead; any earlier followup's
// next_followup_date is superseded once a newer one has been logged.
// (MySQL 8.0.14+ supports lateral derived tables; requires an explicit alias.)
const LEAD_JOIN_SELECT = `
  select l.*, st.full_name as assigned_to_name, c.name as interested_course_name, latest_followup.next_followup_date
  from leads l
  left join staff st on st.id = l.assigned_to
  left join courses c on c.id = l.interested_course_id
  left join lateral (
    select f.next_followup_date
    from lead_followups f
    where f.lead_id = l.id
    order by f.followup_date desc, f.created_at desc
    limit 1
  ) as latest_followup on true
`;

export interface ListLeadsFilters {
  search?: string;
  status?: string;
  source?: string;
  followupDueToday?: boolean;
}

export async function listLeads(filters: ListLeadsFilters): Promise<LeadWithNamesRow[]> {
  const conditions: string[] = ['l.deleted_at is null'];
  const params: unknown[] = [];

  if (filters.search) {
    const like = `%${filters.search}%`;
    params.push(like, like, like);
    conditions.push(`(l.full_name like ? or l.phone like ? or l.email like ?)`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`l.status = ?`);
  }
  if (filters.source) {
    params.push(filters.source);
    conditions.push(`l.source = ?`);
  }
  if (filters.followupDueToday) {
    conditions.push(`latest_followup.next_followup_date = current_date`);
  }

  const { rows } = await pool.query<LeadWithNamesRow>(
    `${LEAD_JOIN_SELECT} where ${conditions.join(' and ')} order by l.created_at desc limit 200`,
    params,
  );
  return rows;
}

export async function getLeadById(id: string): Promise<LeadWithNamesRow | null> {
  const { rows } = await pool.query<LeadWithNamesRow>(
    `${LEAD_JOIN_SELECT} where l.id = ? and l.deleted_at is null`,
    [id],
  );
  return rows[0] ?? null;
}

export interface UpdateLeadInput {
  fullName?: string;
  phone?: string;
  email?: string | null;
  source?: string;
  status?: string;
  interestedCourseId?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
}

/**
 * coalesce(?, column) can't tell "field omitted, leave unchanged" apart
 * from "field explicitly cleared to null" — both arrive as a null bind
 * parameter otherwise. Only include a SET clause for keys actually present
 * on `input` (checked via `in`, so an explicit `null` still counts as
 * present), so omitted fields are left alone and explicit nulls take effect.
 */
export async function updateLead(id: string, input: UpdateLeadInput): Promise<LeadRow | null> {
  const setClauses: string[] = ['updated_at = now()'];
  const setParams: unknown[] = [];
  function setField(column: string, value: unknown): void {
    setParams.push(value);
    setClauses.push(`${column} = ?`);
  }
  if ('fullName' in input) setField('full_name', input.fullName);
  if ('phone' in input) setField('phone', input.phone);
  if ('email' in input) setField('email', input.email);
  if ('source' in input) setField('source', input.source);
  if ('status' in input) setField('status', input.status);
  if ('interestedCourseId' in input) setField('interested_course_id', input.interestedCourseId);
  if ('assignedTo' in input) setField('assigned_to', input.assignedTo);
  if ('notes' in input) setField('notes', input.notes);

  const result = await pool.query(
    `update leads set ${setClauses.join(', ')} where id = ? and deleted_at is null`,
    [...setParams, id],
  );
  if (result.rowCount === 0) return null;
  const { rows } = await pool.query<LeadRow>(`select * from leads where id = ? and deleted_at is null`, [id]);
  return rows[0] ?? null;
}

export async function softDeleteLead(id: string): Promise<void> {
  await pool.query(`update leads set deleted_at = now() where id = ?`, [id]);
}

export interface CreateFollowupInput {
  leadId: string;
  followupDate: string;
  notes: string;
  nextFollowupDate: string | null;
  createdBy: string;
}

export async function createFollowup(input: CreateFollowupInput): Promise<LeadFollowupRow> {
  const id = crypto.randomUUID();
  await pool.query(
    `insert into lead_followups (id, lead_id, followup_date, notes, next_followup_date, created_by)
     values (?, ?, ?, ?, ?, ?)`,
    [id, input.leadId, input.followupDate, input.notes, input.nextFollowupDate, input.createdBy],
  );
  const { rows } = await pool.query<LeadFollowupRow>(`select * from lead_followups where id = ?`, [id]);
  return rows[0]!;
}

export interface LeadFollowupWithNameRow extends LeadFollowupRow {
  created_by_name: string;
}

export async function listFollowupsForLead(leadId: string): Promise<LeadFollowupWithNameRow[]> {
  const { rows } = await pool.query<LeadFollowupWithNameRow>(
    `select f.*, st.full_name as created_by_name
     from lead_followups f
     join staff st on st.id = f.created_by
     where f.lead_id = ?
     order by f.followup_date desc, f.created_at desc`,
    [leadId],
  );
  return rows;
}
