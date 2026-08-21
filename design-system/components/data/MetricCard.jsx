import React from 'react';

export function MetricCard({ label, value, unit = '', hint, na = false }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', background: 'var(--color-white)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-muted)' }}>{label}</div>
      <div style={{ fontFamily: na ? 'var(--font-sans)' : 'var(--font-mono)', fontSize: na ? 14 : 20, fontWeight: na ? 400 : 500, color: na ? 'var(--color-muted)' : 'var(--color-anthracite)', marginTop: 4 }}>
        {na ? 'Non disponible' : <>{value}{unit}</>}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
