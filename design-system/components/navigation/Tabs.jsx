import React from 'react';

export function Tabs({ items = [], active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map((item) => {
        const isActive = item.value === active;
        return (
          <button
            key={item.value}
            onClick={() => onChange && onChange(item.value)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 13, padding: '9px 16px',
              borderRadius: 'var(--radius-pill)', cursor: 'pointer',
              border: `1px solid ${isActive ? 'var(--color-anthracite)' : 'var(--color-border)'}`,
              background: isActive ? 'var(--color-anthracite)' : 'transparent',
              color: isActive ? 'var(--color-offwhite)' : 'var(--color-anthracite)',
              transition: 'all var(--duration-fast) var(--ease-standard)',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
