Champ de saisie simple. `mono` bascule en IBM Plex Mono — à réserver aux champs qui contiennent une valeur chiffrée ou technique (clé API, CSV collé).

```jsx
<Input placeholder="Rechercher (type, sport...)" value={q} onChange={e=>setQ(e.target.value)} />
<Input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
```
