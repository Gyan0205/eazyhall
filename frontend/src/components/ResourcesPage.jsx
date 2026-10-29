import { useMemo, useState } from 'react';
import { Plus, Search, MapPin, Armchair, ChevronRight, Building2 } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { PageHeader, TypeIcon, EmptyState } from './ui';
import { RESOURCE_TYPES, typeLabel } from '../lib/resourceTypes';
import ResourceForm from './ResourceForm';

export default function ResourcesPage({ resources, user, departmentName, api, onOpen, onChanged, notify }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [adding, setAdding] = useState(false);
  const isAdmin = user.role === 'Admin';

  const presentTypes = RESOURCE_TYPES.filter(t => resources.some(r => r.type === t.value));
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter(r =>
      (typeFilter === 'All' || r.type === typeFilter) &&
      (!q || [r.name, r.location, ...r.facilities].some(v => v.toLowerCase().includes(q)))
    );
  }, [resources, query, typeFilter]);

  const handleCreate = async (body) => {
    const res = await api('/resources', { method: 'POST', body });
    if (!res.ok) return errorMessage(res.data, 'Failed to create resource');
    setAdding(false);
    notify('success', `${res.data.name} added.`);
    onChanged();
    return null;
  };

  return (
    <>
      <PageHeader title="Rooms & facilities" subtitle={`Pick a space to see its seats, facilities and weekly timetable. ${departmentName}.`}>
        {isAdmin && !adding && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus /> Add resource
          </button>
        )}
      </PageHeader>

      {adding && (
        <div className="card">
          <div className="card-header"><h3>New resource</h3></div>
          <div className="card-body">
            <ResourceForm submitLabel="Add resource" onSubmit={handleCreate} onCancel={() => setAdding(false)} />
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="input-icon search">
          <Search />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, location or facility" aria-label="Search resources" />
        </div>
        {presentTypes.length > 1 && (
          <div className="filter-pills" role="group" aria-label="Filter by type">
            {[{ value: 'All', label: 'All' }, ...presentTypes].map(t => (
              <button key={t.value} type="button" className={`pill${typeFilter === t.value ? ' active' : ''}`} aria-pressed={typeFilter === t.value} onClick={() => setTypeFilter(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState icon={Building2} title={resources.length ? 'No matches' : 'No resources yet'}>
            {resources.length ? 'Try a different search or filter.' : isAdmin ? 'Add your first room with "Add resource".' : 'Your department admin hasn\'t added any rooms yet.'}
          </EmptyState>
        </div>
      ) : (
        <div className="resource-grid">
          {visible.map(r => (
            <button key={r.id} type="button" className="resource-card" onClick={() => onOpen(r.id)}>
              <div className="top">
                <TypeIcon type={r.type} />
                <div style={{ minWidth: 0 }}>
                  <h3>{r.name}</h3>
                  <span className="badge badge-accent no-dot" style={{ marginTop: 4 }}>{typeLabel(r.type)}</span>
                </div>
              </div>
              <div className="meta">
                <span><MapPin /> {r.location}</span>
                <span><Armchair /> {r.capacity} seats</span>
              </div>
              {r.facilities.length > 0 && (
                <div className="chips">
                  {r.facilities.slice(0, 3).map(f => <span key={f} className="chip">{f}</span>)}
                  {r.facilities.length > 3 && <span className="chip">+{r.facilities.length - 3} more</span>}
                </div>
              )}
              <div className="footer">
                <span>View timetable &amp; book</span>
                <ChevronRight />
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
