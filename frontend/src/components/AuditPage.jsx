import { useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, TriangleAlert, Wrench, ScrollText } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { formatDateTime } from '../lib/time';
import { PageHeader, EmptyState } from './ui';

const prettyAction = (action) => action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

const prettyDetails = (details) => {
  try {
    return Object.entries(JSON.parse(details)).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ');
  } catch {
    return details;
  }
};

export default function AuditPage({ logs, api, demoMode, onRefresh, notify }) {
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    const res = await api('/audit/verify', { method: 'POST' });
    setVerifying(false);
    if (res.ok) setResult(res.data);
    else notify('error', errorMessage(res.data, 'Verification failed'));
  };

  const demoAction = async (path) => {
    const res = await api(path, { method: 'POST' });
    notify(res.ok ? 'info' : 'error', res.ok ? res.data.message : errorMessage(res.data, 'Action failed'));
    onRefresh();
    if (res.ok) await verify();
  };

  return (
    <>
      <PageHeader title="Audit ledger" subtitle="Every action in your department is hash-chained to the one before it. Editing any record directly in the database breaks the chain.">
        <button type="button" className="btn btn-secondary" onClick={onRefresh}><RefreshCw /> Refresh</button>
        <button type="button" className="btn btn-primary" onClick={verify} disabled={verifying}>
          {verifying ? <RefreshCw className="spin" /> : <ShieldCheck />} Verify integrity
        </button>
      </PageHeader>

      {result && (
        <div className={`alert ${result.valid ? 'alert-success' : 'alert-error'}`} style={{ padding: 16 }}>
          {result.valid ? <ShieldCheck /> : <ShieldAlert />}
          <div>
            <div style={{ fontWeight: 650 }}>{result.valid ? 'Ledger verified' : 'Integrity check failed'}</div>
            <div>{result.message || result.details}</div>
          </div>
        </div>
      )}

      {demoMode && (
        <div className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Demo tools</div>
            <div className="muted small">Simulate a tampered record, then re-seal the chain. Only available in demo mode.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => demoAction('/audit/tamper')}><TriangleAlert /> Simulate tampering</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => demoAction('/audit/repair')}><Wrench /> Re-seal chain</button>
          </div>
        </div>
      )}

      <div className="card">
        {logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit records yet">Bookings, approvals and admin changes will be recorded here.</EmptyState>
        ) : (
          <div className="ledger">
            {logs.map(log => (
              <div key={log.id} className="block">
                <div className="block-num">#{log.id}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="head">
                    <span className="action">{prettyAction(log.action)}</span>
                    <span className="subtle small">{formatDateTime(new Date(log.timestamp))} · {log.username}</span>
                  </div>
                  <div className="payload">{prettyDetails(log.details)}</div>
                  <div className="hashes">
                    <div><b>Prev</b> {log.prev_hash}</div>
                    <div><b>Hash</b> {log.hash}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
