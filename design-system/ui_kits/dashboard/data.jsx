const RACES = [
  { name: 'Trail des Cascades', date: '2026-09-12', distanceKm: 31, denivele: 1700, statut: 'secondaire' },
  { name: 'Mafate Trail Tour', date: '2026-11-28', distanceKm: 55, denivele: 3500, statut: 'principal' },
];

const SESSIONS = [
  { id: 1, date: '2026-08-09', sport: 'Trail', distance: '18,6 km', dplus: '740 m', duree: '1h58', allure: "6'22/km", fc: '148 bpm' },
  { id: 2, date: '2026-08-06', sport: 'Course à pied', distance: '10,0 km', dplus: '60 m', duree: '48min12', allure: "4'49/km", fc: '156 bpm' },
  { id: 3, date: '2026-08-03', sport: 'Trail', distance: '24,1 km', dplus: '1120 m', duree: '2h51', allure: "7'06/km", fc: '142 bpm' },
  { id: 4, date: '2026-07-30', sport: 'Course à pied', distance: '14,0 km', dplus: '90 m', duree: '1h05', allure: "4'38/km", fc: '151 bpm' },
];

function fmtDate(iso) { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; }

function RaceChip({ race }) {
  const isPrincipal = race.statut === 'principal';
  const days = Math.ceil((new Date(race.date) - new Date('2026-08-11')) / 86400000);
  return (
    <div style={{
      flex: '1 1 220px', borderRadius: 'var(--radius-md)', padding: 14,
      border: `1px solid ${isPrincipal ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
      background: isPrincipal ? 'var(--text-primary)' : 'var(--surface-1)',
      color: isPrincipal ? 'var(--canvas)' : 'var(--text-primary)',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: isPrincipal ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
        Objectif {race.statut}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0 2px' }}>{race.name}</div>
      <div style={{ fontSize: 13, color: isPrincipal ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
        {fmtDate(race.date)} — <span style={{ fontFamily: 'var(--font-mono)' }}>{race.distanceKm} km / {race.denivele} m D+</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, marginTop: 8 }}>J-{days}</div>
    </div>
  );
}
Object.assign(window, { RACES, SESSIONS, RaceChip });
