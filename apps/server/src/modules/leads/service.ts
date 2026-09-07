import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import { buildExcelBuffer } from '../../lib/export/excel.js';
import { SOURCES } from './validators.js';
import * as repo from './repository.js';

export interface LeadDto {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  interestedCourseId: string | null;
  interestedCourseName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  notes: string | null;
  nextFollowupDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FollowupDto {
  id: string;
  followupDate: string;
  notes: string;
  nextFollowupDate: string | null;
  createdByName: string;
  createdAt: string;
}

function toLeadDto(row: repo.LeadWithNamesRow): LeadDto {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    status: row.status,
    interestedCourseId: row.interested_course_id,
    interestedCourseName: row.interested_course_name,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    notes: row.notes,
    nextFollowupDate: row.next_followup_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFollowupDto(row: repo.LeadFollowupWithNameRow): FollowupDto {
  return {
    id: row.id,
    followupDate: row.followup_date,
    notes: row.notes,
    nextFollowupDate: row.next_followup_date,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

export async function listLeads(filters: {
  search?: string;
  status?: string;
  source?: string;
  followupDueToday?: boolean;
}): Promise<LeadDto[]> {
  return (await repo.listLeads(filters)).map(toLeadDto);
}

export async function getLead(id: string): Promise<LeadDto> {
  const row = await repo.getLeadById(id);
  if (!row) throw new HttpError(404, 'Lead not found');
  return toLeadDto(row);
}

export async function createLead(
  actorId: string,
  input: {
    fullName: string;
    phone: string;
    email?: string;
    source: string;
    interestedCourseId?: string;
    assignedTo?: string;
    notes?: string;
  },
): Promise<LeadDto> {
  const created = await repo.createLead({
    fullName: input.fullName,
    phone: input.phone,
    email: input.email ?? null,
    source: input.source,
    interestedCourseId: input.interestedCourseId ?? null,
    assignedTo: input.assignedTo ?? null,
    notes: input.notes ?? null,
    createdBy: actorId,
  });

  await recordAudit({
    actorStaffId: actorId,
    action: 'lead.create',
    entityType: 'lead',
    entityId: created.id,
    afterData: { fullName: input.fullName, phone: input.phone, source: input.source },
  });

  return getLead(created.id);
}

export interface BulkLeadRow {
  fullName?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
}

export interface BulkUploadResult {
  created: number;
  skipped: { row: number; reason: string }[];
}

/**
 * Headers here must exactly match parseLeadSheet.ts's COLUMN_ALIASES keys
 * (case-insensitively) so a downloaded-then-refilled-in copy of this file
 * parses back correctly without the user needing to know the alias list.
 */
export async function buildSampleLeadSheet(): Promise<Buffer> {
  return buildExcelBuffer('Leads', [
    { key: 'fullName', header: 'Full Name', width: 24 },
    { key: 'phone', header: 'Phone', width: 16 },
    { key: 'email', header: 'Email', width: 26 },
    { key: 'source', header: 'Source', width: 16 },
    { key: 'notes', header: 'Notes', width: 30 },
  ], [
    {
      fullName: 'Jane Doe',
      phone: '9876543210',
      email: 'jane.doe@example.com',
      source: SOURCES.filter((s) => s !== 'other')[0] ?? 'walk_in',
      notes: 'Interested in evening batch',
    },
  ]);
}

function normalizeSource(raw: string | undefined): string {
  const normalized = (raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (SOURCES as readonly string[]).includes(normalized) ? normalized : 'other';
}

/**
 * Row-by-row rather than a single bulk INSERT so one bad row (or, e.g., a
 * unique-constraint issue) never aborts the whole file — the vast majority
 * of the sheet still imports, and the caller sees exactly which rows didn't.
 */
export async function bulkCreateLeads(actorId: string, rows: BulkLeadRow[]): Promise<BulkUploadResult> {
  const skipped: { row: number; reason: string }[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row above the data
    const fullName = row.fullName?.trim();
    const phone = row.phone?.trim();

    if (!fullName && !phone && !row.email && !row.source && !row.notes) {
      continue; // a genuinely blank row (e.g. trailing rows in the sheet) — not a data row worth reporting
    }
    if (!fullName) {
      skipped.push({ row: rowNumber, reason: 'Missing full name' });
      continue;
    }
    if (!phone) {
      skipped.push({ row: rowNumber, reason: 'Missing phone' });
      continue;
    }

    const email = row.email?.trim();
    try {
      const createdLead = await repo.createLead({
        fullName,
        phone,
        email: email && email.includes('@') ? email : null,
        source: normalizeSource(row.source),
        interestedCourseId: null,
        assignedTo: null,
        notes: row.notes?.trim() || null,
        createdBy: actorId,
      });
      created++;
      await recordAudit({
        actorStaffId: actorId,
        action: 'lead.create',
        entityType: 'lead',
        entityId: createdLead.id,
        afterData: { fullName, phone, source: normalizeSource(row.source), bulkUpload: true },
      });
    } catch (err) {
      skipped.push({ row: rowNumber, reason: err instanceof Error ? err.message : 'Failed to save row' });
    }
  }

  return { created, skipped };
}

export async function updateLead(
  actorId: string,
  id: string,
  input: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    source?: string;
    status?: string;
    interestedCourseId?: string | null;
    assignedTo?: string | null;
    notes?: string | null;
  },
): Promise<LeadDto> {
  const before = await repo.getLeadById(id);
  if (!before) throw new HttpError(404, 'Lead not found');

  const updated = await repo.updateLead(id, input);
  if (!updated) throw new HttpError(404, 'Lead not found');

  await recordAudit({
    actorStaffId: actorId,
    action: 'lead.update',
    entityType: 'lead',
    entityId: id,
    beforeData: before,
    afterData: input,
  });

  return getLead(id);
}

export async function deleteLead(actorId: string, id: string): Promise<void> {
  const lead = await repo.getLeadById(id);
  if (!lead) throw new HttpError(404, 'Lead not found');

  await repo.softDeleteLead(id);
  await recordAudit({
    actorStaffId: actorId,
    action: 'lead.delete',
    entityType: 'lead',
    entityId: id,
  });
}

export async function listFollowups(leadId: string): Promise<FollowupDto[]> {
  return (await repo.listFollowupsForLead(leadId)).map(toFollowupDto);
}

export async function addFollowup(
  actorId: string,
  leadId: string,
  input: { followupDate: string; notes: string; nextFollowupDate?: string },
): Promise<FollowupDto> {
  const lead = await repo.getLeadById(leadId);
  if (!lead) throw new HttpError(404, 'Lead not found');

  const created = await repo.createFollowup({
    leadId,
    followupDate: input.followupDate,
    notes: input.notes,
    nextFollowupDate: input.nextFollowupDate ?? null,
    createdBy: actorId,
  });

  await recordAudit({
    actorStaffId: actorId,
    action: 'lead.followup_add',
    entityType: 'lead',
    entityId: leadId,
    afterData: { followupDate: input.followupDate, notes: input.notes },
  });

  const [followup] = (await repo.listFollowupsForLead(leadId)).filter((f) => f.id === created.id);
  return toFollowupDto(followup!);
}
