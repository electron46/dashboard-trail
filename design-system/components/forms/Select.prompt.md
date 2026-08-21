Liste déroulante native, même style que Input pour rester cohérent dans un formulaire.

```jsx
<Select value={sport} onChange={e=>setSport(e.target.value)} options={[{value:'course',label:'Course à pied'},{value:'trail',label:'Trail'}]} />
```
