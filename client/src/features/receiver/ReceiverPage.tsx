import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Trash2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { receiverApi } from '../../services/api';
import type { ReceiverConfig, ReceiverLog } from '../../types';
import { formatDistanceToNow } from 'date-fns';

export function ReceiverPage() {
  const qc = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Poll health & config
  const healthQuery = useQuery({
    queryKey: ['receiver-health'],
    queryFn: receiverApi.health,
    refetchInterval: autoRefresh ? 3000 : false,
    retry: 1,
  });

  const logsQuery = useQuery({
    queryKey: ['receiver-logs'],
    queryFn: receiverApi.getLogs,
    refetchInterval: autoRefresh ? 2500 : false,
    retry: 1,
  });

  const configMutation = useMutation({
    mutationFn: receiverApi.updateConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receiver-health'] });
      qc.invalidateQueries({ queryKey: ['receiver-logs'] });
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: receiverApi.clearLogs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receiver-logs'] });
    },
  });

  const isOnline = healthQuery.isSuccess;
  const config = healthQuery.data?.config as ReceiverConfig | undefined;
  const logs = (logsQuery.data?.logs as ReceiverLog[]) ?? [];

  const setPreset = (preset: { forceStatus: number; failCount: number; delayMs: number }) => {
    configMutation.mutate(preset);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Receiver Simulator</h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: isOnline ? '#34d399' : '#f87171',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}>
              <Radio size={12} className={isOnline ? 'animate-pulse' : ''} />
              {isOnline ? 'Port 4000 Online' : 'Port 4000 Offline'}
            </span>
          </div>
          <p className="page-subtitle">
            Target webhook destination server with interactive failure simulation and HMAC-SHA256 signature verification
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw size={13} className={autoRefresh ? 'animate-spin' : ''} />
            <span>{autoRefresh ? 'Live Polling' : 'Paused'}</span>
          </button>
          <a
            href="http://localhost:4000/health"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            <ExternalLink size={13} />
            <span>Direct API</span>
          </a>
        </div>
      </div>

      {!isOnline && (
        <div className="alert alert-error" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Receiver Demo server is not running on port 4000.</strong>
            <p style={{ fontSize: '0.82rem', marginTop: 4, color: 'var(--text-secondary)' }}>
              Start the receiver server using terminal: <code>npm run receiver</code> or <code>node receiver-demo/server.js</code>.
            </p>
          </div>
        </div>
      )}

      {/* Preset Control Panel */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header">
          <div className="card-title">
            <Sliders size={18} style={{ color: '#06b6d4' }} />
            <span>Interactive Failure Mode Simulator</span>
          </div>
          {config && (
            <div style={{ display: 'flex', gap: 14, fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <span>Force: <strong>{config.forceStatus === 0 ? 'None (200)' : `HTTP ${config.forceStatus}`}</strong></span>
              <span>Fail Count: <strong>{config.failCount}</strong></span>
              <span>Delay: <strong>{config.delayMs}ms</strong></span>
            </div>
          )}
        </div>

        <div className="card-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Toggle destination response modes in real time to test HookShield's exponential backoff, jitter, and retry exhaustion:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPreset({ forceStatus: 0, failCount: 0, delayMs: 0 })}
              style={{
                justifyContent: 'flex-start',
                padding: '12px 14px',
                borderColor: config?.forceStatus === 0 && config?.failCount === 0 && config?.delayMs === 0 ? '#10b981' : undefined,
              }}
            >
              <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Healthy (HTTP 200)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Immediate acknowledgment</div>
              </div>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setPreset({ forceStatus: 0, failCount: 3, delayMs: 0 })}
              style={{
                justifyContent: 'flex-start',
                padding: '12px 14px',
                borderColor: config?.failCount === 3 ? '#f59e0b' : undefined,
              }}
            >
              <RotateCcw size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Fail First 3 Attempts</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tests backoff then recovers</div>
              </div>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setPreset({ forceStatus: 500, failCount: 0, delayMs: 0 })}
              style={{
                justifyContent: 'flex-start',
                padding: '12px 14px',
                borderColor: config?.forceStatus === 500 ? '#ef4444' : undefined,
              }}
            >
              <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>HTTP 500 Internal Error</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Persistent server outage</div>
              </div>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setPreset({ forceStatus: 429, failCount: 0, delayMs: 0 })}
              style={{
                justifyContent: 'flex-start',
                padding: '12px 14px',
                borderColor: config?.forceStatus === 429 ? '#ec4899' : undefined,
              }}
            >
              <Clock size={16} style={{ color: '#ec4899', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>HTTP 429 Rate Limit</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Transient backoff retry</div>
              </div>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setPreset({ forceStatus: 0, failCount: 0, delayMs: 11000 })}
              style={{
                justifyContent: 'flex-start',
                padding: '12px 14px',
                borderColor: config?.delayMs === 11000 ? '#a855f7' : undefined,
              }}
            >
              <AlertTriangle size={16} style={{ color: '#a855f7', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>11s Request Timeout</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Worker aborts at 10s</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Receiver Audit Log */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={18} style={{ color: '#10b981' }} />
            <span>Incoming Webhook Stream (Port 4000)</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {logs.length} captured
            </span>
            {logs.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => clearLogsMutation.mutate()}
                disabled={clearLogsMutation.isPending}
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Radio size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
              Listening for Outgoing Webhooks...
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto' }}>
              Ensure an endpoint is registered with URL <code>http://localhost:4000/webhook</code>, then fire a webhook from the Dashboard or Events page.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Status Returned</th>
                  <th>Event Type</th>
                  <th>Delivery ID</th>
                  <th>Signature Header</th>
                  <th>Time Received</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="td-mono" style={{ fontWeight: 700 }}>
                        #{log.requestNo}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 999,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: log.statusCode >= 200 && log.statusCode < 300 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: log.statusCode >= 200 && log.statusCode < 300 ? '#34d399' : '#f87171',
                        border: `1px solid ${log.statusCode >= 200 && log.statusCode < 300 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}>
                        HTTP {log.statusCode}
                      </span>
                      {log.failureReason && (
                        <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {log.failureReason}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="tag" style={{ fontSize: '0.72rem' }}>
                        {log.eventType}
                      </span>
                    </td>
                    <td>
                      <span className="td-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {log.deliveryId}
                      </span>
                    </td>
                    <td>
                      {log.signatureHeader ? (
                        <div style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#ec4899' }} title={log.signatureHeader}>
                          {log.signatureHeader}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No signature</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(log.receivedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
