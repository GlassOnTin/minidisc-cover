# MiniDisc Cover Maker

Print correctly sized, foldable MiniDisc case inserts from your own artwork. It is one static page with no build step, no dependencies, and no server. The artwork is read with `URL.createObjectURL` and never leaves the browser.

## The geometry

A MiniDisc case insert is **73 x 84 mm and folded**. It is not a flat panel. This is the part most templates get wrong.

| region | what it is |
|---|---|
| 0-68 mm | the front face, the only part you see through the case |
| 68 mm | fold, back over the top of the case |
| 68-73 mm | the top edge, where the title goes. 5 mm is the case thickness |
| 73-84 mm | tucks inside and is never seen |

The 68 mm figure is worth trusting because it is the disc cartridge's own height. A MiniDisc is 72 x 68 x 5 mm. You should measure the rest yourself. Published figures for MiniDisc packaging disagree with one another, and searching for them mostly returns pages about DVD cases. Every dimension is editable in the interface for that reason, and the settings persist in `localStorage`.

## Printing

Set the print dialogue to **100% scale**. Do not use "fit to page". Choose A4. Leave the scale check ruler switched on for the first print and measure it. If 0-100 does not measure exactly 100 mm, the dialogue rescaled the page and every insert is wrong by the same factor. There is no way to detect that after the fact without the ruler.

Choosing one copy places it in the top-left corner and leaves the rest of the sheet clean. This matters when the sheet is photo paper.

## Running it

Open `index.html`. That is the whole procedure. To serve it locally instead:

```sh
python3 -m http.server 8000
```

To host it, enable GitHub Pages on the repository and point it at the default branch root. There is nothing to compile.

## Browser support

Anything current. It uses `object-fit`, CSS custom properties, `localStorage` and CSS `mm` units, all long-standing. Printing depends on the browser honouring `@page`, which Chrome and Firefox both do.
