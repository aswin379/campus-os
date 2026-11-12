import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, BASE_URL } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { EnrollmentFeePanel } from './EnrollmentFeePanel';

interface StudentSearchResult {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
}

interface RecentTransactionDto {
  id: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  transactionType: string;
  studentName: string;
  admissionNumber: string;
  courseName: string;
}

export function FeeCollectionPage() {
  const { hasPermission } = useAuth();
  const canReprint = hasPermission('fees.receipt.reprint');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [selected, setSelected] = useState<StudentSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<RecentTransactionDto[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);

  async function refreshRecent() {
    try {
      setRecent(await api.get<RecentTransactionDto[]>('/fee-transactions/recent'));
    } catch (err) {
      setRecentError(err instanceof ApiError ? err.message : 'Failed to load recent transactions');
    }
  }

  useEffect(() => {
    refreshRecent();
  }, []);

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

      {!selected && (
        <>
          <h2 className="section-heading">Recent Transactions</h2>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            {recentError && (
              <div className="alert alert-error" style={{ margin: 'var(--space-3)' }}>
                {recentError}
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  {canReprint && <th></th>}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && !recentError && (
                  <tr>
                    <td colSpan={canReprint ? 7 : 6} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td>{t.receiptNumber}</td>
                    <td>{t.paymentDate}</td>
                    <td>
                      {t.studentName} <span className="text-muted">({t.admissionNumber})</span>
                    </td>
                    <td>{t.courseName}</td>
                    <td>
                      {t.transactionType === 'void' ? '- ' : ''}Rs. {t.amount.toFixed(2)}
                    </td>
                    <td>{t.paymentMode}</td>
                    {canReprint && (
                      <td>
                        <a href={`${BASE_URL}/fee-transactions/${t.id}/receipt`} target="_blank" rel="noreferrer">
                          Receipt
                        </a>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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
