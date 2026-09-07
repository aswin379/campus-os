import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { AppFooter } from '../../components/AppFooter';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, rememberMe);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Institute ERP</h1>
        <p className="text-muted">Sign in to continue</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <label htmlFor="password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: 60 }}
            />
            <button
              type="button"
              className="btn-text"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: '2px 6px' }}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <label className="checkbox-inline" style={{ marginTop: 'var(--space-3)' }}>
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Remember me
          </label>
          {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <AppFooter />
    </div>
  );
}
