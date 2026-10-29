// Booking hours shown in the timetable and offered in the time pickers
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;

// "08:00", "08:30", ... "20:00" (24h values, displayed in the user's locale format)
export const TIME_SLOTS = (() => {
  const slots = [];
  for (let m = DAY_START_HOUR * 60; m <= DAY_END_HOUR * 60; m += 30) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
})();

const pad = (n) => String(n).padStart(2, '0');

// YYYY-MM-DD in the user's local timezone
export const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Local Date for a "YYYY-MM-DD" + "HH:MM" pair
export const localDateTime = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}:00`);

export const addDays = (d, n) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

// Monday 00:00 (local) of the week containing d
export const startOfWeek = (d) => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (copy.getDay() + 6) % 7;
  return addDays(copy, -offset);
};

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

export const formatSlot = (timeStr) =>
  new Date(`2000-01-01T${timeStr}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const formatDate = (d) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

export const formatDateTime = (d) =>
  d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const formatWeekRange = (weekStart) => {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startText = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const endText = sameMonth ? end.getDate() : end.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${startText} – ${endText}, ${end.getFullYear()}`;
};

export const formatRelative = (d) => {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return formatDateTime(d);
};
