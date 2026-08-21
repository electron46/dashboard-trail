import React from 'react';

export function Table({ columns = [], rows = [], onRowClick }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-muted)', fontWeight: 500 }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            onClick={() => onRowClick && onRowClick(row)}
            style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = 'var(--color-offwhite)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {columns.map((c) => (
              <td key={c.key} style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontFamily: c.mono ? 'var(--font-mono)' : 'var(--font-sans)', color: 'var(--color-anthracite)' }}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
