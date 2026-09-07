import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, BASE_URL } from '../../api/client';

interface BulkUploadResult {
  created: number;
  skipped: { row: number; reason: string }[];
}

export function LeadBulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload<BulkUploadResult>('/leads/bulk-upload', formData);
      setResult(res);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Bulk Upload Leads</h1>
        <Link to="/leads">
          <button type="button" className="btn-secondary">
            Back to Leads
          </button>
        </Link>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 className="mt-0">Spreadsheet format</h3>
        <p className="mt-0">
          Upload an <strong>.xlsx</strong> file with a header row. Recognized columns (any order, any extra columns
          are ignored):
        </p>
        <table style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Column</th>
              <th>Required</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Full Name</td>
              <td>Yes</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Phone</td>
              <td>Yes</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Email</td>
              <td>No</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Source</td>
              <td>No</td>
              <td>
                walk_in / phone / website / referral / social_media / advertisement — anything else defaults to
                "other"
              </td>
            </tr>
            <tr>
              <td>Notes</td>
              <td>No</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
        <div className="form-actions" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
          <a href={`${BASE_URL}/leads/bulk-upload/sample`} target="_blank" rel="noreferrer">
            <button type="button" className="btn-secondary">
              Download Sample File
            </button>
          </a>
        </div>
      </div>

      <div className="card">
        <h3 className="mt-0">Upload</h3>
        <div className="subcard-row">
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3 className="mt-0">Result</h3>
          <div className="alert alert-success">{result.created} lead(s) created.</div>
          {result.skipped.length > 0 && (
            <>
              <p>
                <strong>{result.skipped.length}</strong> row(s) skipped:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skipped.map((s, i) => (
                    <tr key={i}>
                      <td>{s.row}</td>
                      <td className="text-muted">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <div className="form-actions">
            <Link to="/leads">
              <button type="button">View Leads</button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
