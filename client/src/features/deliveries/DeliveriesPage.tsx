import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { deliveryApi } from '../../services/api';
import type { Delivery, DeliveryAttempt } from '../../types';
import { formatDistanceToNow, format } from 'date-fns';

function CopySnippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-icon btn-secondary"
      style={{ width: 24, height: 24 }}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      title="Copy"
    >
      {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
    </button>
  );
}

// ── Delivery detail modal ─────────────────────────────────────
export function DeliveryDetailModal({ deliveryId, onClose }: { deliveryId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'payload' | 'attempts'>('overview');

  const { data, isLoading } = useQuery({
    queryKey: ['delivery', deliveryId],
    queryFn: () => deliveryApi.get(deliveryId),
  });

  const replayMutation = useMutation({
    mutationFn: () => deliveryApi.replay(deliveryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['delivery-stats'] });
      qc.invalidateQueries({ queryKey: ['delivery', deliveryId] });
      onClose();
    },
  });

  const d = data?.data?.delivery as Delivery | undefined;
  const attempts = (data?.data?.attempts as DeliveryAttempt[]) ?? [];
  const eventPayload = (d?.eventId as any)?.payload;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 740 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={20} style={{ color: '#6366f1' }} />
            <h2 className="modal-title">Delivery Job Details</h2>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
          <button
            className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'payload' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => setActiveTab('payload')}
          >
            Payload & Headers
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'attempts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => setActiveTab('attempts')}
          >
            Attempt History ({attempts.length})
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <div style={{ padding: 30, textAlign: 'center' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading delivery details...</p>
            </div>
          ) : d ? (
            <>
              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>STATUS</div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>ATTEMPTS</div>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{d.attempts} / 5</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>EVENT TYPE</div>
                    <span className="tag">{(d.eventId as any)?.type ?? '—'}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>DELIVERY ID</div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{d._id}</span>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>DESTINATION ENDPOINT</div>
                    <div className="url-cell" style={{ fontSize: '0.88rem' }} title={(d.endpointId as any)?.url}>
                      {(d.endpointId as any)?.url ?? '—'}
                    </div>
                  </div>
                  {d.lastStatusCode && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>LAST STATUS CODE</div>
                      <span style={{
                        fontFamily: 'JetBrains Mono',
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: d.lastStatusCode >= 200 && d.lastStatusCode < 300 ? '#10b981' : '#ef4444',
                      }}>HTTP {d.lastStatusCode}</span>
                    </div>
                  )}
                  {d.lastDurationMs && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>ROUND TRIP LATENCY</div>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '1rem', color: '#06b6d4' }}>{d.lastDurationMs}ms</span>
                    </div>
                  )}
                  {d.lastError && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>FAILURE DIAGNOSIS</div>
                      <div className="alert alert-error" style={{ margin: 0 }}>{d.lastError}</div>
                    </div>
                  )}
                  {d.status === 'retrying' && (
                    <div style={{ gridColumn: '1/-1', background: 'rgba(245, 158, 11, 0.1)', padding: 12, borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>NEXT BACKOFF ATTEMPT</div>
                      <span style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600 }}>
                        <Clock size={14} style={{ display: 'inline', marginRight: 6 }} />
                        {format(new Date(d.nextAttemptAt), 'MMM d, yyyy HH:mm:ss')} ({formatDistanceToNow(new Date(d.nextAttemptAt), { addSuffix: true })})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payload' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>OUTGOING REQUEST HEADERS</div>
                  </div>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.45)',
                    padding: 12,
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#818cf8',
                    border: '1px solid var(--border)',
                    marginBottom: 18,
                  }}>
{`Content-Type: application/json
X-HookShield-Event: ${(d.eventId as any)?.type || 'unknown'}
X-HookShield-Delivery: ${d._id}
X-HookShield-Signature: t=${Math.floor(new Date(d.createdAt).getTime() / 1000)},v1=<hmac_sha256_hash>`}
                  </pre>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PAYLOAD (JSON)</div>
                    {eventPayload && <CopySnippet text={JSON.stringify(eventPayload, null, 2)} />}
                  </div>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.45)',
                    padding: 12,
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#34d399',
                    border: '1px solid var(--border)',
                    overflowX: 'auto',
                    maxHeight: 260,
                  }}>
                    {eventPayload ? JSON.stringify(eventPayload, null, 2) : '// No payload data'}
                  </pre>
                </div>
              )}

              {activeTab === 'attempts' && (
                <div>
                  {attempts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      No attempts recorded yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {attempts.map((a) => (
                        <div key={a._id} style={{
                          padding: '12px 16px',
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${a.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: a.responseBody ? 8 : 0 }}>
                            {a.success
                              ? <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />
                              : <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                            }
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 70 }}>
                              Attempt #{a.attemptNo}
                            </span>
                            {a.statusCode ? (
                              <span style={{
                                fontFamily: 'JetBrains Mono',
                                fontSize: '0.82rem',
                                color: a.success ? '#10b981' : '#ef4444',
                                fontWeight: 700,
                              }}>
                                HTTP {a.statusCode}
                              </span>
                            ) : (
                              <span style={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 600 }}>
                                Network Failure
                              </span>
                            )}
                            {a.errorCategory && (
                              <span style={{ color: '#fbbf24', fontSize: '0.78rem' }}>
                                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
                                {a.errorCategory}
                              </span>
                            )}
                            <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {a.durationMs}ms
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {formatDistanceToNow(new Date(a.attemptedAt), { addSuffix: true })}
                            </span>
                          </div>

                          {a.responseBody && (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>RECEIVER RESPONSE</div>
                              <pre style={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                padding: '6px 8px',
                                borderRadius: 4,
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                overflowX: 'auto',
                                maxHeight: 90,
                                margin: 0,
                              }}>
                                {a.responseBody}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="alert alert-error">Failed to load delivery details</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {d && (d.status === 'failed' || d.status === 'success') && (
            <button
              className="btn btn-primary"
              onClick={() => replayMutation.mutate()}
              disabled={replayMutation.isPending}
            >
              <RotateCcw size={14} />
              {replayMutation.isPending ? 'Replaying…' : 'Replay Delivery'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
const STATUS_FILTERS = ['all', 'pending', 'delivering', 'success', 'retrying', 'failed'];

export function DeliveriesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['deliveries', page, statusFilter],
    queryFn: () => deliveryApi.list({
      page,
      limit: 20,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    refetchInterval: 4000,
  });

  const replayAllMutation = useMutation({
    mutationFn: deliveryApi.replayAllFailed,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['delivery-stats'] });
      alert(`Successfully queued ${res.replayedCount} failed deliveries for immediate retry!`);
    },
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">Track webhook delivery attempts, exponential backoffs, and audit trails</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (window.confirm('Replay all failed deliveries immediately?')) {
                replayAllMutation.mutate();
              }
            }}
            disabled={replayAllMutation.isPending}
            title="Reset and replay all failed delivery jobs"
          >
            <RotateCcw size={15} style={{ color: '#f59e0b' }} />
            <span>{replayAllMutation.isPending ? 'Replaying...' : 'Replay All Failed'}</span>
          </button>
        </div>
      </div>

      {selectedId && (
        <DeliveryDetailModal deliveryId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{ textTransform: 'capitalize' }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <List size={16} style={{ color: '#6366f1' }} />
            Delivery Log
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {data?.total ?? 0} deliveries · Auto-refreshing
          </span>
        </div>

        <div className="table-wrapper">
          {error ? (
            <div className="alert alert-error" style={{ margin: 16 }}>Failed to load deliveries</div>
          ) : isLoading ? (
            <LoadingState rows={8} cols={6} />
          ) : data?.data?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><List size={28} /></div>
              <p className="empty-title">No deliveries found</p>
              <p className="empty-text">
                {statusFilter !== 'all'
                  ? `No ${statusFilter} deliveries found`
                  : 'Dispatch an event to see delivery logs appear here'}
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Event Type</th>
                  <th>Endpoint</th>
                  <th>Attempts</th>
                  <th>Last Status</th>
                  <th>Duration</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((d: Delivery) => (
                  <tr key={d._id}>
                    <td><StatusBadge status={d.status} /></td>
                    <td>
                      <span className="tag" style={{ fontSize: '0.72rem' }}>
                        {(d.eventId as any)?.type ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span className="url-cell" style={{ maxWidth: 220 }} title={(d.endpointId as any)?.url}>
                        {(d.endpointId as any)?.url ?? '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        background: d.attempts >= 3 ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)',
                        color: d.attempts >= 3 ? '#f87171' : 'inherit',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}>
                        {d.attempts} / 5
                      </span>
                    </td>
                    <td>
                      {d.lastStatusCode ? (
                        <span style={{
                          fontFamily: 'JetBrains Mono',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: d.lastStatusCode >= 200 && d.lastStatusCode < 300 ? '#10b981' : '#ef4444',
                        }}>
                          HTTP {d.lastStatusCode}
                        </span>
                      ) : d.lastError ? (
                        <span style={{ fontSize: '0.78rem', color: '#f87171' }}>
                          {d.lastError}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="td-mono">
                      {d.lastDurationMs ? `${d.lastDurationMs}ms` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setSelectedId(d._id)}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.pages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Page {page} of {data.pages} ({data.total} total)
            </span>
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
