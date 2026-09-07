import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import { EnrollmentFeePanel } from './EnrollmentFeePanel';

interface StudentSearchResult {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
}

export function FeeCollectionPage() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [selected, setSelected] = useState<StudentSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSelected(null);
    if (!search.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const list = await api.get<StudentSearchResult[]>(`/students?search=${encodeURIComponent(search.trim())}`);
      setResults(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Fee Collection</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSearch} className="subcard-row">
          <input
            placeholder="Search by name or admission number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
            autoFocus
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results.length > 0 && !selected && (
          <table style={{ marginTop: 'var(--space-3)' }}>
            <thead>
              <tr>
                <th>Admission #</th>
                <th>Name</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((s) => (
                <tr key={s.id}>
                  <td>{s.admissionNumber}</td>
                  <td>
                    {s.firstName} {s.lastName}
                  </td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => setSelected(s)}>
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <>
          <h2 className="section-heading">
            {selected.firstName} {selected.lastName} <span className="text-muted">({selected.admissionNumber})</span>
          </h2>
          <EnrollmentFeePanel studentId={selected.id} />
        </>
      )}
    </div>
  );
}
