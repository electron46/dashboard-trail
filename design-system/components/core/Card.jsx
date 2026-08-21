import React from 'react';

export function Card({ children, style, padding = 'var(--space-5)' }) {
  return (
    <section
      style={{
        background: 'var(--surface-card)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
        padding, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}
