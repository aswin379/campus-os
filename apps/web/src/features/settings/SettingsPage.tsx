import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';

interface InstituteSettingsDto {
  instituteName: string;
  instituteAddress: string;
  institutePhone: string;
  instituteEmail: string;
  receiptPrefix: string;
  receiptTermsText: string;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<InstituteSettingsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<InstituteSettingsDto>('/settings')
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load settings'));
  }, []);

  function update(field: keyof InstituteSettingsDto, value: string) {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSaved(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaving(true);
    try {
      setSettings(await api.put<InstituteSettingsDto>('/settings', settings));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="text-muted">{error ?? 'Loading…'}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">Saved.</div>}

      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div className="card">
          <h2 className="mt-0">Institute Information</h2>
          <div>
            <label htmlFor="instituteName">Name</label>
            <input
              id="instituteName"
              value={settings.instituteName}
              onChange={(e) => update('instituteName', e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label htmlFor="instituteAddress">Address</label>
            <textarea
              id="instituteAddress"
              value={settings.instituteAddress}
              onChange={(e) => update('instituteAddress', e.target.value)}
              rows={2}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label htmlFor="institutePhone">Phone</label>
            <input
              id="institutePhone"
              value={settings.institutePhone}
              onChange={(e) => update('institutePhone', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label htmlFor="instituteEmail">Email</label>
            <input
              id="instituteEmail"
              type="email"
              value={settings.instituteEmail}
              onChange={(e) => update('instituteEmail', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="card">
          <h2 className="mt-0">Receipt Settings</h2>
          <div>
            <label htmlFor="receiptPrefix">Receipt number prefix</label>
            <input
              id="receiptPrefix"
              value={settings.receiptPrefix}
              onChange={(e) => update('receiptPrefix', e.target.value)}
              required
            />
            <p className="text-muted" style={{ fontSize: 13 }}>
              Receipts are numbered {settings.receiptPrefix}/&lt;financial year&gt;/&lt;sequence&gt;, e.g.{' '}
              {settings.receiptPrefix}/2026-27/0001. Changing this only affects receipts issued from now on.
            </p>
          </div>
          <div>
            <label htmlFor="receiptTermsText">Receipt footer text (optional)</label>
            <textarea
              id="receiptTermsText"
              value={settings.receiptTermsText}
              onChange={(e) => update('receiptTermsText', e.target.value)}
              rows={2}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
