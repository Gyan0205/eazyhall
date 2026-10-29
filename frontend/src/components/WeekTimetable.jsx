import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { errorMessage } from '../lib/api';
import {
  DAY_START_HOUR, DAY_END_HOUR, addDays, startOfWeek, isSameDay, minutesOfDay,
  toDateInput, formatTime, formatWeekRange, formatDate
} from '../lib/time';
import { Alert, StatusBadge } from './ui';

const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });

/**
 * Week view (Mon–Sun) of one resource's Pending and Approved bookings.
 * Clicking a free slot calls onSlotSelect(date "YYYY-MM-DD", time "HH:MM").
 */
export default function WeekTimetable({ resourceId, api, refreshKey, onSlotSelect }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // Keep the "now" line moving
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        start: weekStart.toISOString(),
        end: addDays(weekStart, 7).toISOString(),
      });
      const res = await api(`/resources/${resourceId}/schedule?${params}`);
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setBookings(res.data.map(b => ({ ...b, start: new Date(b.start_time), end: new Date(b.end_time) })));
      } else {
        setError(errorMessage(res.data, "Couldn't load the timetable"));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [api, resourceId, weekStart, refreshKey]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selected = bookings.find(b => b.id === selectedId);

  // Clip each booking to the visible hours of each day it touches
  const eventsForDay = (day) => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), DAY_START_HOUR);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), DAY_END_HOUR);
    return bookings.flatMap(b => {
      const s = b.start > dayStart ? b.start : dayStart;
      const e = b.end < dayEnd ? b.end : dayEnd;
      if (s >= e) return [];
      const top = ((minutesOfDay(s) - DAY_START_HOUR * 60) / TOTAL_MINUTES) * 100;
      const height = ((e - s) / 60000 / TOTAL_MINUTES) * 100;
      return [{ booking: b, top, height }];
    });
  };

  const handleDayClick = (day, e) => {
    if (!onSlotSelect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const minutes = DAY_START_HOUR * 60 + Math.floor((ratio * TOTAL_MINUTES) / 30) * 30;
    const slotStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
    if (slotStart < now || minutes >= DAY_END_HOUR * 60) return;
    onSlotSelect(toDateInput(day), `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  };

  const nowTop = ((minutesOfDay(now) - DAY_START_HOUR * 60) / TOTAL_MINUTES) * 100;
  const showNow = nowTop >= 0 && nowTop <= 100;

  return (
    <div className="card">
      <div className="tt-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tt-range">{formatWeekRange(weekStart)}</span>
          {loading && <RefreshCw className="spin" style={{ width: 15, height: 15, color: 'var(--text-3)' }} />}
        </div>
        <div className="tt-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</button>
          <button type="button" className="btn btn-secondary btn-sm icon-btn" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft /></button>
          <button type="button" className="btn btn-secondary btn-sm icon-btn" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight /></button>
        </div>
      </div>

      {error && <div style={{ padding: 16 }}><Alert>{error}</Alert></div>}

      <div className="tt-scroll">
        <div className="tt" aria-label={`Timetable for the week of ${formatWeekRange(weekStart)}`}>
          <div className="tt-corner" />
          {days.map(day => (
            <div key={day.toISOString()} className={`tt-head${isSameDay(day, today) ? ' today' : ''}`}>
              <div className="dow">{day.toLocaleDateString([], { weekday: 'short' })}</div>
              <div className="dom">{day.getDate()}</div>
            </div>
          ))}

          <div className="tt-times" aria-hidden="true">
            {HOURS.map(h => <div key={h} className="tt-time">{hourLabel(h)}</div>)}
          </div>

          {days.map(day => {
            const isPast = day < today;
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={`tt-day${isPast ? ' past' : ''}${isToday ? ' today' : ''}`}
                style={{ height: `calc(var(--hour) * ${HOURS.length})` }}
                onClick={e => handleDayClick(day, e)}
                title={isPast ? undefined : 'Click a free slot to book it'}
              >
                {eventsForDay(day).map(({ booking, top, height }) => (
                  <button
                    key={booking.id}
                    type="button"
                    className={`tt-event${booking.status === 'Pending' ? ' pending' : ''}${booking.id === selectedId ? ' selected' : ''}`}
                    style={{ top: `${top}%`, height: `calc(${height}% - 2px)` }}
                    onClick={e => { e.stopPropagation(); setSelectedId(booking.id === selectedId ? null : booking.id); }}
                    title={`${booking.purpose} · ${formatTime(booking.start)}–${formatTime(booking.end)} · ${booking.username}`}
                  >
                    <div className="p">{booking.purpose}</div>
                    <div className="t">{formatTime(booking.start)} – {formatTime(booking.end)}</div>
                    <div className="u">{booking.username}</div>
                  </button>
                ))}
                {isToday && showNow && <div className="tt-now" style={{ top: `${nowTop}%` }} />}
              </div>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="booking-detail">
          <div><div className="label">Purpose</div><div className="val">{selected.purpose}</div></div>
          <div><div className="label">When</div><div className="val">{formatDate(selected.start)}, {formatTime(selected.start)}–{formatTime(selected.end)}</div></div>
          <div><div className="label">Booked by</div><div className="val">{selected.username} <span className="subtle">· {selected.user_role}</span></div></div>
          <div><div className="label">Status</div><div className="val"><StatusBadge status={selected.status} /></div></div>
        </div>
      ) : (
        <div className="tt-legend">
          <span><i style={{ background: 'var(--accent)' }} /> Approved</span>
          <span><i style={{ background: 'var(--warning)' }} /> Pending approval</span>
          <span>{bookings.length === 0 && !loading ? 'No bookings this week. ' : ''}Click a booking for details, or a free slot to book it.</span>
        </div>
      )}
    </div>
  );
}
