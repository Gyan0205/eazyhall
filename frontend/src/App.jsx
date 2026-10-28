import { useState, useEffect } from 'react';
import {
  Lock, User as UserIcon, Calendar, Bell, Shield, LogOut, CheckCircle,
  AlertTriangle, ShieldCheck, Cpu, Activity, MapPin, Users, Plus,
  Trash2, RefreshCw, AlertCircle, Clock
} from 'lucide-react';

// Override with VITE_API_BASE (e.g. in .env.production) when the backend is hosted elsewhere
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

// Today's date in the user's local timezone (toISOString() would give the UTC date)
const localDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const loadStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

// FastAPI returns validation errors (422) as a list of objects rather than a string
const errorMessage = (err, fallback) => {
  if (typeof err?.detail === 'string') return err.detail;
  if (Array.isArray(err?.detail)) return err.detail.map(d => d.msg).join('; ');
  return fallback;
};

const TIME_SLOTS = [
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM"
];

function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(loadStoredUser);
  const [tenantCode, setTenantCode] = useState(() => loadStoredUser()?.tenant_code || 'computing'); // 'computing' or 'athletics'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState('');

  // App views
  const [activeTab, setActiveTab] = useState('resources'); // 'resources', 'schedule', 'notifications', 'audit'

  // Data state
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // UI interactions
  const [bookingForm, setBookingForm] = useState({
    resourceId: '',
    date: localDateString(),
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    purpose: ''
  });
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [auditVerifyResult, setAuditVerifyResult] = useState(null);
  const [auditVerifyLoading, setAuditVerifyLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null); // track row actions loading
  const [showAddResource, setShowAddResource] = useState(false);
  const [newResource, setNewResource] = useState({ name: '', type: 'Lab', location: '', capacity: 10 });
  const [resourceError, setResourceError] = useState('');
  // User management (Admin) and account settings
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Faculty' });
  const [userMessage, setUserMessage] = useState({ type: '', text: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  // Demo-only controls stay hidden until the backend confirms it's running in demo mode
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then(res => (res.ok ? res.json() : null))
      .then(cfg => setDemoMode(Boolean(cfg?.demo_mode)))
      .catch(() => setDemoMode(false));
  }, []);

  // Fill demo credentials only when a role preset button is clicked
  const handlePreFill = (role, tenant) => {
    if (tenant === 'computing') {
      setUsername(role === 'Admin' ? 'admin_comp' : role === 'Faculty' ? 'fac_comp' : 'stud_comp');
    } else {
      setUsername(role === 'Admin' ? 'admin_ath' : role === 'Faculty' ? 'fac_ath' : 'stud_ath');
    }
    setPassword(role === 'Admin' ? 'admin123' : role === 'Faculty' ? 'faculty123' : 'student123');
  };

  // Sync tenant theme to DOM
  useEffect(() => {
    document.body.setAttribute('data-tenant', tenantCode);
  }, [tenantCode]);

  // Authenticated fetch; an expired or invalid token signs the user out instead of failing silently
  const authFetch = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
    });
    if (response.status === 401) {
      handleLogout();
    }
    return response;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, tenant_code: tenantCode }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(errorMessage(err, 'Login failed'));
      }
      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setTenantCode(data.user.tenant_code);
      setActiveTab('resources');
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError('');
    setRegisterSuccess('');
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          role: 'Student',
          tenant_code: tenantCode
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(errorMessage(err, 'Registration failed'));
      }
      setRegisterSuccess('User registered successfully! You can now log in.');
      setIsRegistering(false);
      alert("Registration successful! Your new credentials are pre-filled below. Click 'Sign In' to log in.");
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setAuditVerifyResult(null);
    // Clear the previous session's data so it doesn't flash for the next user
    setResources([]);
    setBookings([]);
    setNotifications([]);
    setAuditLogs([]);
    setBookingError('');
    setBookingSuccess('');
    setDepartmentUsers([]);
    setUserMessage({ type: '', text: '' });
    setPasswordForm({ current: '', next: '', confirm: '' });
    setPasswordMessage({ type: '', text: '' });
    // Don't leave the previous user's credentials in the login form
    setUsername('');
    setPassword('');
  };

  const fetchResources = async () => {
    try {
      const response = await authFetch('/resources');
      if (response.ok) {
        const data = await response.json();
        setResources(data);
      }
    } catch (err) {
      console.error("Failed to fetch resources", err);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await authFetch('/bookings');
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (err) {
      console.error("Failed to fetch bookings", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await authFetch('/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await authFetch('/audit/logs');
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    }
  };

  // Fetch initial data on login
  useEffect(() => {
    if (token) {
      fetchResources();
      fetchBookings();
      fetchNotifications();
      if (user && user.role === 'Admin') {
        fetchAuditLogs();
      }

      // Auto-poll notifications every 8 seconds
      const interval = setInterval(() => {
        fetchNotifications();
        fetchBookings(); // Sync schedules for live updates
      }, 8000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchers are recreated each render; re-run only on auth changes
  }, [token, user]);

  const handleCreateResource = async (e) => {
    e.preventDefault();
    setResourceError('');
    try {
      const response = await authFetch('/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResource)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(errorMessage(err, "Failed to create resource"));
      }
      setNewResource({ name: '', type: 'Lab', location: '', capacity: 10 });
      setShowAddResource(false);
      fetchResources();
      if (user.role === 'Admin') fetchAuditLogs();
    } catch (err) {
      setResourceError(err.message);
    }
  };

  const convertTimeTo24h = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
      hours = '00';
    }
    if (modifier === 'PM') {
      hours = (parseInt(hours, 10) + 12).toString();
    }
    return `${hours.padStart(2, '0')}:${minutes}:00`;
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess('');

    if (!bookingForm.resourceId) {
      setBookingError("Please select a resource.");
      return;
    }

    try {
      // Interpret the picked slot in the user's timezone and send it as UTC
      const startIso = new Date(`${bookingForm.date}T${convertTimeTo24h(bookingForm.startTime)}`).toISOString();
      const endIso = new Date(`${bookingForm.date}T${convertTimeTo24h(bookingForm.endTime)}`).toISOString();

      const response = await authFetch('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_id: parseInt(bookingForm.resourceId, 10),
          start_time: startIso,
          end_time: endIso,
          purpose: bookingForm.purpose
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(errorMessage(err, "Booking failed"));
      }

      const data = await response.json();
      setBookingSuccess(`Booking successful! Status: ${data.status}`);
      setBookingForm({ ...bookingForm, purpose: '' });
      fetchBookings();
      fetchNotifications();
      if (user.role === 'Admin') fetchAuditLogs();
    } catch (err) {
      setBookingError(err.message);
    }
  };

  const handleApprove = async (id) => {
    setLoadingAction(id);
    try {
      const response = await authFetch(`/bookings/${id}/approve`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        alert(errorMessage(err, "Approve failed"));
      }
      fetchBookings();
      fetchNotifications();
      fetchAuditLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async (id) => {
    setLoadingAction(id);
    try {
      const response = await authFetch(`/bookings/${id}/reject`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        alert(errorMessage(err, "Reject failed"));
      }
      fetchBookings();
      fetchNotifications();
      fetchAuditLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancel = async (id) => {
    setLoadingAction(id);
    try {
      const response = await authFetch(`/bookings/${id}/cancel`, { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        alert(errorMessage(err, "Cancel failed"));
      }
      fetchBookings();
      fetchNotifications();
      if (user.role === 'Admin') fetchAuditLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const fetchDepartmentUsers = async () => {
    try {
      const response = await authFetch('/users');
      if (response.ok) {
        setDepartmentUsers(await response.json());
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserMessage({ type: '', text: '' });
    try {
      const response = await authFetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(errorMessage(data, "Failed to create user"));
      }
      setUserMessage({ type: 'success', text: `Created ${data.role} account "${data.username}". Share the password with them securely.` });
      setNewUser({ username: '', password: '', role: newUser.role });
      fetchDepartmentUsers();
      fetchAuditLogs();
    } catch (err) {
      setUserMessage({ type: 'error', text: err.message });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage({ type: 'error', text: "New passwords don't match." });
      return;
    }
    try {
      const response = await authFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: passwordForm.current, new_password: passwordForm.next })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(errorMessage(data, "Failed to change password"));
      }
      setPasswordForm({ current: '', next: '', confirm: '' });
      setPasswordMessage({ type: 'success', text: 'Password changed. Use the new password next time you sign in.' });
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.message });
    }
  };

  const handleVerifyAudit = async () => {
    setAuditVerifyLoading(true);
    try {
      const response = await authFetch('/audit/verify', { method: 'POST' });
      const data = await response.json();
      setAuditVerifyResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditVerifyLoading(false);
    }
  };

  const handleSimulateTamper = async () => {
    try {
      const response = await authFetch('/audit/tamper', { method: 'POST' });
      const data = await response.json();
      alert(response.ok ? data.message : errorMessage(data, "Tamper simulation failed"));
      fetchAuditLogs(); // reload logs to display tampered info
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepairAudit = async () => {
    try {
      const response = await authFetch('/audit/repair', { method: 'POST' });
      const data = await response.json();
      alert(response.ok ? data.message : errorMessage(data, "Repair failed"));
      fetchAuditLogs();

      // Auto re-verify to update status instantly
      setAuditVerifyLoading(true);
      const verifyRes = await authFetch('/audit/verify', { method: 'POST' });
      const verifyData = await verifyRes.json();
      setAuditVerifyResult(verifyData);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditVerifyLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '40px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
            {tenantCode === 'computing' ? (
              <Cpu style={{ width: '36px', height: '36px', color: 'var(--accent)' }} />
            ) : (
              <Activity style={{ width: '36px', height: '36px', color: 'var(--accent)' }} />
            )}
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800' }}>CAMPUS BOOKINGS</h2>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => { setIsRegistering(false); setLoginError(''); setRegisterSuccess(''); }}
              className={`btn btn-sm ${!isRegistering ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flexGrow: 1 }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegistering(true); setLoginError(''); setRegisterSuccess(''); }}
              className={`btn btn-sm ${isRegistering ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flexGrow: 1 }}
            >
              Create Account
            </button>
          </div>

          {isRegistering ? (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {loginError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle style={{ flexShrink: 0, width: '18px', height: '18px' }} />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>SELECT DEPARTMENT TENANT</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setTenantCode('computing')}
                    className={`btn ${tenantCode === 'computing' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    Computing
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenantCode('athletics')}
                    className={`btn ${tenantCode === 'athletics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    Athletics
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>ROLE</label>
                <select value="Student" disabled>
                  <option value="Student">Student (Requires approval for bookings)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  Faculty and Administrator accounts are issued by your department admin.
                </span>
              </div>

              <hr style={{ border: 'none', height: '1px', background: 'var(--border-card)' }} />

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>USERNAME</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon style={{ position: 'absolute', left: '14px', top: '14px', width: '18px', height: '18px', color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                    placeholder="Enter custom username"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: '14px', top: '14px', width: '18px', height: '18px', color: 'var(--text-dim)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                    placeholder="Enter secure password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                Register Account in {tenantCode === 'computing' ? 'Computing' : 'Athletics'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {loginError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle style={{ flexShrink: 0, width: '18px', height: '18px' }} />
                  <span>{loginError}</span>
                </div>
              )}
              {registerSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle style={{ flexShrink: 0, width: '18px', height: '18px' }} />
                  <span>{registerSuccess}</span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>DEPARTMENT TENANT</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setTenantCode('computing')}
                    className={`btn ${tenantCode === 'computing' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    Computing
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenantCode('athletics')}
                    className={`btn ${tenantCode === 'athletics' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    Athletics
                  </button>
                </div>
              </div>

              {demoMode && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>DEMO ROLE PRESETS</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {['Student', 'Faculty', 'Admin'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handlePreFill(role, tenantCode)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '6px 0' }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              )}

              <hr style={{ border: 'none', height: '1px', background: 'var(--border-card)' }} />

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>USERNAME</label>
                <div style={{ position: 'relative' }}>
                  <UserIcon style={{ position: 'absolute', left: '14px', top: '14px', width: '18px', height: '18px', color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '8px' }}>PASSWORD</label>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: '14px', top: '14px', width: '18px', height: '18px', color: 'var(--text-dim)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                Sign In to {tenantCode === 'computing' ? 'Computing' : 'Athletics'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'row' }}>

      {/* Sidebar Navigation */}
      <aside className="glass-panel" style={{ width: 'var(--sidebar-width)', borderRadius: '0', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Tenant Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {tenantCode === 'computing' ? (
            <Cpu style={{ width: '28px', height: '28px', color: 'var(--accent)' }} />
          ) : (
            <Activity style={{ width: '28px', height: '28px', color: 'var(--accent)' }} />
          )}
          <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
            {tenantCode === 'computing' ? 'Computing' : 'Athletics'}
          </span>
        </div>

        {/* User Card */}
        <div className="glass-panel" style={{ padding: '16px', background: 'hsla(var(--base-h), var(--base-s), 5%, 0.4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>AUTHORIZED USER</span>
            <span style={{ fontSize: '1rem', fontWeight: '700' }}>{user.username}</span>
            <div>
              <span className={`badge ${user.role === 'Admin' ? 'badge-approved' : 'badge-pending'}`} style={{ fontSize: '0.65rem' }}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
          <button
            onClick={() => setActiveTab('resources')}
            className={`btn ${activeTab === 'resources' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
          >
            <Calendar style={{ width: '18px', height: '18px' }} />
            Book Resources
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`btn ${activeTab === 'schedule' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
          >
            <Clock style={{ width: '18px', height: '18px' }} />
            Timeline Calendar
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`btn ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%', position: 'relative' }}
          >
            <Bell style={{ width: '18px', height: '18px' }} />
            <span>Inbox Alerts</span>
            {notifications.length > 0 && (
              <span style={{ position: 'absolute', right: '16px', background: 'var(--error)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '9999px', fontWeight: 'bold' }}>
                {notifications.length}
              </span>
            )}
          </button>
          {user.role === 'Admin' && (
            <button
              onClick={() => { setActiveTab('audit'); fetchAuditLogs(); }}
              className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
            >
              <Shield style={{ width: '18px', height: '18px' }} />
              Audit Ledger
            </button>
          )}
          {user.role === 'Admin' && (
            <button
              onClick={() => { setActiveTab('users'); fetchDepartmentUsers(); }}
              className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', width: '100%' }}
            >
              <Users style={{ width: '18px', height: '18px' }} />
              Manage Users
            </button>
          )}
          <button
            onClick={() => setActiveTab('account')}
            className={`btn ${activeTab === 'account' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', width: '100%' }}
          >
            <Lock style={{ width: '18px', height: '18px' }} />
            Account
          </button>
        </nav>

        {/* Logout */}
        <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
          <LogOut style={{ width: '18px', height: '18px' }} />
          Sign Out
        </button>
      </aside>

      {/* Main Panel */}
      <main style={{ flexGrow: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>
              {activeTab === 'resources' && "Resource Catalog & Booking"}
              {activeTab === 'schedule' && "Campus Booking Schedules"}
              {activeTab === 'notifications' && "Asynchronous Notifications Drawer"}
              {activeTab === 'audit' && "Cryptographic Tamper-Evident Audit Ledger"}
              {activeTab === 'users' && "Department Users"}
              {activeTab === 'account' && "Account Settings"}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
              {tenantCode === 'computing' ? 'School of Computing Portal' : 'Department of Athletics Portal'} | Role-Based Access Isolation
            </p>
          </div>
        </header>

        {/* TAB 1: RESOURCES & BOOKING */}
        {activeTab === 'resources' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', alignItems: 'start' }}>

            {/* Resources Catalog List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Available Resources</h3>
                {user.role === 'Admin' && (
                  <button onClick={() => setShowAddResource(!showAddResource)} className="btn btn-primary btn-sm">
                    <Plus style={{ width: '16px', height: '16px' }} /> Add Resource
                  </button>
                )}
              </div>

              {showAddResource && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h4 style={{ marginBottom: '16px' }}>New Department Resource</h4>
                  {resourceError && <div style={{ color: 'var(--error)', marginBottom: '12px' }}>{resourceError}</div>}
                  <form onSubmit={handleCreateResource} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RESOURCE NAME</label>
                      <input
                        type="text"
                        value={newResource.name}
                        onChange={e => setNewResource({...newResource, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RESOURCE TYPE</label>
                      <select
                        value={newResource.type}
                        onChange={e => setNewResource({...newResource, type: e.target.value})}
                      >
                        <option value="Lab">Lab</option>
                        <option value="Hall">Seminar Hall</option>
                        <option value="Court">Sports Court</option>
                        <option value="Equipment">Equipment</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>LOCATION</label>
                      <input
                        type="text"
                        value={newResource.location}
                        onChange={e => setNewResource({...newResource, location: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CAPACITY</label>
                      <input
                        type="number"
                        min="1"
                        value={newResource.capacity}
                        onChange={e => setNewResource({...newResource, capacity: parseInt(e.target.value, 10) || ''})}
                        required
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button type="button" onClick={() => setShowAddResource(false)} className="btn btn-secondary btn-sm">Cancel</button>
                      <button type="submit" className="btn btn-primary btn-sm">Save Resource</button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {resources.map((r) => (
                  <div key={r.id} className="glass-panel interactive" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{r.name}</h4>
                        <span className="badge badge-approved" style={{ fontSize: '0.65rem' }}>{r.type}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin style={{ width: '14px', height: '14px' }} />
                          <span>{r.location}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users style={{ width: '14px', height: '14px' }} />
                          <span>Capacity: {r.capacity} people</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setBookingForm({ ...bookingForm, resourceId: r.id.toString() })}
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                    >
                      Select to Book
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Booking Form */}
            <div className="glass-panel" style={{ padding: '32px', position: 'sticky', top: '40px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px' }}>Submit Booking Request</h3>

              {bookingError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {bookingError}
                </div>
              )}
              {bookingSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {bookingSuccess}
                </div>
              )}

              <form onSubmit={handleCreateBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>SELECTED RESOURCE</label>
                  <select
                    value={bookingForm.resourceId}
                    onChange={e => setBookingForm({...bookingForm, resourceId: e.target.value})}
                    required
                  >
                    <option value="">-- Select a Resource --</option>
                    {resources.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>BOOKING DATE</label>
                  <input
                    type="date"
                    value={bookingForm.date}
                    onChange={e => setBookingForm({...bookingForm, date: e.target.value})}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>START TIME</label>
                    <select
                      value={bookingForm.startTime}
                      onChange={e => setBookingForm({...bookingForm, startTime: e.target.value})}
                      required
                    >
                      {TIME_SLOTS.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>END TIME</label>
                    <select
                      value={bookingForm.endTime}
                      onChange={e => setBookingForm({...bookingForm, endTime: e.target.value})}
                      required
                    >
                      {TIME_SLOTS.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>PURPOSE OF BOOKING</label>
                  <textarea
                    value={bookingForm.purpose}
                    onChange={e => setBookingForm({...bookingForm, purpose: e.target.value})}
                    rows="3"
                    placeholder="Provide purpose details..."
                    required
                  />
                </div>

                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>
                    * Student bookings require approval. Faculty & Admin bookings are approved instantly.
                  </span>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Confirm Booking Request
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* TAB 2: SCHEDULE TIMELINE */}
        {activeTab === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Active Bookings Schedule</h3>
              <button onClick={() => { fetchBookings(); }} className="btn btn-secondary btn-sm">
                <RefreshCw style={{ width: '16px', height: '16px' }} /> Sync Schedules
              </button>
            </div>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'hsla(var(--base-h), var(--base-s), 5%, 0.6)', borderBottom: '1px solid var(--border-card)' }}>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>RESOURCE</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>USER</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>TIME INTERVAL</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>PURPOSE</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>STATUS</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No bookings exist in this department yet.
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                        <td style={{ padding: '16px 24px', fontWeight: '600' }}>{b.resource_name} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 'normal' }}>{b.resource_type}</span></td>
                        <td style={{ padding: '16px 24px' }}>{b.username}</td>
                        <td style={{ padding: '16px 24px', fontSize: '0.85rem' }}>
                          <div>{new Date(b.start_time).toLocaleString()}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to {new Date(b.end_time).toLocaleString()}</div>
                        </td>
                        <td style={{ padding: '16px 24px', fontSize: '0.9rem' }}>{b.purpose}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <span className={`badge ${
                            b.status === 'Approved' ? 'badge-approved' :
                            b.status === 'Pending' ? 'badge-pending' :
                            b.status === 'Rejected' ? 'badge-rejected' : 'badge-cancelled'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          {loadingAction === b.id ? (
                            <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {user.role === 'Admin' && b.status === 'Pending' && (
                                <>
                                  <button onClick={() => handleApprove(b.id)} className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'var(--success)', color: '#fff' }}>Approve</button>
                                  <button onClick={() => handleReject(b.id)} className="btn btn-danger btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Reject</button>
                                </>
                              )}

                              {/* Cancel action */}
                              {b.status !== 'Cancelled' && b.status !== 'Rejected' && (user.role === 'Admin' || b.user_id === user.id) && (
                                <button onClick={() => handleCancel(b.id)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Trash2 style={{ width: '12px', height: '12px' }} /> Cancel
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>System Alert Logs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notifications.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  Inbox is empty. Notifications will appear here when actions are dispatched.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="glass-panel notification-toast" style={{ padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '16px', background: 'hsla(var(--base-h), var(--base-s), 8%, 0.6)' }}>
                    <Bell style={{ width: '20px', height: '20px', color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flexGrow: 1 }}>
                      <p style={{ fontSize: '0.95rem', fontWeight: '500' }}>{n.message}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginTop: '6px' }}>
                        Dispatched: {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span className="badge badge-approved" style={{ fontSize: '0.6rem' }}>{n.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LEDGER (Admin Only) */}
        {activeTab === 'audit' && user.role === 'Admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Audit Verification Control Panel */}
            <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tamper-Evident Ledger Integrity Console</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                Every administrative action, booking creation, approval, and cancellation is hashed and linked to the previous entry, constructing a cryptographically secure chain. Direct changes inside the SQLite database will break the verification chain and flag the exact tampered row.
              </p>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px' }}>
                <button
                  onClick={handleVerifyAudit}
                  className="btn btn-primary"
                  disabled={auditVerifyLoading}
                >
                  <ShieldCheck style={{ width: '18px', height: '18px' }} />
                  {auditVerifyLoading ? 'Verifying Chain...' : 'Verify Audit Chain'}
                </button>
                {demoMode && (
                <>
                <button
                  onClick={handleSimulateTamper}
                  className="btn btn-secondary"
                  style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                >
                  <AlertCircle style={{ width: '18px', height: '18px' }} />
                  Simulate Database Tampering
                </button>
                <button
                  onClick={handleRepairAudit}
                  className="btn btn-secondary"
                  style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                >
                  <CheckCircle style={{ width: '18px', height: '18px' }} />
                  Heal Ledger Chain
                </button>
                </>
                )}
              </div>

              {auditVerifyResult && (
                <div style={{
                  background: auditVerifyResult.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${auditVerifyResult.valid ? 'var(--success)' : 'var(--error)'}`,
                  color: auditVerifyResult.valid ? 'var(--success)' : 'var(--error)',
                  padding: '20px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  marginTop: '10px'
                }}>
                  {auditVerifyResult.valid ? (
                    <CheckCircle style={{ width: '28px', height: '28px', flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle style={{ width: '28px', height: '28px', flexShrink: 0 }} />
                  )}
                  <div>
                    <h4 style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '4px' }}>
                      {auditVerifyResult.valid ? 'Verification Successful' : 'Ledger Integrity Breached!'}
                    </h4>
                    <p style={{ fontSize: '0.9rem' }}>
                      {auditVerifyResult.message || auditVerifyResult.details}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Cryptographic Hashing Chain Blocks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Cryptographic Block Chain Ledger</h3>
                <button onClick={fetchAuditLogs} className="btn btn-secondary btn-sm">
                  <RefreshCw style={{ width: '14px', height: '14px' }} /> Refresh Audit Logs
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {auditLogs.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No audit records available. Generate bookings/resources to build the ledger chain.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '4px solid var(--accent)' }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>BLOCK #{log.id}</span>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginTop: '2px', color: 'var(--accent)' }}>{log.action}</h4>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>

                      <div style={{ background: 'hsla(var(--base-h), var(--base-s), 5%, 0.6)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>DATA PAYLOAD:</span>
                        <code style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{log.details}</code>
                        <div style={{ marginTop: '8px', color: 'var(--text-dim)' }}>
                          Action Triggered By: <strong style={{ color: 'var(--text-muted)' }}>{log.username}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        <div>
                          <span style={{ color: 'var(--text-dim)' }}>PREV HASH:</span> <span style={{ color: 'var(--text-muted)' }}>{log.prev_hash}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-dim)' }}>CURR HASH:</span> <span style={{ color: 'var(--accent)' }}>{log.hash}</span>
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: MANAGE USERS (Admin Only) */}
        {activeTab === 'users' && user.role === 'Admin' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', alignItems: 'start' }}>
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'hsla(var(--base-h), var(--base-s), 5%, 0.6)', borderBottom: '1px solid var(--border-card)' }}>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>USERNAME</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>ROLE</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                      <td style={{ padding: '14px 24px', fontWeight: '600' }}>
                        {u.username}{u.id === user.id && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> (you)</span>}
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        <span className={`badge ${u.role === 'Admin' ? 'badge-approved' : 'badge-pending'}`} style={{ fontSize: '0.65rem' }}>{u.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass-panel" style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Add a User</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Create Faculty or Admin accounts for your department. Students can also sign themselves up.
              </p>
              {userMessage.text && (
                <div style={{ background: userMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: userMessage.type === 'success' ? 'var(--success)' : 'var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                  {userMessage.text}
                </div>
              )}
              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>USERNAME</label>
                  <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} minLength={3} autoComplete="off" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>TEMPORARY PASSWORD</label>
                  <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} minLength={6} autoComplete="new-password" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>ROLE</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="Faculty">Faculty (auto-approved bookings)</option>
                    <option value="Admin">Admin (full department access)</option>
                    <option value="Student">Student (bookings need approval)</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Account</button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: ACCOUNT SETTINGS */}
        {activeTab === 'account' && (
          <div className="glass-panel" style={{ padding: '32px', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px' }}>Change Password</h3>
            {passwordMessage.text && (
              <div style={{ background: passwordMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: passwordMessage.type === 'success' ? 'var(--success)' : 'var(--error)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                {passwordMessage.text}
              </div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>CURRENT PASSWORD</label>
                <input type="password" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} autoComplete="current-password" required />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>NEW PASSWORD</label>
                <input type="password" value={passwordForm.next} onChange={e => setPasswordForm({ ...passwordForm, next: e.target.value })} minLength={6} autoComplete="new-password" required />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>CONFIRM NEW PASSWORD</label>
                <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} minLength={6} autoComplete="new-password" required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Update Password</button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
