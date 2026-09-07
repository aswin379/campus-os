import { recordAudit } from '../../lib/audit/log.js';
import * as repo from './repository.js';

/** The fixed, known set of settings this app reads — new settings are added here, not via a migration (see settings table's key-value design). */
const KEYS = [
  'institute.name',
  'institute.address',
  'institute.phone',
  'institute.email',
  'receipt.prefix',
  'receipt.termsText',
] as const;

type SettingKey = (typeof KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  'institute.name': 'Diploma Institute',
  'institute.address': '',
  'institute.phone': '',
  'institute.email': '',
  'receipt.prefix': 'RCPT',
  'receipt.termsText': '',
};

export interface InstituteSettingsDto {
  instituteName: string;
  instituteAddress: string;
  institutePhone: string;
  instituteEmail: string;
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
