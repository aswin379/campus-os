import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface TransactionDto {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  transactionDate: string;
  paymentMode: string;
  description: string | null;
}

const PAYMENT_MODES = ['cash', 'cheque', 'online', 'card'];

const emptyForm = {
  type: 'expense' as 'income' | 'expense',
  category: '',
  amount: 0,
  transactionDate: new Date().toISOString().slice(0, 10),
  paymentMode: 'cash',
  description: '',
};

function formatCurrency(value: number): string {
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AccountsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('accounts.create');
  const canEdit = hasPermission('accounts.edit');
  const canDelete = hasPermission('accounts.delete');

  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    setTransactions(await api.get<TransactionDto[]>(`/account-transactions${query ? `?${query}` : ''}`));
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load transactions'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, from, to]);

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [transactions]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(form.amount > 0)) {
      setError('Enter an amount greater than zero');
      return;
    }
    setSaving(true);
    try {
      await api.post('/account-transactions', { ...form, description: form.description || undefined });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record transaction');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(t: TransactionDto) {
    setEditingId(t.id);
    setEditForm({
      type: t.type,
      category: t.category,
      amount: t.amount,
      transactionDate: t.transactionDate,
      paymentMode: t.paymentMode,
      description: t.description ?? '',
    });
  }

  async function saveEdit(id: string) {
    setError(null);
    try {
      await api.patch(`/account-transactions/${id}`, { ...editForm, description: editForm.description || null });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update transaction');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    setError(null);
    try {
      await api.delete(`/account-transactions/${id}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete transaction');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Accounts</h1>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Income</div>
          <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(totals.income)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total Expense</div>
          <div className="stat-card-value" style={{ color: 'var(--color-danger)' }}>
            {formatCurrency(totals.expense)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Net</div>
          <div className="stat-card-value" style={{ color: totals.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(totals.net)}
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search category or description" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <label className="mt-0">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label className="mt-0">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {canCreate && (
        <div className="card">
          <h3 className="mt-0">Add Entry</h3>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div>
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label>Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
              </div>
              <div>
                <label>Amount</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} required />
              </div>
              <div>
                <label>Payment mode</label>
                <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Description (optional)</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Add Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Description</th>
              {(canEdit || canDelete) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
                  No entries found.
                </td>
              </tr>
            )}
            {transactions.map((t) =>
              editingId === t.id ? (
                <tr key={t.id}>
                  <td>
                    <input type="date" value={editForm.transactionDate} onChange={(e) => setEditForm({ ...editForm, transactionDate: e.target.value })} style={{ width: 130 }} />
                  </td>
                  <td>
                    <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'income' | 'expense' })}>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </td>
                  <td>
                    <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} style={{ width: 120 }} />
                  </td>
                  <td>
                    <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} style={{ width: 90 }} />
                  </td>
                  <td>
                    <select value={editForm.paymentMode} onChange={(e) => setEditForm({ ...editForm, paymentMode: e.target.value })}>
                      {PAYMENT_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} style={{ width: 150 }} />
                  </td>
                  <td>
                    <button type="button" onClick={() => saveEdit(t.id)}>
                      Save
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingId(null)} style={{ marginLeft: 6 }}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td>{t.transactionDate}</td>
                  <td>
                    <StatusBadge status={t.type} />
                  </td>
                  <td>{t.category}</td>
                  <td className={t.type === 'income' ? '' : ''} style={{ color: t.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </td>
                  <td>{t.paymentMode}</td>
                  <td className="text-muted">{t.description ?? '—'}</td>
                  {(canEdit || canDelete) && (
                    <td>
                      {canEdit && (
                        <button type="button" className="btn-text" onClick={() => startEdit(t)}>
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className="btn-danger-text" onClick={() => handleDelete(t.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
