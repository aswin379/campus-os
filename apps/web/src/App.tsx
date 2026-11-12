import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { RolesPage } from './features/staff/RolesPage';
import { StaffListPage } from './features/staff/StaffListPage';
import { StaffAttendancePage } from './features/staff/StaffAttendancePage';
import { StudentFormPage } from './features/students/StudentFormPage';
import { StudentListPage } from './features/students/StudentListPage';
import { CourseDetailPage } from './features/courses/CourseDetailPage';
import { CourseListPage } from './features/courses/CourseListPage';
import { AttendancePage } from './features/attendance/AttendancePage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AuditLogPage } from './features/reports/AuditLogPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { LicenseBanner } from './components/LicenseBanner';
import { AppFooter } from './components/AppFooter';
import { LeadListPage } from './features/leads/LeadListPage';
import { LeadFormPage } from './features/leads/LeadFormPage';
import { LeadBulkUploadPage } from './features/leads/LeadBulkUploadPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { FeeCollectionPage } from './features/fees/FeeCollectionPage';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  show: boolean;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Auto-hide the mobile drawer on every navigation — without this it stays
  // open over the newly-loaded page after tapping a nav link, since it's
  // just a CSS transform, not something route changes affect on their own.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent the page behind the open drawer from scrolling with it.
  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: '▦', end: true, show: true },
    { to: '/students', label: 'Students', icon: '\u{1F393}', show: hasPermission('students.view') },
    { to: '/leads', label: 'Leads', icon: '\u{1F4E3}', show: hasPermission('leads.view') },
    { to: '/courses', label: 'Courses', icon: '\u{1F4DA}', show: hasPermission('courses.view') },
    { to: '/attendance', label: 'Attendance', icon: '✓', show: hasPermission('attendance.view') },
    { to: '/fees', label: 'Fee Collection', icon: '\u{1F4B3}', show: hasPermission('fees.collect') },
    { to: '/accounts', label: 'Accounts', icon: '\u{1F4B0}', show: hasPermission('accounts.view') },
    { to: '/reports', label: 'Reports', icon: '\u{1F4C8}', show: hasPermission('reports.view') },
    {
      to: '/notifications',
      label: 'Notifications',
      icon: '\u{1F514}',
      show: hasPermission('notifications.manage') || hasPermission('notifications.view_logs'),
    },
    { to: '/staff', label: 'Staff', icon: '\u{1F464}', show: hasPermission('staff.view') },
    { to: '/staff-attendance', label: 'Staff Attendance', icon: '✓', show: hasPermission('staff_attendance.view') },
    { to: '/roles', label: 'Roles', icon: '\u{1F511}', show: hasPermission('roles.manage') },
    { to: '/audit-log', label: 'Audit Log', icon: '\u{1F4CB}', show: hasPermission('audit.view') },
    { to: '/settings', label: 'Settings', icon: '⚙', show: hasPermission('settings.manage') },
  ];

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <span className="mobile-topbar-brand">
          <span className="sidebar-brand-mark">DI</span>
          Institute ERP
        </span>
      </div>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <nav className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">DI</span>
          Institute ERP
        </div>
        <div className="nav-group">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span style={{ marginRight: 8 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </div>
        {user && (
          <div className="sidebar-footer">
            <div className="sidebar-user">
              Signed in as {user.fullName || (user.isSuperAdmin ? 'Super Admin' : 'Staff')}
              {!user.isSuperAdmin && user.roles.length > 0 && ` (${user.roles.join(', ')})`}
            </div>
            <NavLink
              to="/change-password"
              className="btn-secondary"
              style={{ width: '100%', textAlign: 'center', display: 'block', marginBottom: 'var(--space-2)', textDecoration: 'none' }}
            >
              Change Password
            </NavLink>
            <button onClick={() => logout()} style={{ width: '100%' }}>
              Log out
            </button>
            <AppFooter />
          </div>
        )}
      </nav>
      <main className="main-content">
        <LicenseBanner />
        {children}
      </main>
    </div>
  );
}

/**
 * /students/new and /students/:id both render StudentFormPage at the same
 * position in the tree, so React Router reuses the same component instance
 * across that navigation instead of remounting it — any state the previous
 * student's data was loaded into (name, DOB, contacts...) would otherwise
 * leak into the "new student" form. Keying by id forces a fresh instance.
 */
function KeyedStudentFormPage() {
  const { id } = useParams();
  return <StudentFormPage key={id ?? 'new'} />;
}

// Same reasoning as KeyedStudentFormPage above — /leads/new and /leads/:id
// share a route element, so force a remount on id change.
function KeyedLeadFormPage() {
  const { id } = useParams();
  return <LeadFormPage key={id ?? 'new'} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/change-password"
        element={
          <RequireAuth>
            <Shell>
              <ChangePasswordPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth permission="dashboard.view">
            <Shell>
              <DashboardPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/students"
        element={
          <RequireAuth permission="students.view">
            <Shell>
              <StudentListPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/students/new"
        element={
          <RequireAuth permission="students.create">
            <Shell>
              <KeyedStudentFormPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/students/:id"
        element={
          <RequireAuth permission="students.view">
            <Shell>
              <KeyedStudentFormPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/leads"
        element={
          <RequireAuth permission="leads.view">
            <Shell>
              <LeadListPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/leads/bulk-upload"
        element={
          <RequireAuth permission="leads.create">
            <Shell>
              <LeadBulkUploadPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/leads/new"
        element={
          <RequireAuth permission="leads.create">
            <Shell>
              <KeyedLeadFormPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <RequireAuth permission="leads.view">
            <Shell>
              <KeyedLeadFormPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/fees"
        element={
          <RequireAuth permission="fees.collect">
            <Shell>
              <FeeCollectionPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/accounts"
        element={
          <RequireAuth permission="accounts.view">
            <Shell>
              <AccountsPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/courses"
        element={
          <RequireAuth permission="courses.view">
            <Shell>
              <CourseListPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/courses/:id"
        element={
          <RequireAuth permission="courses.view">
            <Shell>
              <CourseDetailPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/attendance"
        element={
          <RequireAuth permission="attendance.view">
            <Shell>
              <AttendancePage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth permission="reports.view">
            <Shell>
              <ReportsPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/audit-log"
        element={
          <RequireAuth permission="audit.view">
            <Shell>
              <AuditLogPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/notifications"
        element={
          <RequireAuth anyOf={['notifications.manage', 'notifications.view_logs']}>
            <Shell>
              <NotificationsPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth permission="settings.manage">
            <Shell>
              <SettingsPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/staff-attendance"
        element={
          <RequireAuth permission="staff_attendance.view">
            <Shell>
              <StaffAttendancePage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/staff"
        element={
          <RequireAuth permission="staff.view">
            <Shell>
              <StaffListPage />
            </Shell>
          </RequireAuth>
        }
      />
      <Route
        path="/roles"
        element={
          <RequireAuth permission="roles.manage">
            <Shell>
              <RolesPage />
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
