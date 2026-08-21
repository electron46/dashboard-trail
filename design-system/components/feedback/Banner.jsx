import React from 'react';

const TONES = {
  ok: { bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
  err: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
  info: { bg: 'var(--color-offwhite)', color: 'var(--color-anthracite)' },
};

export function Banner({ tone = 'info', children }) {
  const t = TONES[tone] || TONES.info;
  return (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', background: t.bg, color: t.color, borderRadius: 'var(--radius-md)', padding: '9px 12px' }}>
      {children}
    </div>
  );
}
