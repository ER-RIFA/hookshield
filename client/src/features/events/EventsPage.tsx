import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Zap, ChevronLeft, ChevronRight, X, Copy, Check, ArrowRight } from 'lucide-react';
import { LoadingState } from '../../components/LoadingState';
import { eventApi } from '../../services/api';
import type { Event } from '../../types';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';

// ── Create event modal ────────────────────────────────────────
function CreateEventModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [payload, setPayload] = useState('{\n  "amount": 100,\n  "currency": "USD"\n}');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState('');
  const [payloadError, setPayloadError] = useState('');

  const mutation = useMutation({
    mutationFn: eventApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['deliveries-recent'] });
      qc.invalidateQueries({ queryKey: ['delivery-stats'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPayloadError('');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setPayloadError('Invalid JSON');
      return;
    }

    mutation.mutate({
      type,
      payload: parsed,
      idempotencyKey: idempotencyKey || undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Create Event</h2>
          <button className="btn btn-icon btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Event Type *</label>
              <input
                className="form-input font-mono"
                type="text"
                placeholder="payment.completed"
                value={type}
                onChange={(e) => setType(e.target.value)}
                pattern="[a-z0-9_.]+"
                required
              />
              <p className="form-helper">Lowercase, dots and underscores only (e.g. <code>user.signup</code>)</p>
            </div>

            <div className="form-group">
              <label className="form-label">Payload (JSON) *</label>
              <textarea
                className="form-textarea font-mono"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={8}
                spellCheck={false}
              />
              {payloadError && <p className="form-error">{payloadError}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Idempotency Key <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="form-input font-mono"
                type="text"
                placeholder="unique-key-12345"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                maxLength={256}
              />
              <p className="form-helper">Sending the same key twice returns the original event without creating duplicates</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-icon btn-secondary"
      style={{ width: 24, height: 24 }}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copy"
    >
      {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────
export function EventsPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', page],
    queryFn: () => eventApi.list(page),
    refetchInterval: 10000,
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">Create and inspect webhook events</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create Event
        </button>
      </div>

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} style={{ color: '#6366f1' }} />
            Event History
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{data?.total ?? 0} events</span>
        </div>

        <div className="table-wrapper">
          {error ? (
            <div className="alert alert-error" style={{ margin: 16 }}>Failed to load events</div>
          ) : isLoading ? (
            <LoadingState rows={5} cols={4} />
          ) : data?.data?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Zap size={28} /></div>
              <p className="empty-title">No events yet</p>
              <p className="empty-text">Create your first event to trigger webhook delivery</p>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Create Event
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Type</th>
                  <th>Payload Preview</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((ev: Event) => (
                  <Fragment key={ev._id}>
                    <tr
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === ev._id ? null : ev._id)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="td-mono">{ev.eventId.substring(0, 12)}…</span>
                          <CopyButton text={ev.eventId} />
                        </div>
                      </td>
                      <td>
                        <span className="tag">{ev.type}</span>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {JSON.stringify(ev.payload).substring(0, 60)}…
                        </code>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                    {expandedId === ev._id && (
                      <tr key={`${ev._id}-expanded`} style={{ background: 'rgba(99,102,241,0.04)' }}>
                        <td colSpan={4} style={{ padding: '16px 24px' }}>
                          <div style={{ marginBottom: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Full event ID: <code className="font-mono">{ev.eventId}</code>
                            &nbsp; • &nbsp;
                            {format(new Date(ev.createdAt), 'MMM d, yyyy HH:mm:ss')}
                          </div>
                          <div className="code-block">{JSON.stringify(ev.payload, null, 2)}</div>
                          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                            <Link to="/deliveries" className="btn btn-secondary btn-sm">
                              <span>Trace in Delivery Queue</span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.pages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Page {page} of {data.pages}</span>
            <div className="pagination-controls">
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
