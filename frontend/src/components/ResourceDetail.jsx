import { useRef, useState } from 'react';
import { ArrowLeft, MapPin, Armchair, Tag, Pencil, Check, CalendarCheck } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { TIME_SLOTS, toDateInput, localDateTime, formatSlot } from '../lib/time';
import { TypeIcon, Alert } from './ui';
import { typeLabel } from '../lib/resourceTypes';
import WeekTimetable from './WeekTimetable';
import ResourceForm from './ResourceForm';

const plusOneHour = (time) => {
  const idx = TIME_SLOTS.indexOf(time);
  return TIME_SLOTS[Math.min(idx + 2, TIME_SLOTS.length - 1)];
};

export default function ResourceDetail({ resource, user, api, onBack, onChanged, notify }) {
  const isAdmin = user.role === 'Admin';
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ date: toDateInput(new Date()), start: '10:00', end: '11:00', purpose: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  const handleSlotSelect = (date, time) => {
    setForm(f => ({ ...f, date, start: time, end: plusOneHour(time) }));
    setError('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleBook = async (e) => {
    e.preventDefault();
    setError('');
    const start = localDateTime(form.date, form.start);
    const end = localDateTime(form.date, form.end);
    if (end <= start) {
      setError('End time must be after the start time.');
      return;
    }
    if (start < new Date()) {
      setError("That time has already passed. Pick a later slot.");
      return;
    }
    setSubmitting(true);
    const res = await api('/bookings', {
      method: 'POST',
      body: { resource_id: resource.id, start_time: start.toISOString(), end_time: end.toISOString(), purpose: form.purpose.trim() },
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(errorMessage(res.data, 'Booking failed'));
      return;
    }
    notify('success', res.data.status === 'Approved'
      ? `${resource.name} booked for ${formatSlot(form.start)}–${formatSlot(form.end)}.`
      : `Request sent. Your booking is pending admin approval.`);
    setForm(f => ({ ...f, purpose: '' }));
    setRefreshKey(k => k + 1);
    onChanged();
  };

  const handleSave = async (body) => {
    const res = await api(`/resources/${resource.id}`, { method: 'PUT', body });
    if (!res.ok) return errorMessage(res.data, 'Failed to save changes');
    setEditing(false);
    notify('success', 'Resource details updated.');
    onChanged();
    return null;
  };

  return (
    <>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }} onClick={onBack}>
          <ArrowLeft /> All rooms & facilities
        </button>
      </div>

      <div className="card card-pad">
        {editing ? (
          <>
            <h3 style={{ marginBottom: 16 }}>Edit {resource.name}</h3>
            <ResourceForm initial={resource} submitLabel="Save changes" onSubmit={handleSave} onCancel={() => setEditing(false)} />
          </>
        ) : (
          <div className="stack" style={{ gap: 18 }}>
            <div className="detail-hero">
              <TypeIcon type={resource.type} large />
              <div className="info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1>{resource.name}</h1>
                  <span className="badge badge-accent no-dot">{typeLabel(resource.type)}</span>
                </div>
                {resource.description && <p className="muted">{resource.description}</p>}
              </div>
              {isAdmin && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                  <Pencil /> Edit details
                </button>
              )}
            </div>

            <div className="stat-row">
              <div className="stat">
                <div className="label"><Armchair /> Seats</div>
                <div className="value">{resource.capacity}</div>
              </div>
              <div className="stat">
                <div className="label"><MapPin /> Location</div>
                <div className="value" style={{ fontSize: '0.95rem' }}>{resource.location}</div>
              </div>
              <div className="stat">
                <div className="label"><Tag /> Facilities</div>
                <div className="value">{resource.facilities.length}</div>
              </div>
            </div>

            <div>
              <div className="label" style={{ marginBottom: 8 }}>Facilities available</div>
              {resource.facilities.length ? (
                <div className="chips">
                  {resource.facilities.map(f => <span key={f} className="chip"><Check /> {f}</span>)}
                </div>
              ) : (
                <p className="subtle small">No facilities listed yet.{isAdmin ? ' Use "Edit details" to add them.' : ''}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="detail-layout">
        <div className="stack" style={{ gap: 10 }}>
          <h2>Weekly timetable</h2>
          <WeekTimetable resourceId={resource.id} api={api} refreshKey={refreshKey} onSlotSelect={handleSlotSelect} />
        </div>

        <div className="card sticky-panel" ref={formRef}>
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarCheck style={{ width: 18, height: 18, color: 'var(--accent)' }} /> Book this {resource.type === 'Equipment' ? 'item' : 'space'}</h3>
          </div>
          <form className="card-body stack" onSubmit={handleBook}>
            <Alert>{error}</Alert>
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.date} min={toDateInput(new Date())} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </label>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                <span>From</span>
                <select value={form.start} onChange={e => setForm({ ...form, start: e.target.value })}>
                  {TIME_SLOTS.slice(0, -1).map(t => <option key={t} value={t}>{formatSlot(t)}</option>)}
                </select>
              </label>
              <label className="field">
                <span>To</span>
                <select value={form.end} onChange={e => setForm({ ...form, end: e.target.value })}>
                  {TIME_SLOTS.slice(1).map(t => <option key={t} value={t}>{formatSlot(t)}</option>)}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Purpose</span>
              <textarea value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} rows={3} placeholder="e.g. Department meeting, guest lecture…" maxLength={500} required />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Booking…' : user.role === 'Student' ? 'Request booking' : 'Confirm booking'}
            </button>
            <p className="subtle small">
              {user.role === 'Student'
                ? 'Student requests are reviewed by a department admin.'
                : 'Faculty and admin bookings are approved instantly.'}
              {' '}Tip: click a free slot in the timetable to fill in the time.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
