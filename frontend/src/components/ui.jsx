import {
  Sun, Moon, Monitor, CircleAlert, CircleCheck, Info, X,
  FlaskConical, Presentation, Dumbbell, Wrench, Building2
} from 'lucide-react';

export function ThemeToggle({ preference, onChange }) {
  const options = [
    { value: 'light', icon: Sun, label: 'Light theme' },
    { value: 'dark', icon: Moon, label: 'Dark theme' },
    { value: 'system', icon: Monitor, label: 'Match system theme' },
  ];
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          className={preference === value ? 'active' : ''}
          onClick={() => onChange(value)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  const Icon = type === 'success' ? CircleCheck : type === 'info' ? Info : CircleAlert;
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon />
      <span>{children}</span>
    </div>
  );
}

export function StatusBadge({ status }) {
  const cls = {
    Approved: 'badge-approved',
    Pending: 'badge-pending',
    Rejected: 'badge-rejected',
    Cancelled: 'badge-cancelled',
  }[status] || '';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function EmptyState({ icon: Icon = Info, title, children }) {
  return (
    <div className="empty">
      <Icon />
      <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>{title}</div>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

const TYPE_ICONS = { Lab: FlaskConical, Hall: Presentation, Court: Dumbbell, Equipment: Wrench };

export function TypeIcon({ type, large = false }) {
  const Icon = TYPE_ICONS[type] || Building2;
  return (
    <div className={`type-icon${large ? ' lg' : ''}`}>
      <Icon />
    </div>
  );
}

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t => {
        const Icon = t.type === 'success' ? CircleCheck : t.type === 'error' ? CircleAlert : Info;
        return (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon />
            <div style={{ flex: 1 }}>{t.text}</div>
            <button type="button" className="btn btn-ghost btn-sm icon-btn" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
              <X />
            </button>
          </div>
        );
      })}
    </div>
  );
}
