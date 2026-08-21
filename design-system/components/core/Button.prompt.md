Bouton d'action principal, à utiliser pour toute action déclenchée (importer, enregistrer, valider).

```jsx
<Button variant="primary" onClick={save}>Enregistrer</Button>
<Button variant="secondary" size="sm">Choisir un fichier</Button>
<Button variant="danger">Réinitialiser</Button>
```

Variants: `primary` (anthracite plein — action par défaut), `secondary` (contour, fond blanc), `ghost` (sans fond, discret), `danger` (contour rouge, actions destructrices). `disabled` réduit l'opacité et bloque le clic. `icon` accepte tout ReactNode devant le label.
