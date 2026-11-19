import { Radio, Lock, KeyRound, ShieldCheck, Cpu, CheckCircle2 } from 'lucide-react';

export function PipelineVisualizer() {
  const steps = [
    { title: 'Producer Ingress', subtitle: 'POST /api/events', Icon: Radio, color: '#6366f1' },
    { title: 'AES-256-GCM', subtitle: 'Envelope Encrypted', Icon: Lock, color: '#a855f7' },
    { title: 'HMAC-SHA256', subtitle: 't=..., v1=...', Icon: KeyRound, color: '#ec4899' },
    { title: 'SSRF Firewalls', subtitle: 'DNS & IP Filter', Icon: ShieldCheck, color: '#06b6d4' },
    { title: 'Worker Poller', subtitle: 'Atomic Lock', Icon: Cpu, color: '#10b981' },
    { title: 'Verified Delivery', subtitle: 'HTTP 200 OK', Icon: CheckCircle2, color: '#34d399' },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          Active Delivery Engine Pipeline
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Zero-Loss Guard Active</span>
        </div>
      </div>

      <div className="pipeline-container">
        {steps.map((step, idx) => {
          const Icon = step.Icon;
          return (
            <div key={step.title} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div className="pipeline-node">
                <div
                  className="node-icon-circle active"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}22 0%, ${step.color}44 100%)`,
                    borderColor: `${step.color}88`,
                    boxShadow: `0 0 16px ${step.color}44`,
                  }}
                >
                  <Icon size={20} style={{ color: step.color }} />
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap' }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {step.subtitle}
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="pipeline-beam" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
