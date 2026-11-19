import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Send, ShoppingCart, CreditCard, GitBranch, AlertTriangle, Check, Sparkles } from 'lucide-react';
import { eventApi } from '../services/api';

interface Preset {
  id: string;
  name: string;
  icon: typeof Zap;
  type: string;
  color: string;
  payload: Record<string, any>;
}

const PRESETS: Preset[] = [
  {
    id: 'stripe',
    name: 'Stripe Payment',
    icon: CreditCard,
    type: 'payment.completed',
    color: '#6366f1',
    payload: {
      orderId: 'ord_' + Math.floor(10000 + Math.random() * 90000),
      amount: 19900,
      currency: 'USD',
      customer: { email: 'sarah.connor@example.com', name: 'Sarah Connor' },
      gateway: 'stripe_connect',
      paidAt: new Date().toISOString(),
    },
  },
  {
    id: 'shopify',
    name: 'Shopify Order',
    icon: ShoppingCart,
    type: 'order.fulfilled',
    color: '#10b981',
    payload: {
      trackingNumber: 'TRK-981729384',
      carrier: 'FedEx Express',
      itemsCount: 3,
      destination: 'San Francisco, CA',
      fulfilledAt: new Date().toISOString(),
    },
  },
  {
    id: 'github',
    name: 'GitHub Push',
    icon: GitBranch,
    type: 'github.push',
    color: '#06b6d4',
    payload: {
      repository: 'hookshield/core-engine',
      branch: 'main',
      commits: [
        { id: 'c8f12a9', message: 'feat: zero-latency exponential jitter algorithm' },
      ],
      pusher: 'antigravity-dev',
    },
  },
  {
    id: 'security',
    name: 'Auth0 Security',
    icon: AlertTriangle,
    type: 'auth.alert',
    color: '#f59e0b',
    payload: {
      severity: 'high',
      incident: 'Multiple failed MFA attempts',
      sourceIp: '198.51.100.42',
      riskScore: 89,
    },
  },
];

export function WebhookSimulator() {
  const qc = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<Preset>(PRESETS[0]);
  const [justFired, setJustFired] = useState(false);

  const mutation = useMutation({
    mutationFn: eventApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries-recent'] });
      qc.invalidateQueries({ queryKey: ['delivery-stats'] });
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['events'] });
      setJustFired(true);
      setTimeout(() => setJustFired(false), 2400);
    },
  });

  const handleFire = () => {
    mutation.mutate({
      type: selectedPreset.type,
      payload: {
        ...selectedPreset.payload,
        orderId: selectedPreset.id === 'stripe' ? 'ord_' + Math.floor(10000 + Math.random() * 90000) : undefined,
        timestamp: new Date().toISOString(),
      },
      idempotencyKey: 'sim_' + Date.now() + '_' + Math.random().toString(36).substring(7),
    });
  };

  return (
    <div className="simulator-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)'
          }}>
            <Sparkles size={18} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
              Interactive Webhook Simulator
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Test end-to-end ingestion, AES-256 encryption, HMAC signing & worker dispatch with 1 click
            </p>
          </div>
        </div>

        <button
          onClick={handleFire}
          disabled={mutation.isPending}
          className="btn btn-primary"
          style={{
            padding: '10px 22px',
            fontSize: '0.9rem',
            background: justFired
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, #6366f1 0%, #a855f7 60%, #ec4899 100%)',
          }}
        >
          {justFired ? (
            <>
              <Check size={18} />
              <span>Dispatched! Check Log Below</span>
            </>
          ) : mutation.isPending ? (
            <>
              <Send size={18} className="animate-spin" />
              <span>Signing & Routing...</span>
            </>
          ) : (
            <>
              <Zap size={18} />
              <span>Fire {selectedPreset.name}</span>
            </>
          )}
        </button>
      </div>

      {/* Preset selector pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Quick Presets:
        </span>
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = selectedPreset.id === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset)}
              className="preset-chip"
              style={{
                borderColor: isSelected ? preset.color : undefined,
                background: isSelected ? `${preset.color}22` : undefined,
                color: isSelected ? '#ffffff' : undefined,
                boxShadow: isSelected ? `0 0 14px ${preset.color}44` : undefined,
              }}
            >
              <Icon size={14} style={{ color: preset.color }} />
              {preset.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
