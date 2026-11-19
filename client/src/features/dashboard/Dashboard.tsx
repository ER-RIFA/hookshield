import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Activity,
  TrendingUp,
  Send,
  Zap,
  ArrowRight,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { WebhookSimulator } from '../../components/WebhookSimulator';
import { PipelineVisualizer } from '../../components/PipelineVisualizer';
import { DeliveryDetailModal } from '../deliveries/DeliveriesPage';
import { deliveryApi } from '../../services/api';
import type { Delivery, DashboardStats } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const statsQuery = useQuery<{ success: boolean; data: DashboardStats }>({
    queryKey: ['delivery-stats'],
    queryFn: deliveryApi.stats,
    refetchInterval: 4000,
  });

  const recentQuery = useQuery({
    queryKey: ['deliveries-recent'],
    queryFn: () => deliveryApi.list({ limit: 10, page: 1 }),
    refetchInterval: 4000,
  });

  const stats = statsQuery.data?.data;
  const recentDeliveries: Delivery[] = recentQuery.data?.data ?? [];
  const successRate = stats && stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 100;

  return (
    <div>
      {selectedDeliveryId && (
        <DeliveryDetailModal
          deliveryId={selectedDeliveryId}
          onClose={() => setSelectedDeliveryId(null)}
        />
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">
              Mission Control
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}>
              <Radio size={12} className="animate-pulse" />
              Real-Time Polling
            </span>
          </div>
          <p className="page-subtitle">
            Zero-loss distributed webhook delivery, exponential backoff, and cryptographic validation
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/events" className="btn btn-secondary btn-sm">
            <Zap size={14} />
            <span>Publish Custom Event</span>
          </Link>
          <Link to="/deliveries" className="btn btn-primary btn-sm">
            <span>View All Deliveries</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Interactive Webhook Simulator */}
      <WebhookSimulator />

      {/* Active Pipeline Visualizer */}
      <PipelineVisualizer />

      {/* Glowing Neon Stat Cards */}
      <div className="stat-grid">
        <StatCard
          label="Total Deliveries"
          value={stats?.total ?? '—'}
          color="#6366f1"
          Icon={Activity}
          subtitle="All dispatch attempts"
        />
        <StatCard
          label="Delivered"
          value={stats?.success ?? '—'}
          color="#10b981"
          Icon={CheckCircle}
          subtitle="HTTP 2xx acknowledged"
        />
        <StatCard
          label="In Queue"
          value={stats?.pending ?? '—'}
          color="#818cf8"
          Icon={Clock}
          subtitle="Ready for worker claim"
        />
        <StatCard
          label="Retrying"
          value={stats?.retrying ?? '—'}
          color="#f59e0b"
          Icon={RefreshCw}
          subtitle="Exponential backoff active"
        />
        <StatCard
          label="In Transit"
          value={stats?.delivering ?? '—'}
          color="#06b6d4"
          Icon={Send}
          subtitle="Worker actively sending"
        />
        <StatCard
          label="Exhausted"
          value={stats?.failed ?? '—'}
          color="#ef4444"
          Icon={XCircle}
          subtitle="Max attempts exceeded"
        />
      </div>

      {/* Success Rate Gauge Card */}
      {stats && stats.total > 0 && (
        <div className="card" style={{ marginBottom: 28, background: 'linear-gradient(135deg, rgba(20, 26, 44, 0.7) 0%, rgba(12, 16, 28, 0.85) 100%)' }}>
          <div className="card-body" style={{ padding: '22px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <TrendingUp size={18} style={{ color: '#10b981' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>Overall Delivery Success Rate</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculated over all attempts and automatic retry cycles</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>
                  {successRate}%
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Reliability SLA</span>
              </div>
            </div>

            {/* Gradient progress bar with glow */}
            <div style={{
              height: 10,
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 999,
              overflow: 'hidden',
              padding: 2,
              border: '1px solid var(--border)',
            }}>
              <div style={{
                height: '100%',
                width: `${successRate}%`,
                background: 'linear-gradient(90deg, #10b981 0%, #34d399 50%, #06b6d4 100%)',
                borderRadius: 999,
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.6)',
                transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Live Recent Activity Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ShieldCheck size={20} style={{ color: '#818cf8' }} />
            <span>Recent Delivery Stream</span>
          </div>
          <Link to="/deliveries" className="btn btn-secondary btn-sm">
            <span>View Full Log</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {recentQuery.isLoading ? (
          <LoadingState text="Streaming delivery audit log..." />
        ) : recentDeliveries.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Send size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 16px auto', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>No Deliveries Yet</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 20px auto' }}>
              Use the Interactive Webhook Simulator above to fire your first signed webhook payload!
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Event Type</th>
                  <th>Destination URL</th>
                  <th>Attempts</th>
                  <th>Response</th>
                  <th>Latency</th>
                  <th>Dispatched</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((del) => {
                  const eventObj = typeof del.eventId === 'object' && del.eventId !== null ? del.eventId : null;
                  const endpointObj = typeof del.endpointId === 'object' && del.endpointId !== null ? del.endpointId : null;
                  const eventType = eventObj?.type || 'webhook.event';
                  const endpointUrl = endpointObj?.url || '—';

                  return (
                    <tr
                      key={del._id}
                      onClick={() => setSelectedDeliveryId(del._id)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view full attempt history and payload"
                    >
                      <td>
                        <StatusBadge status={del.status} />
                      </td>
                      <td>
                        <span className="code-pill">
                          {eventType}
                        </span>
                      </td>
                      <td>
                        <div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {endpointUrl}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: del.attempts > 1 ? '#f59e0b' : 'var(--text-secondary)' }}>
                          {del.attempts} / 5
                        </span>
                      </td>
                      <td>
                        {del.lastStatusCode ? (
                          <span style={{
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            color: del.lastStatusCode < 300 ? '#34d399' : '#f87171',
                          }}>
                            HTTP {del.lastStatusCode}
                          </span>
                        ) : del.lastError ? (
                          <span style={{ fontSize: '0.78rem', color: '#f87171' }}>
                            {del.lastError}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {del.lastDurationMs != null ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {del.lastDurationMs}ms
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatDistanceToNow(new Date(del.createdAt), { addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
