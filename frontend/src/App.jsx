import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Bell } from 'lucide-react';
import { request } from './lib/api';
import { useTheme } from './lib/theme';
import { Toasts } from './components/ui';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import ResourcesPage from './components/ResourcesPage';
import ResourceDetail from './components/ResourceDetail';
import BookingsPage from './components/BookingsPage';
import NotificationsPage from './components/NotificationsPage';
import AuditPage from './components/AuditPage';
import UsersPage from './components/UsersPage';
import AccountPage from './components/AccountPage';

const loadStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

const DEPARTMENTS = { computing: 'School of Computing', athletics: 'Department of Athletics' };

// Notifications newer than the last one the user opened count as unread
const seenKey = (user) => `seenNotification:${user.tenant_id}:${user.id}`;

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState(loadStoredUser);
  const [tenantCode, setTenantCode] = useState(() => loadStoredUser()?.tenant_code || 'computing');
  const [demoMode, setDemoMode] = useState(false);
  const [themePref, setThemePref] = useTheme();

  const [activeTab, setActiveTab] = useState('resources');
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [lastSeenNotification, setLastSeenNotification] = useState(() => {
    const stored = loadStoredUser();
    return stored ? Number(localStorage.getItem(seenKey(stored)) || 0) : 0;
  });

  const departmentName = DEPARTMENTS[tenantCode] || tenantCode;
  const isAdmin = user?.role === 'Admin';

  // Department accent color
  useEffect(() => {
    document.documentElement.setAttribute('data-tenant', tenantCode);
  }, [tenantCode]);

  // Demo-only controls stay hidden until the backend confirms it's running in demo mode
  useEffect(() => {
    request('/config').then(res => setDemoMode(Boolean(res.ok && res.data?.demo_mode)));
  }, []);

  const notify = useCallback((type, text) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  const logoutRef = useRef(() => {});
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setResources([]);
    setBookings([]);
    setNotifications([]);
    setAuditLogs([]);
    setSelectedResourceId(null);
    setActiveTab('resources');
    setNavOpen(false);
  }, []);
  useEffect(() => {
    logoutRef.current = handleLogout;
  }, [handleLogout]);

  // Authenticated API call; an expired token signs the user out
  const api = useCallback(
    (path, options = {}) => request(path, { ...options, token, onUnauthorized: () => logoutRef.current() }),
    [token]
  );

  const loadResources = useCallback(async () => {
    const res = await api('/resources');
    if (res.ok) setResources(res.data);
  }, [api]);

  const loadBookings = useCallback(async () => {
    const res = await api('/bookings');
    if (res.ok) setBookings(res.data);
  }, [api]);

  const loadNotifications = useCallback(async () => {
    const res = await api('/notifications');
    if (res.ok) setNotifications(res.data);
  }, [api]);

  const loadAudit = useCallback(async () => {
    const res = await api('/audit/logs');
    if (res.ok) setAuditLogs(res.data);
  }, [api]);

  // Initial load + light polling for new bookings and notifications
  useEffect(() => {
    if (!token) return undefined;
    const loadAll = () => {
      loadResources();
      loadBookings();
      loadNotifications();
    };
    const first = setTimeout(loadAll, 0);
    const timer = setInterval(() => {
      loadBookings();
      loadNotifications();
    }, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [token, loadResources, loadBookings, loadNotifications]);

  // Refresh everything that an action can change (notifications are written just after the response)
  const refreshAfterChange = useCallback(() => {
    loadResources();
    loadBookings();
    loadNotifications();
    setTimeout(loadNotifications, 1200);
    if (isAdmin) loadAudit();
  }, [loadResources, loadBookings, loadNotifications, loadAudit, isAdmin]);

  const handleLoggedIn = (data) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    setTenantCode(data.user.tenant_code);
    setLastSeenNotification(Number(localStorage.getItem(seenKey(data.user)) || 0));
    setActiveTab('resources');
  };

  const navigate = (tab) => {
    setActiveTab(tab);
    setSelectedResourceId(null);
    setNavOpen(false);
    if (tab === 'audit') loadAudit();
    if (tab === 'bookings') loadBookings();
    if (tab === 'notifications' && notifications.length && user) {
      const newest = Math.max(...notifications.map(n => n.id));
      localStorage.setItem(seenKey(user), String(newest));
      setLastSeenNotification(newest);
    }
    window.scrollTo({ top: 0 });
  };

  const openResource = (id) => {
    setActiveTab('resources');
    setSelectedResourceId(id);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };

  if (!token || !user) {
    return (
      <>
        <LoginPage
          tenantCode={tenantCode}
          onTenantChange={setTenantCode}
          demoMode={demoMode}
          themePref={themePref}
          onThemeChange={setThemePref}
          onLoggedIn={handleLoggedIn}
        />
        <Toasts toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
      </>
    );
  }

  const unread = notifications.filter(n => n.id > lastSeenNotification).length;
  const pendingCount = bookings.filter(b => b.status === 'Pending').length;
  const selectedResource = resources.find(r => r.id === selectedResourceId);

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        departmentName={departmentName}
        activeTab={activeTab}
        onNavigate={navigate}
        notificationCount={unread}
        pendingCount={pendingCount}
        themePref={themePref}
        onThemeChange={setThemePref}
        onSignOut={handleLogout}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="main">
        <header className="topbar">
          <button type="button" className="btn btn-ghost icon-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <Menu />
          </button>
          <img src="/logo.png" alt="" className="brand-logo" style={{ width: 30, height: 30 }} />
          <span className="brand-name">EazyHall</span>
          <button type="button" className="btn btn-ghost icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => navigate('notifications')} style={{ position: 'relative' }}>
            <Bell />
            {unread > 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />}
          </button>
        </header>

        <main className="content">
          {activeTab === 'resources' && (selectedResource ? (
            <ResourceDetail
              key={selectedResource.id}
              resource={selectedResource}
              user={user}
              api={api}
              onBack={() => setSelectedResourceId(null)}
              onChanged={refreshAfterChange}
              notify={notify}
            />
          ) : (
            <ResourcesPage
              resources={resources}
              user={user}
              departmentName={departmentName}
              api={api}
              onOpen={openResource}
              onChanged={refreshAfterChange}
              notify={notify}
            />
          ))}

          {activeTab === 'bookings' && (
            <BookingsPage
              bookings={bookings}
              user={user}
              api={api}
              onChanged={refreshAfterChange}
              onRefresh={loadBookings}
              onOpenResource={openResource}
              notify={notify}
            />
          )}

          {activeTab === 'notifications' && <NotificationsPage notifications={notifications} />}

          {activeTab === 'audit' && isAdmin && (
            <AuditPage logs={auditLogs} api={api} demoMode={demoMode} onRefresh={loadAudit} notify={notify} />
          )}

          {activeTab === 'users' && isAdmin && <UsersPage user={user} api={api} notify={notify} />}

          {activeTab === 'account' && (
            <AccountPage
              user={user}
              departmentName={departmentName}
              api={api}
              themePref={themePref}
              onThemeChange={setThemePref}
              notify={notify}
            />
          )}
        </main>
      </div>

      <Toasts toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
    </div>
  );
}

export default App;
