// Entry families and types. Each family has a colour used across the app.

export const FAMILIES = [
  { id: 'people', name: 'People', color: '#d65a52', types: ['NPC', 'Villain', 'Party Member', 'Creature'] },
  { id: 'places', name: 'Places', color: '#e08a3c', types: ['Region', 'Settlement', 'Location', 'Dungeon'] },
  { id: 'powers', name: 'Powers', color: '#c4a032', types: ['Faction', 'Deity', 'Organization'] },
  { id: 'things', name: 'Things', color: '#4fa86a', types: ['Item', 'Artifact'] },
  { id: 'lore', name: 'Lore', color: '#4189cc', types: ['History', 'Culture', 'Magic'] },
  { id: 'plot', name: 'Plot', color: '#9160cc', types: ['Quest', 'Secret', 'Event'] },
];

const byType = new Map();
for (const f of FAMILIES) for (const t of f.types) byType.set(t, f);

export const familyOf = (type) => byType.get(type) || FAMILIES[0];
export const colorOf = (type) => familyOf(type).color;
