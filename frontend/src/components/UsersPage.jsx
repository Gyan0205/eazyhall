import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { PageHeader, Alert } from './ui';

const ROLE_BADGE = { Admin: 'badge-accent', Faculty: 'badge-approved', Student: '' };

export default function UsersPage({ user, api, notify }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'Faculty' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api('/users').then(res => {
      if (!cancelled && res.ok) setUsers(res.data);
    });
    return () => { cancelled = true; };
  }, [api, reloadKey]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await api('/users', { method: 'POST', body: form });
    setSaving(false);
    if (!res.ok) {
      setError(errorMessage(res.data, 'Failed to create user'));
      return;
    }
    notify('success', `Created ${res.data.role} account "${res.data.username}". Share the password with them securely.`);
    setForm({ username: '', password: '', role: form.role });
    setReloadKey(k => k + 1);
  };

  const counts = users.reduce((c, u) => ({ ...c, [u.role]: (c[u.role] || 0) + 1 }), {});

  return (
    <>
      <PageHeader
        title="Manage users"
        subtitle={`${users.length} people in your department · ${counts.Admin || 0} admins, ${counts.Faculty || 0} faculty, ${counts.Student || 0} students`}
      />
      <div className="detail-layout">
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>User</th><th>Role</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 30, height: 30, fontSize: '0.75rem' }}>{u.username.slice(0, 2)}</div>
                        <span className="cell-title">{u.username}</span>
                        {u.id === user.id && <span className="cell-sub">(you)</span>}
                      </div>
                    </td>
                    <td><span className={`badge no-dot ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card sticky-panel">
          <div className="card-header"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus style={{ width: 18, height: 18, color: 'var(--accent)' }} /> Add a user</h3></div>
          <form className="card-body stack" onSubmit={handleCreate}>
            <p className="muted small">Create Faculty or Admin accounts for your department. Students can also sign themselves up.</p>
            <Alert>{error}</Alert>
            <label className="field">
              <span>Username</span>
              <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} minLength={3} autoComplete="off" required />
            </label>
            <label className="field">
              <span>Temporary password</span>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={6} autoComplete="new-password" required />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="Faculty">Faculty: books instantly</option>
                <option value="Admin">Admin: full department access</option>
                <option value="Student">Student: bookings need approval</option>
              </select>
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</button>
          </form>
        </div>
      </div>
    </>
  );
}
