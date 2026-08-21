import React from 'react';

export function DataValue({ children, size = 'md', emphasis = false }) {
  const sizes = { sm: 13, md: 16, lg: 22 };
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: sizes[size] || sizes.md, fontWeight: emphasis ? 600 : 400, color: 'var(--color-anthracite)' }}>
      {children}
    </span>
  );
}
