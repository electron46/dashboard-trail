import React from 'react';

const TONES = {
  principal: { bg: 'var(--color-anthracite)', color: 'var(--color-offwhite)', border: 'var(--color-anthracite)' },
  secondaire: { bg: 'var(--color-offwhite)', color: 'var(--color-anthracite)', border: 'var(--color-border)' },
  success: { bg: 'var(--color-success-soft)', color: 'var(--color-success)', border: 'var(--color-success)' },
  danger: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)', border: 'var(--color-danger)' },
  neutral: { bg: 'var(--color-white)', color: 'var(--color-muted)', border: 'var(--color-border)' },
};

export function Badge({ tone = 'neutral', children }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      style={{
        display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 11,
        textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)',
        background: t.bg, color: t.color, border: `1px solid ${t.border}`,
        borderRadius: 'var(--radius-pill)', padding: '3px 10px', fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
