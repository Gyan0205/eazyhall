import { Bell, Inbox } from 'lucide-react';
import { formatRelative } from '../lib/time';
import { PageHeader, EmptyState } from './ui';

export default function NotificationsPage({ notifications }) {
  return (
    <>
      <PageHeader title="Notifications" subtitle="Updates about your bookings and requests." />
      <div className="card">
        {notifications.length === 0 ? (
          <EmptyState icon={Inbox} title="You're all caught up">
            Booking confirmations, approvals and cancellations will appear here.
          </EmptyState>
        ) : (
          <div className="notif-list">
            {notifications.map(n => (
              <div key={n.id} className="notif">
                <div className="notif-icon"><Bell /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>{n.message}</div>
                  <div className="subtle small" style={{ marginTop: 2 }}>{formatRelative(new Date(n.created_at))}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
