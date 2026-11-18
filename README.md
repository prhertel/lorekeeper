# Lorekeeper

A campaign and world-building tool for tabletop game masters. It runs entirely in the browser: no build step, no server, no account, and no dependencies.

## Features (first version)

- **World Bible**: linked entries in six colour-coded families (People, Places, Powers, Things, Lore, Plot) and 19 types, shown on a clickable colour wheel. Each entry has:
  - an image
  - an overview for what the players know
  - a 🔒 DM secrets section
  - a "Mentioned in" list built from the links that point to it
- **@-mentions**: type `@` in any rich text field to link to an entry, or to create a new one. Click a link to jump to that entry.
- **World Map**: upload your own map image and pan or zoom it.
  - Drop pins with icons and colours, and link each pin to an entry.
  - Set the map scale, then measure distance and travel time on foot, on horse or by wagon.
  - Nest sub-maps inside pins.
  - **Azgaar's Fantasy Map Generator:** upload a `.map` file and it's repainted in a dark, grim style (black seas, umber land, drained realm colours, blood-red borders, bone labels, vignette and title). The distance scale is read from the file, and pins are added for capitals and the map's points of interest, which are hidden until you tick *Show points of interest*.
  - **Default map:** *Set as default map* chooses which map opens first. **Suxyland** (`assets/suxyland.map`) ships with the app and is imported as the default the first time the app opens in a browser.
- **Campaigns**: campaigns contain arcs, arcs contain sessions, and each session has beats (beat, main encounter, cliffhanger) plus notes. Each session is marked played, current or upcoming.
- **Combat**: an initiative tracker.
  - **Start combat** rolls any missing initiative and sorts the order.
  - **Turn tracker:** a bar pinned to the top shows the round, who is acting now (with portrait) and who is up next. When a character is done, press **End turn ➜** in the bar, the pulsing **➜ Done** arrow on their row, or `N`. After the last combatant it goes back to the top, starts the next round and announces it. NPCs at 0 HP are skipped; ◀ or `B` goes back a turn.
  - Each combatant has editable initiative (with a 🎲 re-roll), AC, current/max HP and temp HP, a damage/heal box (Enter = damage, Shift+Enter = heal; temp HP is used up first), and condition chips. Damaging a creature that is concentrating shows the DC for its concentration check.
  - **⬆ Upload characters**: pick or drop several files at once. Each one becomes a World Bible entry with its combat stats (re-uploading updates it) and joins the fight. Supported formats:
    - Fillable 5e character-sheet PDFs (the official sheet, D&D Beyond PDF exports and most clones)
    - Any other PDF with text, such as an NPC generator page saved with "Print → Save as PDF" (read with pdf.js)
    - Images and screenshots (PNG, JPG, WebP…) of NPCs or stat blocks (read in the browser with Tesseract OCR)
    - Text files: NPC write-ups, 5e stat blocks, or notes like `AC: 15 / HP: 27`. NPC write-ups become an **NPC** entry with the description in the overview and the plot hook in 🔒 DM secrets. If the file has no AC or HP, 5e Commoner stats are used (AC 10 + Dex, 4 HP).
    - Foundry VTT actor JSON
    - 5etools monster or bestiary JSON
    - Improved Initiative JSON
    - D&D Beyond character JSON (AC must be entered by hand)
    - CSV (`name,ac,hp,init,type`)
    - Lorekeeper backups
  - **Add party** brings in every Party Member in one click. **Quick add** creates several monsters at once (Goblin 1, Goblin 2…).
  - Each row shows the character's picture beside the name (initials if there's none). Click it to upload one: for World Bible characters it's saved on their entry.
  - Encounters can be saved and switched between.
  - Try it with the files in [`samples/`](samples/).
  - PDF text and image reading download a free reader from a CDN the first time they're used, so that needs internet. Everything else works offline.
  - The ⬆ button in the World Bible imports the same files as entries without adding them to a fight.
- **🎲 Random NPC generator**: in the World Bible (🎲 button) and in Combat (🎲 Random NPC).
  - **Filters:** race chips (weighted, so most NPCs come out human; presets: Mostly human, Humans only, Demons only, Everything), demons: mortals of any race converted by profane rituals of an unknown force and now driven by a demon spirit (Demon Human, Demon Elf, Demon Dwarf…). Their write-up covers how they were taken, where the ritual happened, the spirit's name, their life before the ritual, and corruption such as horns, ember eyes and claws, class chips (Commoner jobs plus the 12 classes, which demons can have too), level range, gender, and how many to make (up to 12).
  - **Each NPC gets:** a description, personality, faith, relationships, ability scores, AC/HP/speed/initiative, attacks, spells, traits and features, and gear. The 🔒 DM secrets hold a plot hook, a secret, and loot (coins, gems, trinkets, sometimes a magic item).
  - **Portraits:** every generated NPC gets a painted portrait from the library in `assets/portraits/` (16 dark fantasy portraits), matched by race, gender and class. Demons get a blood-red, ember-lit version of the matching portrait. If the library can't load, a simple drawn portrait is used instead. The 🎲 on any World Bible picture or Combat avatar rolls a portrait, so your party can have one too.
    - To add more portraits, put another sheet in `assets/portraits/` and list its tiles (race, class, gender, crop position) in `js/portraits.js`.
  - Re-roll single cards or all of them, then add them to the World Bible, or to the World Bible and the current fight in one click. Combat stats are filled in automatically.
- **Player view**: a toggle that hides every DM secret, for when you share your screen. In combat, NPC HP shows only as Healthy, Hurt, Bloodied or Down.
- **Backups**: export everything (images included) to one JSON file, and import it again.
- **Sample world**: load one from the sidebar to try every feature.

Data is stored in your browser (IndexedDB) and stays on that browser and device. **Export a backup now and then.**

## Run it locally

ES modules don't load from `file://`, so serve the folder. The included server turns off caching, so changes always show up on reload:

```bash
python serve.py
```

Then open http://localhost:5173.

## Online version

Lorekeeper is hosted free on GitHub Pages: **https://prhertel.github.io/lorekeeper/**

**To publish an update:** commit and push to `main`. GitHub Pages redeploys automatically, usually within a minute or two.

```bash
git add -A
git commit -m "Describe the change"
git push
```

Campaign data lives in each browser, not on GitHub, so the online site starts empty: use **Export backup** on your local copy and **Import backup** online.

**Other hosts:** `python publish.py` builds a clean `site/` folder (just the app) that you can drag onto Netlify Drop or upload to any static host.

## Keyboard shortcuts

`P` add pin · `M` measure · `F` fit · `Esc` cancel. Scroll to zoom, drag to pan, and drag a pin to move it.

Combat: `N` next turn · `B` previous turn.

## Roadmap

- Timeline with a custom calendar (weekdays, months, eras)
- Journals with dated entries on the timeline
- Faction territories drawn on the map
- Split screen and an in-app PDF viewer
- Guided onboarding that builds a story spine
- Save to a real folder (File System Access API) and installable offline app (PWA)
