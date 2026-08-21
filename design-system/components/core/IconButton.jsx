import React from 'react';

export function IconButton({ children, active = false, onClick, 'aria-label': ariaLabel, style }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-md)', cursor: 'pointer',
        background: active ? 'var(--color-anthracite)' : 'transparent',
        color: active ? 'var(--color-offwhite)' : 'var(--color-anthracite)',
        border: `1px solid ${active ? 'var(--color-anthracite)' : 'var(--color-border)'}`,
        transition: 'background var(--duration-fast) var(--ease-standard)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
