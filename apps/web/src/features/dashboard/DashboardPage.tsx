import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

interface DashboardSummary {
  instituteName: string;
  totalStudents: number;
  totalCourses: number;
  totalStaff: number;
  todaysAdmissions: number;
  todaysFeeCollections: number;
  pendingFees: number;
  attendanceSummary: { presentToday: number; absentToday: number } | null;
}

function formatCurrency(value: number): string {
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  to?: string;
}

function StatCardTile({ card }: { card: StatCard }) {
  const inner = (
    <>
      <div className={`stat-card-icon-badge stat-card-icon-${card.tone}`}>{card.icon}</div>
      <div>
        <div className="stat-card-label">{card.label}</div>
        <div className={`stat-card-value stat-card-value-${card.tone}`}>{card.value}</div>
      </div>
    </>
  );

  // Only wrap in a Link when the destination is one the user can actually
  // reach — otherwise clicking would just bounce off RequireAuth.
  if (card.to) {
    return (
      <Link to={card.to} className="stat-card stat-card-icon stat-card-clickable">
        {inner}
      </Link>
    );
  }
  return <div className="stat-card stat-card-icon">{inner}</div>;
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    api.get<DashboardSummary>('/dashboard/summary').then(setSummary);
  }, []);

  if (!summary) return <div className="text-muted">Loading…</div>;

  const studentsLink = hasPermission('students.view') ? '/students' : undefined;
  const coursesLink = hasPermission('courses.view') ? '/courses' : undefined;
  const staffLink = hasPermission('staff.view') ? '/staff' : undefined;
  const reportsLink = hasPermission('reports.view') ? '/reports' : undefined;
  const attendanceLink = hasPermission('attendance.view') ? '/attendance' : undefined;

  const academics: StatCard[] = [
    { label: 'Total Students', value: summary.totalStudents, icon: '🎓', tone: 'primary', to: studentsLink },
    { label: 'Total Courses', value: summary.totalCourses, icon: '📚', tone: 'info', to: coursesLink },
    { label: 'Total Staff', value: summary.totalStaff, icon: '🧑‍🏫', tone: 'primary', to: staffLink },
    { label: "Today's Admissions", value: summary.todaysAdmissions, icon: '✨', tone: 'info', to: studentsLink },
  ];

  const finance: StatCard[] = [
    {
      label: "Today's Fee Collections",
      value: formatCurrency(summary.todaysFeeCollections),
      icon: '💰',
      tone: 'success',
      to: reportsLink,
    },
    {
      label: 'Pending Fees',
      value: formatCurrency(summary.pendingFees),
      icon: '⏳',
      tone: summary.pendingFees > 0 ? 'warning' : 'success',
      to: reportsLink,
    },
  ];

  const attendance: StatCard[] = [
    { label: 'Present Today', value: summary.attendanceSummary?.presentToday ?? 0, icon: '✅', tone: 'success', to: attendanceLink },
    { label: 'Absent Today', value: summary.attendanceSummary?.absentToday ?? 0, icon: '⚠️', tone: 'danger', to: attendanceLink },
  ];

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="dashboard-hero">
        <div className="dashboard-hero-eyebrow">{greeting()}</div>
        <h1 className="dashboard-hero-institute">{summary.instituteName}</h1>
        <div className="dashboard-hero-meta">{today}</div>
      </div>

      <h2 className="section-heading">Academics</h2>
      <div className="stat-grid">
        {academics.map((card) => (
          <StatCardTile key={card.label} card={card} />
        ))}
      </div>

      <h2 className="section-heading">Finance</h2>
      <div className="stat-grid">
        {finance.map((card) => (
          <StatCardTile key={card.label} card={card} />
        ))}
      </div>

      <h2 className="section-heading">Attendance Today</h2>
      <div className="stat-grid">
        {attendance.map((card) => (
          <StatCardTile key={card.label} card={card} />
        ))}
      </div>
    </div>
  );
}
