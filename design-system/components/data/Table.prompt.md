Table de données (historique de séances). En-têtes en mono majuscule discret. Colonnes chiffrées (`mono: true`) s'affichent en IBM Plex Mono. `onRowClick` rend les lignes cliquables avec un survol léger.

```jsx
<Table
  columns={[{key:'date',label:'Date'},{key:'distance',label:'Distance',mono:true}]}
  rows={sessions}
  onRowClick={openDetail}
/>
```
