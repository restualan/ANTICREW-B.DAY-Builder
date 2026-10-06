# Anticrew Birthday Poster Builder

Web editor for the monthly birthday poster (1920×1080, from the Figma "OCT - BDAYS" frame).

**Run:** double-click `start.command` (needs Python 3). It serves the folder on http://localhost:8765 and opens it.

- Click any text on the poster to edit it (headline, names, titles, dates, greeting, season line).
- Click an empty card to add a photo; drag to reposition, scroll/slider to zoom; double-click to replace. You can also drop an image onto a card.
- **+ Add card** / **+ From photos…** add cards; **Remove**, **Earlier/Later** manage them. The grid re-centers (5 per row up to 10 cards, then shrinks to fit).
- Background: upload an image, adjust opacity/darkening, or pick a base color/gradient.
- **Export** panel (like Figma): each row is a scale + format. Scale accepts `2x`, `3840w` (width px) or `1080h` (height px), or pick a preset from the ▾ menu; format is PNG, JPG or WEBP; **•••** shows the output size and JPG/WEBP quality; **+** adds a row, **—** removes it. **Export Poster** downloads one file per row (e.g. `…@2x.jpg`). **Preview** shows a small render and the output sizes. Width is limited to 480–8192 px.

**Fonts:** the design uses Proxima Nova and PP Editorial Old (licensed). Without them, Nunito Sans / Playfair Display are used.
Install the real fonts on your machine, or place `ProximaNova-Regular.woff2`, `ProximaNova-Semibold.woff2` and
`PPEditorialOld-Italic.woff2` in `fonts/`.

**Built-in assets:** `assets/antikode-logo.png` and `assets/bg-default.jpg` are embedded into `assets/defaults.js`
so the poster never depends on file paths when deployed. After replacing either image, run `tools/embed-assets.sh`.
Deploy the whole folder (static hosting; no build step).
