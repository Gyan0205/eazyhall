import { useState } from 'react';
import { errorMessage } from '../lib/api';
import { PageHeader, Alert, ThemeToggle } from './ui';

export default function AccountPage({ user, departmentName, api, themePref, onThemeChange, notify }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) {
      setError("New passwords don't match.");
      return;
    }
    setSaving(true);
    const res = await api('/auth/change-password', {
      method: 'POST',
      body: { current_password: form.current, new_password: form.next },
    });
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res.data, 'Failed to change password'));
      return;
    }
    setForm({ current: '', next: '', confirm: '' });
    notify('success', 'Password changed. Use the new password next time you sign in.');
  };

  return (
    <>
      <PageHeader title="Account settings" subtitle="Your profile, appearance and password." />

      <div className="card card-pad" style={{ maxWidth: 640, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="avatar" style={{ width: 48, height: 48, fontSize: '1rem' }}>{user.username.slice(0, 2)}</div>
        <div>
          <div style={{ fontWeight: 650, fontSize: '1.05rem' }}>{user.username}</div>
          <div className="muted small">{user.role} · {departmentName}</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header">
          <div>
            <h3>Appearance</h3>
            <div className="muted small">Light, dark, or follow your device setting.</div>
          </div>
          <ThemeToggle preference={themePref} onChange={onThemeChange} />
        </div>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="card-header"><h3>Change password</h3></div>
        <form className="card-body stack" onSubmit={handleSubmit}>
          <Alert>{error}</Alert>
          <label className="field">
            <span>Current password</span>
            <input type="password" value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} autoComplete="current-password" required />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>New password</span>
              <input type="password" value={form.next} onChange={e => setForm({ ...form, next: e.target.value })} minLength={6} autoComplete="new-password" required />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} minLength={6} autoComplete="new-password" required />
            </label>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
          </div>
        </form>
      </div>
    </>
  );
}
