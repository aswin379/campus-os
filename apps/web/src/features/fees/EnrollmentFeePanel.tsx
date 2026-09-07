import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, BASE_URL } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { StatusBadge } from '../../components/StatusBadge';

interface EnrollmentDto {
  id: string;
  courseBatchId: string;
  enrollmentDate: string;
  status: string;
  courseName: string;
  courseCode: string;
  batchName: string;
}

interface FeeInstallmentDto {
  id: string;
  label: string | null;
  amountDue: number;
  dueDate: string;
  amountPaid: number;
  status: string;
}

interface FeePlanDto {
  id: string;
  totalPayable: number;
  installments: FeeInstallmentDto[];
}

interface FeeTransactionDto {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMode: string;
  paymentDate: string;
  transactionType: string;
  reversedTransactionId: string | null;
  notes: string | null;
}

interface FeeDiscountDto {
  id: string;
  reason: string;
  amount: number;
  approvedByName: string;
  approvedAt: string;
}

const ENROLLMENT_STATUSES = ['active', 'completed', 'dropped', 'transferred'];

function EnrollmentFeeCard({ enrollment, onStatusChanged }: { enrollment: EnrollmentDto; onStatusChanged: () => void }) {
  const { hasPermission } = useAuth();
  const canGeneratePlan = hasPermission('fees.collect');
  const canCollect = hasPermission('fees.collect');
  const canVoid = hasPermission('fees.edit');
  const canReprint = hasPermission('fees.receipt.reprint');
  const canManageDiscounts = hasPermission('fees.structure.manage');
  const canChangeEnrollmentStatus = hasPermission('courses.assign_students');

  const [changingStatus, setChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === enrollment.status) return;
    setStatusError(null);
    setChangingStatus(true);
    try {
      await api.patch(`/enrollments/${enrollment.id}/status`, { status: newStatus });
      onStatusChanged();
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'Failed to update enrollment status');
    } finally {
      setChangingStatus(false);
    }
  }

  const [plan, setPlan] = useState<FeePlanDto | null | undefined>(undefined);
  const [transactions, setTransactions] = useState<FeeTransactionDto[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscountDto[]>([]);
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [addingDiscount, setAddingDiscount] = useState(false);

  async function refresh() {
    const [feeSummary, txns, disc] = await Promise.all([
      api.get<FeePlanDto | null>(`/fee-plans/summary?enrollmentId=${enrollment.id}`),
      api.get<FeeTransactionDto[]>(`/fee-transactions?enrollmentId=${enrollment.id}`),
      api.get<FeeDiscountDto[]>(`/fee-discounts?enrollmentId=${enrollment.id}`),
    ]);
    setPlan(feeSummary);
    setTransactions(txns);
    setDiscounts(disc);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load fee info'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollment.id]);

  async function generatePlan() {
    setError(null);
    try {
      await api.post('/fee-plans', { enrollmentId: enrollment.id });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate fee plan');
    }
  }

  async function handleAddDiscount(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(discountAmount > 0)) {
      setError('Enter a discount amount greater than zero');
      return;
    }
    setAddingDiscount(true);
    try {
      await api.post('/fee-discounts', { enrollmentId: enrollment.id, reason: discountReason, amount: discountAmount });
      setDiscountReason('');
      setDiscountAmount(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add discount');
    } finally {
      setAddingDiscount(false);
    }
  }

  async function handleCollect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // A cleared/invalid number input coerces to 0 via Number(''), which
    // HTML's `required` does not reject — check explicitly rather than
    // letting a 0.00 payment through.
    if (!(amount > 0)) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (collecting) return; // guards against a double-click submitting the same payment twice
    setCollecting(true);
    try {
      await api.post('/fee-transactions', {
        enrollmentId: enrollment.id,
        amount,
        paymentMode,
        paymentDate,
        notes: notes || undefined,
      });
      setAmount(0);
      setNotes('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to collect payment');
    } finally {
      setCollecting(false);
    }
  }

  async function handleVoid(txnId: string) {
    const reason = window.prompt('Reason for voiding this transaction?');
    if (!reason) return;
    setError(null);
    try {
      await api.post(`/fee-transactions/${txnId}/void`, { reason });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to void transaction');
    }
  }

  const totalPaid = plan?.installments.reduce((s, i) => s + i.amountPaid, 0) ?? 0;
  const balance = (plan?.totalPayable ?? 0) - totalPaid;

  return (
    <div className="card">
      <div className="subcard-row" style={{ justifyContent: 'space-between' }}>
        <span>
          <strong>
            {enrollment.courseName} ({enrollment.courseCode})
          </strong>{' '}
          <span className="text-muted">
            — {enrollment.batchName} · enrolled {enrollment.enrollmentDate}
          </span>
        </span>
        {canChangeEnrollmentStatus ? (
          <select
            value={enrollment.status}
            disabled={changingStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{ width: 'auto' }}
          >
            {ENROLLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={enrollment.status} />
        )}
      </div>
      {statusError && <div className="alert alert-error">{statusError}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {plan === undefined && <p>Loading fee info…</p>}

      {plan === null && (
        <div className="subcard">
          <h4 className="mt-0">Discounts</h4>
          {discounts.length === 0 && <p className="text-muted mt-0">No discounts applied yet.</p>}
          {discounts.map((d) => (
            <div key={d.id} className="subcard-row" style={{ justifyContent: 'space-between' }}>
              <span>
                {d.reason} <span className="text-muted">— approved by {d.approvedByName}</span>
              </span>
              <strong style={{ color: 'var(--color-success)' }}>-{d.amount.toFixed(2)}</strong>
            </div>
          ))}
          {canManageDiscounts && (
            <form onSubmit={handleAddDiscount} style={{ marginTop: discounts.length ? 'var(--space-3)' : 0 }}>
              <div className="subcard-row">
                <input placeholder="Reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} required />
                <input
                  type="number"
                  placeholder="Amount"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  required
                />
                <button type="submit" disabled={addingDiscount}>
                  {addingDiscount ? 'Adding…' : '+ Add Discount'}
                </button>
              </div>
              <p className="text-muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                Discounts can only be added before the fee plan is generated — they're applied against the last
                installment(s) once you generate the plan below.
              </p>
            </form>
          )}
        </div>
      )}

      {plan === null && canGeneratePlan && enrollment.status === 'active' && (
        <button type="button" onClick={generatePlan}>
          Generate Fee Plan
        </button>
      )}
      {plan === null && enrollment.status !== 'active' && (
        <p className="text-muted">No fee plan — enrollment is {enrollment.status}, not active.</p>
      )}
      {plan === null && !canGeneratePlan && enrollment.status === 'active' && <p className="text-muted">No fee plan yet.</p>}

      {plan && discounts.length > 0 && (
        <div className="subcard">
          <h4 className="mt-0">Discounts Applied</h4>
          {discounts.map((d) => (
            <div key={d.id} className="subcard-row" style={{ justifyContent: 'space-between' }}>
              <span>
                {d.reason} <span className="text-muted">— approved by {d.approvedByName}</span>
              </span>
              <strong style={{ color: 'var(--color-success)' }}>-{d.amount.toFixed(2)}</strong>
            </div>
          ))}
        </div>
      )}

      {plan && (
        <>
          <table style={{ marginBottom: 8 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Due</th>
                <th>Amount Due</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plan.installments.map((i) => (
                <tr key={i.id}>
                  <td>{i.label}</td>
                  <td>{i.dueDate}</td>
                  <td>{i.amountDue.toFixed(2)}</td>
                  <td>{i.amountPaid.toFixed(2)}</td>
                  <td>
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Total Payable: <strong>{plan.totalPayable.toFixed(2)}</strong> — Paid: {totalPaid.toFixed(2)} — Balance:{' '}
            <strong style={balance > 0 ? { color: 'var(--color-danger)' } : { color: 'var(--color-success)' }}>
              {balance.toFixed(2)}
            </strong>
          </p>

          {canCollect && balance > 0 && (
            <div className="subcard">
              <h4 className="mt-0">Collect Payment</h4>
              <form onSubmit={handleCollect}>
                <div className="subcard-row">
                  <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online</option>
                    <option value="card">Card</option>
                  </select>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                  <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <button type="submit" disabled={collecting}>
                    {collecting ? 'Collecting…' : 'Collect'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <h4>Payment History</h4>
          <table>
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions
                // Voids are rendered as a sub-row directly under the payment
                // they reverse (below), not as their own top-level row in
                // date order — so render only non-void rows at this level.
                .filter((t) => !t.reversedTransactionId)
                .map((t) => {
                  const voids = transactions.filter((x) => x.reversedTransactionId === t.id);
                  return (
                    <Fragment key={t.id}>
                      <tr>
                        <td>{t.receiptNumber}</td>
                        <td>{t.paymentDate}</td>
                        <td>{t.amount.toFixed(2)}</td>
                        <td>{t.paymentMode}</td>
                        <td>
                          <StatusBadge status={t.transactionType} />
                        </td>
                        <td>
                          {canReprint && (
                            <a href={`${BASE_URL}/fee-transactions/${t.id}/receipt`} target="_blank" rel="noreferrer">
                              Receipt
                            </a>
                          )}
                          {canVoid && t.transactionType === 'payment' && voids.length === 0 && (
                            <button type="button" className="btn-danger-text" onClick={() => handleVoid(t.id)} style={{ marginLeft: 8 }}>
                              Void
                            </button>
                          )}
                        </td>
                      </tr>
                      {voids.map((v) => (
                        <tr key={v.id} className="text-muted" style={{ fontSize: 12, background: 'var(--color-bg)' }}>
                          <td style={{ paddingLeft: 'var(--space-5)' }}>↳ {v.receiptNumber}</td>
                          <td>{v.paymentDate}</td>
                          <td>{v.amount.toFixed(2)}</td>
                          <td>{v.paymentMode}</td>
                          <td>
                            <StatusBadge status={v.transactionType} />
                          </td>
                          <td>
                            {canReprint && (
                              <a href={`${BASE_URL}/fee-transactions/${v.id}/receipt`} target="_blank" rel="noreferrer">
                                Receipt
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function EnrollmentFeePanel({ studentId }: { studentId: string }) {
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  function refreshEnrollments() {
    return api
      .get<EnrollmentDto[]>(`/enrollments?studentId=${studentId}`)
      .then(setEnrollments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load enrollments'));
  }

  useEffect(() => {
    refreshEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (enrollments.length === 0) return <p className="text-muted">No course enrollments yet.</p>;

  return (
    <div>
      {enrollments.map((e) => (
        <EnrollmentFeeCard key={e.id} enrollment={e} onStatusChanged={refreshEnrollments} />
      ))}
    </div>
  );
}
