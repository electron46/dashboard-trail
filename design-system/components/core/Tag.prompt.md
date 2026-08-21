Filtre ou libellé retirable (ex. filtre de recherche actif dans l'historique). Passe `onRemove` pour afficher le bouton de suppression.

```jsx
<Tag>course</Tag>
<Tag onRemove={() => clearFilter()}>du 01/06 au 30/06</Tag>
```
