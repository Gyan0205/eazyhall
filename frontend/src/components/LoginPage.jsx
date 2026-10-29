import { useState } from 'react';
import { User as UserIcon, Lock, CalendarDays, ShieldCheck, Users, Cpu, Activity, RefreshCw } from 'lucide-react';
import { request, errorMessage } from '../lib/api';
import { Alert, ThemeToggle } from './ui';

const DEMO_ACCOUNTS = {
  computing: { Admin: ['admin_comp', 'admin123'], Faculty: ['fac_comp', 'faculty123'], Student: ['stud_comp', 'student123'] },
  athletics: { Admin: ['admin_ath', 'admin123'], Faculty: ['fac_ath', 'faculty123'], Student: ['stud_ath', 'student123'] },
};

export default function LoginPage({ tenantCode, onTenantChange, demoMode, themePref, onThemeChange, onLoggedIn }) {
  const [mode, setMode] = useState('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const departmentName = tenantCode === 'computing' ? 'School of Computing' : 'Department of Athletics';

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    if (mode === 'signin') {
      const res = await request('/auth/login', { method: 'POST', body: { username, password, tenant_code: tenantCode } });
      setLoading(false);
      if (!res.ok) {
        setError(errorMessage(res.data, 'Sign-in failed'));
        return;
      }
      onLoggedIn(res.data);
    } else {
      const res = await request('/auth/register', {
        method: 'POST',
        body: { username, password, role: 'Student', tenant_code: tenantCode },
      });
      setLoading(false);
      if (!res.ok) {
        setError(errorMessage(res.data, 'Registration failed'));
        return;
      }
      setMode('signin');
      setSuccess('Account created. Sign in with your new username and password.');
    }
  };

  const fillDemo = (role) => {
    const [u, p] = DEMO_ACCOUNTS[tenantCode][role];
    setUsername(u);
    setPassword(p);
    setMode('signin');
  };

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="" className="brand-logo" style={{ width: 40, height: 40 }} />
          <span className="brand-name" style={{ fontSize: '1.15rem' }}>EazyHall</span>
        </div>
        <div>
          <h1>Book halls, labs and courts without the back-and-forth.</h1>
          <p>See what&apos;s free this week, reserve a room in seconds, and keep every approval on record.</p>
        </div>
        <div className="auth-features">
          <div className="auth-feature">
            <CalendarDays />
            <div><b>Weekly timetables</b><span>Every room&apos;s schedule at a glance, with seats and facilities.</span></div>
          </div>
          <div className="auth-feature">
            <Users />
            <div><b>Role-based access</b><span>Students request, faculty book directly, admins approve.</span></div>
          </div>
          <div className="auth-feature">
            <ShieldCheck />
            <div><b>Tamper-evident audit log</b><span>Each action is hash-chained, so edits can&apos;t go unnoticed.</span></div>
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="top">
          <ThemeToggle preference={themePref} onChange={onThemeChange} />
        </div>
        <div className="auth-form-wrap">
          <div className="auth-card">
            <div className="heading">
              <h2 style={{ fontSize: '1.5rem' }}>{mode === 'signin' ? 'Sign in to EazyHall' : 'Create a student account'}</h2>
              <p>{mode === 'signin' ? 'Choose your department and enter your details.' : 'Faculty and admin accounts are created by your department admin.'}</p>
            </div>

            <div className="segmented" role="tablist" aria-label="Department">
              <button type="button" role="tab" aria-selected={tenantCode === 'computing'} className={tenantCode === 'computing' ? 'active' : ''} onClick={() => onTenantChange('computing')}>
                <Cpu /> Computing
              </button>
              <button type="button" role="tab" aria-selected={tenantCode === 'athletics'} className={tenantCode === 'athletics' ? 'active' : ''} onClick={() => onTenantChange('athletics')}>
                <Activity /> Athletics
              </button>
            </div>

            <form onSubmit={handleSubmit} className="stack">
              <Alert type="error">{error}</Alert>
              <Alert type="success">{success}</Alert>

              <label className="field">
                <span>Username</span>
                <div className="input-icon">
                  <UserIcon />
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" minLength={mode === 'register' ? 3 : undefined} required />
                </div>
              </label>

              <label className="field">
                <span>Password</span>
                <div className="input-icon">
                  <Lock />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 6 : undefined} required />
                </div>
              </label>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading && <RefreshCw className="spin" />}
                {mode === 'signin' ? `Sign in to ${departmentName}` : 'Create account'}
              </button>
            </form>

            <p className="muted small" style={{ textAlign: 'center' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)', padding: '0 4px', height: 'auto' }} onClick={() => switchMode(mode === 'signin' ? 'register' : 'signin')}>
                {mode === 'signin' ? 'Create a student account' : 'Sign in'}
              </button>
            </p>

            {demoMode && (
              <div className="card card-pad" style={{ padding: 14 }}>
                <div className="label" style={{ marginBottom: 8 }}>Demo accounts</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {['Student', 'Faculty', 'Admin'].map(role => (
                    <button key={role} type="button" className="btn btn-secondary btn-sm" onClick={() => fillDemo(role)}>{role}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
