import { useState } from 'react';
import { BASE_URL } from '../../api/client';

function ExportLinks({ path }: { path: string }) {
  return (
    <span style={{ marginLeft: 12 }}>
      <a href={`${BASE_URL}${path}${path.includes('?') ? '&' : '?'}format=pdf`} target="_blank" rel="noreferrer">
        PDF
      </a>
      {' · '}
      <a href={`${BASE_URL}${path}${path.includes('?') ? '&' : '?'}format=xlsx`} target="_blank" rel="noreferrer">
        Excel
      </a>
    </span>
  );
}

export function ReportsPage() {
  const [studentStatus, setStudentStatus] = useState('');
  const [feeFrom, setFeeFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [feeTo, setFeeTo] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="mt-0" style={{ marginBottom: 0 }}>
          Student Report
        </h3>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <select value={studentStatus} onChange={(e) => setStudentStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="enquiry">Enquiry</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
            <option value="suspended">Suspended</option>
          </select>
          <ExportLinks path={`/reports/students${studentStatus ? `?status=${studentStatus}` : ''}`} />
        </div>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="mt-0" style={{ marginBottom: 0 }}>
          Course Report
        </h3>
        <ExportLinks path="/reports/courses" />
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="mt-0" style={{ marginBottom: 0 }}>
          Fee Collection Report
        </h3>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label className="mt-0">From</label>
          <input type="date" value={feeFrom} onChange={(e) => setFeeFrom(e.target.value)} />
          <label className="mt-0" style={{ marginLeft: 8 }}>
            To
          </label>
          <input type="date" value={feeTo} onChange={(e) => setFeeTo(e.target.value)} />
          <ExportLinks path={`/reports/fee-collection?from=${feeFrom}&to=${feeTo}`} />
        </div>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="mt-0" style={{ marginBottom: 0 }}>
          Pending Fees Report
        </h3>
        <ExportLinks path="/reports/pending-fees" />
      </div>
    </div>
  );
}
