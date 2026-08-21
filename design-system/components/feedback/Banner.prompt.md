Message de statut inline après une action (import réussi, erreur de parsing, information). Pas de toast flottant — le message reste dans le flux, sous l'action qui l'a déclenché.

```jsx
<Banner tone="ok">3 séance(s) importée(s).</Banner>
<Banner tone="err">Signature '.FIT' manquante.</Banner>
```
