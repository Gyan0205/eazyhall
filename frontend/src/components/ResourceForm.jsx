import { useState } from 'react';
import { Alert } from './ui';
import { RESOURCE_TYPES } from '../lib/resourceTypes';

const toForm = (r) => ({
  name: r?.name || '',
  type: r?.type || 'Hall',
  location: r?.location || '',
  capacity: r?.capacity ?? 30,
  facilities: (r?.facilities || []).join(', '),
  description: r?.description || '',
});

// Create / edit form for a room or piece of equipment (Admin only)
export default function ResourceForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const message = await onSubmit({
      name: form.name.trim(),
      type: form.type,
      location: form.location.trim(),
      capacity: parseInt(form.capacity, 10),
      facilities: form.facilities.split(',').map(f => f.trim()).filter(Boolean),
      description: form.description.trim(),
    });
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      {error && <div className="span-2"><Alert>{error}</Alert></div>}
      <label className="field">
        <span>Name</span>
        <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Turing Seminar Hall" required />
      </label>
      <label className="field">
        <span>Type</span>
        <select value={form.type} onChange={set('type')}>
          {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Location</span>
        <input type="text" value={form.location} onChange={set('location')} placeholder="e.g. Block A, Room 102" required />
      </label>
      <label className="field">
        <span>Seats / capacity</span>
        <input type="number" min="1" value={form.capacity} onChange={set('capacity')} required />
      </label>
      <label className="field span-2">
        <span>Facilities <span className="hint">(separate with commas)</span></span>
        <input type="text" value={form.facilities} onChange={set('facilities')} placeholder="Projector & screen, Whiteboard, Air conditioning" />
      </label>
      <label className="field span-2">
        <span>Description <span className="hint">(optional)</span></span>
        <textarea value={form.description} onChange={set('description')} rows={3} placeholder="What is this space best used for?" />
      </label>
      <div className="span-2" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
