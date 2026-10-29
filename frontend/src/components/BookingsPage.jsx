import { useMemo, useState } from 'react';
import { Check, X, Trash2, RefreshCw, CalendarX } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { formatDate, formatTime } from '../lib/time';
import { PageHeader, StatusBadge, EmptyState } from './ui';

const STATUSES = ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'];

export default function BookingsPage({ bookings, user, api, onChanged, onRefresh, onOpenResource, notify }) {
  const isAdmin = user.role === 'Admin';
  const [status, setStatus] = useState(isAdmin && bookings.some(b => b.status === 'Pending') ? 'Pending' : 'All');
  const [mineOnly, setMineOnly] = useState(!isAdmin);
  const [busyId, setBusyId] = useState(null);

  const rows = useMemo(() => bookings
    .filter(b => (status === 'All' || b.status === status) && (!mineOnly || b.user_id === user.id))
    .map(b => ({ ...b, start: new Date(b.start_time), end: new Date(b.end_time) }))
    .sort((a, b) => b.start - a.start), [bookings, status, mineOnly, user.id]);

  const counts = useMemo(() => {
    const c = {};
    bookings.filter(b => !mineOnly || b.user_id === user.id).forEach(b => { c[b.status] = (c[b.status] || 0) + 1; });
    return c;
  }, [bookings, mineOnly, user.id]);

  const act = async (booking, action) => {
    if (action === 'cancel' && !window.confirm(`Cancel the booking for ${booking.resource_name} on ${formatDate(booking.start)}?`)) return;
    setBusyId(booking.id);
    const res = await api(`/bookings/${booking.id}/${action}`, { method: 'POST' });
    setBusyId(null);
    if (res.ok) {
      notify('success', res.data?.message || 'Done.');
    } else {
      notify('error', errorMessage(res.data, `Could not ${action} the booking`));
    }
    onChanged();
  };

  return (
    <>
      <PageHeader
        title={isAdmin ? 'All bookings' : 'Bookings'}
        subtitle={isAdmin ? 'Review requests and manage every booking in your department.' : 'Track your requests, or browse everything booked in your department.'}
      >
        <button type="button" className="btn btn-secondary" onClick={onRefresh}><RefreshCw /> Refresh</button>
      </PageHeader>

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="filter-pills" role="group" aria-label="Filter by status">
          {STATUSES.map(s => (
            <button key={s} type="button" className={`pill${status === s ? ' active' : ''}`} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s}{s !== 'All' && counts[s] ? ` · ${counts[s]}` : ''}
            </button>
          ))}
        </div>
        <div className="segmented" style={{ width: 'auto' }} role="group" aria-label="Whose bookings">
          <button type="button" className={mineOnly ? 'active' : ''} onClick={() => setMineOnly(true)} style={{ padding: '0 12px' }}>Mine</button>
          <button type="button" className={!mineOnly ? 'active' : ''} onClick={() => setMineOnly(false)} style={{ padding: '0 12px' }}>Everyone</button>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState icon={CalendarX} title="No bookings here">
            Open a room from "Rooms & facilities" to make a booking.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>When</th>
                  <th>Purpose</th>
                  <th>Booked by</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(b => {
                  const canCancel = (b.status === 'Pending' || b.status === 'Approved') && (isAdmin || b.user_id === user.id);
                  const canReview = isAdmin && b.status === 'Pending';
                  return (
                    <tr key={b.id}>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm cell-title" style={{ padding: 0, height: 'auto', color: 'var(--text)' }} onClick={() => onOpenResource(b.resource_id)}>
                          {b.resource_name}
                        </button>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div>{formatDate(b.start)}</div>
                        <div className="cell-sub">{formatTime(b.start)} – {formatTime(b.end)}</div>
                      </td>
                      <td style={{ maxWidth: 260 }}>{b.purpose}</td>
                      <td>{b.username}{b.user_id === user.id && <span className="cell-sub"> (you)</span>}</td>
                      <td><StatusBadge status={b.status} /></td>
                      <td>
                        <div className="actions">
                          {busyId === b.id ? (
                            <RefreshCw className="spin" style={{ width: 16, height: 16, color: 'var(--text-3)' }} />
                          ) : (
                            <>
                              {canReview && (
                                <>
                                  <button type="button" className="btn btn-success btn-sm" onClick={() => act(b, 'approve')}><Check /> Approve</button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => act(b, 'reject')}><X /> Reject</button>
                                </>
                              )}
                              {canCancel && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(b, 'cancel')}><Trash2 /> Cancel</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
