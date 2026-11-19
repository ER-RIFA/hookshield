import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Globe,
  ChevronLeft,
  ChevronRight,
  X,
  KeyRound,
  Trash2,
  Send,
  Copy,
  Check,
  AlertTriangle,
  RotateCw,
  Radio,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { endpointApi } from '../../services/api';
import type { Endpoint, EndpointTestResult } from '../../types';
import { formatDistanceToNow } from 'date-fns';

// ── Tag input ────────────────────────────────────────────────
function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput('');
  };

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="tags-container" onClick={() => document.getElementById('tag-input')?.focus()}>
      {value.map((tag) => (
        <span key={tag} className="tag">
          {tag}
          <span className="tag-remove" onClick={() => removeTag(tag)}>×</span>
        </span>
      ))}
      <input
        id="tag-input"
        className="tag-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && input) {
            e.preventDefault();
            addTag(input);
          }
          if (e.key === 'Backspace' && !input && value.length > 0) {
            removeTag(value[value.length - 1]);
          }
        }}
        onBlur={() => { if (input) addTag(input); }}
        placeholder={value.length === 0 ? 'payment.completed, order.created…' : ''}
      />
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-icon btn-secondary"
      style={{ width: 28, height: 28 }}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
    </button>
  );
}

// ── Secret Display Modal ──────────────────────────────────────
function SecretDisplayModal({
  title,
  secret,
  onClose,
}: {
  title: string;
  secret: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={20} style={{ color: '#ec4899' }} />
            <h2 className="modal-title">{title}</h2>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="alert" style={{ background: 'rgba(236, 72, 153, 0.1)', borderColor: 'rgba(236, 72, 153, 0.3)', color: '#f472b6', marginBottom: 18 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>Store this secret securely! It is used to compute HMAC-SHA256 signatures for webhook verification.</span>
          </div>

          <label className="form-label">Webhook Signing Secret</label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: '#34d399',
            wordBreak: 'break-all',
          }}>
            <span>{secret}</span>
            <CopyButton text={secret} />
          </div>

          <div style={{ marginTop: 20, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong>How to verify:</strong> In your receiver endpoint, extract <code>t</code> and <code>v1</code> from header <code>X-HookShield-Signature</code>, then compute <code>HMAC-SHA256(timestamp + "." + rawBody, secret)</code>.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>I have saved this secret</button>
        </div>
      </div>
    </div>
  );
}

// ── Test Ping Modal ───────────────────────────────────────────
function TestPingModal({
  endpoint,
  onClose,
}: {
  endpoint: Endpoint;
  onClose: () => void;
}) {
  const [result, setResult] = useState<EndpointTestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await endpointApi.test(endpoint.id);
      setResult(res.data);
    } catch (err: any) {
      setResult({
        success: false,
        durationMs: 0,
        error: err.message || 'Failed to dispatch test request',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={20} style={{ color: '#06b6d4' }} />
            <h2 className="modal-title">Test Endpoint Connectivity</h2>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>TARGET URL</div>
            <div className="url-cell" style={{ fontSize: '0.9rem', color: '#ffffff' }}>{endpoint.url}</div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
            This immediately dispatches an authenticated test webhook (<code>hookshield.test_ping</code>) signed with this endpoint's secret to verify receiver availability and response time.
          </p>

          <button
            className="btn btn-primary"
            onClick={runTest}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }}
          >
            {loading ? (
              <>
                <Send size={16} className="animate-spin" />
                <span>Dispatching Test Webhook...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>Send Test Ping Now</span>
              </>
            )}
          </button>

          {result && (
            <div style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${result.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: 'var(--radius-md)',
              padding: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {result.success ? (
                    <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                  ) : (
                    <XCircle size={18} style={{ color: '#ef4444' }} />
                  )}
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: result.success ? '#10b981' : '#ef4444' }}>
                    {result.success ? 'Connectivity Verified (HTTP 2xx)' : 'Verification Failed'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {result.statusCode && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
                      HTTP {result.statusCode}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {result.durationMs}ms
                  </span>
                </div>
              </div>

              {result.error && (
                <div className="alert alert-error" style={{ margin: '8px 0 0 0', fontSize: '0.8rem' }}>
                  {result.error}
                </div>
              )}

              {result.responseBody && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>RESPONSE BODY</div>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    overflowX: 'auto',
                    maxHeight: 120,
                  }}>
                    {result.responseBody}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Create Endpoint Modal ─────────────────────────────────────
function CreateEndpointModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (secret: string) => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState('http://localhost:4000/webhook');
  const [description, setDescription] = useState('Local Receiver Demo');
  const [events, setEvents] = useState<string[]>(['payment.completed', 'order.fulfilled', 'github.push', 'auth.alert']);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: endpointApi.create,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['endpoints'] });
      onClose();
      if (res.secret) {
        onCreated(res.secret);
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!url) return setError('URL is required');
    if (events.length === 0) return setError('At least one event type is required');
    mutation.mutate({ url, description, subscribedEvents: events });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Register Endpoint</h2>
          <button className="btn btn-icon btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Destination URL *</label>
              <input
                className="form-input font-mono"
                type="url"
                placeholder="https://your-server.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <p className="form-helper">Destination webhook URL. For local testing, use <code>http://localhost:4000/webhook</code></p>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                className="form-input"
                type="text"
                placeholder="Payment and fulfillment notifications"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subscribed Event Types *</label>
              <TagInput value={events} onChange={setEvents} />
              <p className="form-helper">Press Enter or comma to add. E.g., <code>payment.completed</code></p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Registering…' : 'Register & Generate Secret'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function EndpointsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ title: string; secret: string } | null>(null);
  const [testEndpointTarget, setTestEndpointTarget] = useState<Endpoint | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['endpoints', page],
    queryFn: () => endpointApi.list(page),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      endpointApi.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => endpointApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
  });

  const revealSecretMutation = useMutation({
    mutationFn: (id: string) => endpointApi.getSecret(id),
    onSuccess: (res) => {
      setRevealedSecret({
        title: 'Webhook Signing Secret',
        secret: res.secret,
      });
    },
  });

  const rotateSecretMutation = useMutation({
    mutationFn: (id: string) => endpointApi.rotateSecret(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['endpoints'] });
      setRevealedSecret({
        title: 'New Webhook Signing Secret (Rotated)',
        secret: res.secret,
      });
    },
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Endpoints</h1>
          <p className="page-subtitle">Manage webhook destination URLs, encryption secrets, and subscriptions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Register Endpoint
        </button>
      </div>

      {showCreate && (
        <CreateEndpointModal
          onClose={() => setShowCreate(false)}
          onCreated={(secret) => {
            setRevealedSecret({
              title: 'Webhook Secret Generated',
              secret,
            });
          }}
        />
      )}

      {revealedSecret && (
        <SecretDisplayModal
          title={revealedSecret.title}
          secret={revealedSecret.secret}
          onClose={() => setRevealedSecret(null)}
        />
      )}

      {testEndpointTarget && (
        <TestPingModal
          endpoint={testEndpointTarget}
          onClose={() => setTestEndpointTarget(null)}
        />
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} style={{ color: '#6366f1' }} />
            Registered Endpoints
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {data?.total ?? 0} total
          </span>
        </div>

        <div className="table-wrapper">
          {error ? (
            <div className="alert alert-error" style={{ margin: 16 }}>Failed to load endpoints</div>
          ) : isLoading ? (
            <LoadingState rows={5} cols={6} />
          ) : data?.data?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Globe size={28} /></div>
              <p className="empty-title">No endpoints registered</p>
              <p className="empty-text">Register a webhook destination to receive authenticated event payloads</p>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Register Endpoint
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Description</th>
                  <th>Event Types</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((ep: Endpoint) => (
                  <tr key={ep.id}>
                    <td>
                      <span className="url-cell" title={ep.url}>{ep.url}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {ep.description || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
                        {ep.subscribedEvents.slice(0, 3).map((evt) => (
                          <span key={evt} className="tag" style={{ fontSize: '0.72rem' }}>{evt}</span>
                        ))}
                        {ep.subscribedEvents.length > 3 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            +{ep.subscribedEvents.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={ep.enabled ? 'enabled' : 'disabled'} />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {formatDistanceToNow(new Date(ep.createdAt), { addSuffix: true })}
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={ep.enabled}
                          onChange={() => toggleMutation.mutate({ id: ep.id, enabled: !ep.enabled })}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setTestEndpointTarget(ep)}
                          title="Send test ping"
                        >
                          <Send size={13} style={{ color: '#06b6d4' }} />
                          <span>Test</span>
                        </button>

                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => revealSecretMutation.mutate(ep.id)}
                          title="Reveal signing secret"
                        >
                          <KeyRound size={13} style={{ color: '#ec4899' }} />
                          <span>Secret</span>
                        </button>

                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            if (window.confirm('Rotate signing secret for this endpoint? Existing signatures will be invalidated.')) {
                              rotateSecretMutation.mutate(ep.id);
                            }
                          }}
                          title="Rotate secret"
                        >
                          <RotateCw size={13} />
                        </button>

                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            if (window.confirm('Delete this endpoint? Pending deliveries will be terminated.')) {
                              deleteMutation.mutate(ep.id);
                            }
                          }}
                          title="Delete endpoint"
                          style={{ color: '#ef4444' }}
                        >
                          <Trash2 size={13} />
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
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
