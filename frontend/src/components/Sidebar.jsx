import { LayoutGrid, ListChecks, Bell, Shield, Users, UserCog, LogOut, X } from 'lucide-react';
import { ThemeToggle } from './ui';

export default function Sidebar({
  user, departmentName, activeTab, onNavigate, notificationCount, pendingCount,
  themePref, onThemeChange, onSignOut, open, onClose
}) {
  const isAdmin = user.role === 'Admin';

  const item = (tab, Icon, label, count) => (
    <button
      type="button"
      className={`nav-item${activeTab === tab ? ' active' : ''}`}
      aria-current={activeTab === tab ? 'page' : undefined}
      onClick={() => onNavigate(tab)}
    >
      <Icon />
      <span>{label}</span>
      {count > 0 && <span className="count">{count}</span>}
    </button>
  );

  return (
    <>
      <div className={`backdrop${open ? ' open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="brand-mark">E</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-name">EazyHall</div>
            <div className="brand-sub">{departmentName}</div>
          </div>
          <button type="button" className="btn btn-ghost icon-btn mobile-only" aria-label="Close menu" onClick={onClose}>
            <X />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Booking</div>
          {item('resources', LayoutGrid, 'Rooms & facilities')}
          {item('bookings', ListChecks, isAdmin ? 'All bookings' : 'Bookings', isAdmin ? pendingCount : 0)}
          {item('notifications', Bell, 'Notifications', notificationCount)}

          {isAdmin && (
            <>
              <div className="nav-section">Administration</div>
              {item('users', Users, 'Manage users')}
              {item('audit', Shield, 'Audit ledger')}
            </>
          )}

          <div className="nav-section">You</div>
          {item('account', UserCog, 'Account settings')}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{user.username.slice(0, 2)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="name">{user.username}</div>
              <div className="role">{user.role}</div>
            </div>
          </div>
          <div className="sidebar-actions">
            <ThemeToggle preference={themePref} onChange={onThemeChange} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={onSignOut}>
              <LogOut /> Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
