import { HttpError } from '../../middleware/errorHandler.js';
import { recordAudit } from '../../lib/audit/log.js';
import { storage } from '../../lib/storage/index.js';
import * as repo from './repository.js';

/** The fixed, known set of settings this app reads — new settings are added here, not via a migration (see settings table's key-value design). */
const KEYS = [
  'institute.name',
  'institute.address',
  'institute.phone',
  'institute.email',
  'institute.logoKey',
  'receipt.prefix',
  'receipt.termsText',
] as const;

type SettingKey = (typeof KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  'institute.name': 'Diploma Institute',
  'institute.address': '',
  'institute.phone': '',
  'institute.email': '',
  'institute.logoKey': '',
  'receipt.prefix': 'RCPT',
  'receipt.termsText': '',
};

export interface InstituteSettingsDto {
  instituteName: string;
  instituteAddress: string;
  institutePhone: string;
  instituteEmail: string;
  hasLogo: boolean;
  receiptPrefix: string;
  receiptTermsText: string;
}

function toDto(rows: repo.SettingRow[]): InstituteSettingsDto {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const get = (key: SettingKey) => {
    const v = byKey.get(key);
    return typeof v === 'string' ? v : DEFAULTS[key];
  };
  return {
    instituteName: get('institute.name'),
    instituteAddress: get('institute.address'),
    institutePhone: get('institute.phone'),
    instituteEmail: get('institute.email'),
    hasLogo: get('institute.logoKey') !== '',
    receiptPrefix: get('receipt.prefix'),
    receiptTermsText: get('receipt.termsText'),
  };
}

export async function getInstituteSettings(): Promise<InstituteSettingsDto> {
  const rows = await repo.listByKeys([...KEYS]);
  return toDto(rows);
}

export async function updateInstituteSettings(
  actorId: string,
  input: Partial<{
    instituteName: string;
    instituteAddress: string;
    institutePhone: string;
    instituteEmail: string;
    receiptPrefix: string;
    receiptTermsText: string;
  }>,
): Promise<InstituteSettingsDto> {
  const fieldToKey: Record<string, SettingKey> = {
    instituteName: 'institute.name',
    instituteAddress: 'institute.address',
    institutePhone: 'institute.phone',
    instituteEmail: 'institute.email',
    receiptPrefix: 'receipt.prefix',
    receiptTermsText: 'receipt.termsText',
  };

  const entries = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([field, value]) => ({ key: fieldToKey[field]!, value: value as string }));

  if (entries.length > 0) {
    await repo.setMany(entries, actorId);
    await recordAudit({
      actorStaffId: actorId,
      action: 'settings.update',
      entityType: 'settings',
      entityId: 'institute',
      afterData: input,
    });
  }

  return getInstituteSettings();
}

const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

async function getLogoKey(): Promise<string | null> {
  const rows = await repo.listByKeys(['institute.logoKey']);
  const value = rows[0]?.value;
  return typeof value === 'string' && value !== '' ? value : null;
}

export async function uploadInstituteLogo(
  actorId: string,
  file: { buffer: Buffer; mimetype: string; size: number },
): Promise<void> {
  if (!ALLOWED_LOGO_TYPES.has(file.mimetype)) {
    throw new HttpError(400, 'Logo must be JPEG, PNG, or WebP');
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new HttpError(400, 'Logo must be 2MB or smaller');
  }

  const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const key = `branding/institute-logo.${ext}`;

  const previousKey = await getLogoKey();
  if (previousKey && previousKey !== key) {
    await storage.delete(previousKey).catch(() => undefined);
  }

  await storage.save(key, file.buffer, file.mimetype);
  await repo.setMany([{ key: 'institute.logoKey', value: key }], actorId);

  await recordAudit({
    actorStaffId: actorId,
    action: 'settings.logo_upload',
    entityType: 'settings',
    entityId: 'institute',
  });
}

export async function getInstituteLogo(): Promise<{ buffer: Buffer; key: string } | null> {
  const key = await getLogoKey();
  if (!key) return null;
  try {
    const buffer = await storage.read(key);
    return { buffer, key };
  } catch {
    return null;
  }
}
