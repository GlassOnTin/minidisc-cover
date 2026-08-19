/* MiniDisc Cover Maker
 *
 * Everything is laid out in millimetres and handed to the browser as CSS mm, so
 * the preview on screen and the sheet on paper are the same drawing. There is no
 * build step, no server and no dependency: the page has to work from a static
 * host, and the artwork should never leave the machine it was opened on.
 */

const SHEET = { w: 210, h: 297 };          // A4
const DEFAULTS = { w: 73, h: 84, face: 68, band: 5 };

const $ = (id) => document.getElementById(id);
const sheet = $('sheet');

let imageURL = null;

/* --- state ---------------------------------------------------------------- */

function readState() {
  const num = (id, fallback) => {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    w: num('gw', DEFAULTS.w),
    h: num('gh', DEFAULTS.h),
    face: num('gf', DEFAULTS.face),
    band: num('gb', DEFAULTS.band),
    title: $('title').value.trim(),
    blankBand: $('blankBand').checked,
    copies: parseInt($('copies').value, 10),
    marks: $('marks').checked,
    folds: $('folds').checked,
    ruler: $('ruler').checked,
  };
}

const STORE = 'minidisc-cover/v1';

function save(s) {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      w: s.w, h: s.h, face: s.face, band: s.band,
      copies: s.copies, marks: s.marks, folds: s.folds, ruler: s.ruler,
    }));
  } catch { /* private browsing, or storage disabled: not worth reporting */ }
}

function restore() {
  let s;
  try { s = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return; }
  if (!s) return;
  if (s.w) $('gw').value = s.w;
  if (s.h) $('gh').value = s.h;
  if (s.face) $('gf').value = s.face;
  if (typeof s.band === 'number') $('gb').value = s.band;
  if (s.copies) $('copies').value = String(s.copies);
  for (const k of ['marks', 'folds', 'ruler']) {
    if (typeof s[k] === 'boolean') $(k).checked = s[k];
  }
}

/* --- geometry ------------------------------------------------------------- */

/** Pack `n` inserts left-to-right, top-to-bottom. A single copy sits in the
 *  top-left corner so the rest of an expensive sheet stays one clean rectangle. */
function layout(n, w, h) {
  const margin = n === 1 ? 8 : 10;
  const gutter = 6;
  const usableW = SHEET.w - 2 * margin;
  const perRow = Math.max(1, Math.floor((usableW + gutter) / (w + gutter)));
  const spots = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow), c = i % perRow;
    const x = margin + c * (w + gutter);
    const y = margin + r * (h + gutter);
    if (x + w > SHEET.w - margin + 0.01) continue;   // too wide for the page
    if (y + h > SHEET.h - margin + 0.01) continue;   // ran off the bottom
    spots.push({ x, y });
  }
  return { spots, margin, bottom: spots.length ? Math.max(...spots.map(s => s.y)) + h : margin };
}

const mm = (v) => `${v}mm`;

function el(cls, styles) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  Object.assign(d.style, styles || {});
  return d;
}

/* --- drawing -------------------------------------------------------------- */

function cropMarks(node, w, h) {
  const arm = 3, gap = 1.5, t = 0.25;
  for (const [cx, sx] of [[0, -1], [w, 1]]) {
    for (const [cy, sy] of [[0, -1], [h, 1]]) {
      node.append(el('mark', {                       // horizontal arm
        left: mm(sx < 0 ? cx - gap - arm : cx + gap), top: mm(cy - t / 2),
        width: mm(arm), height: mm(t),
      }));
      node.append(el('mark', {                       // vertical arm
        left: mm(cx - t / 2), top: mm(sy < 0 ? cy - gap - arm : cy + gap),
        width: mm(t), height: mm(arm),
      }));
    }
  }
}

/** Shrink the spine text until it fits the band. The band is the case thickness,
 *  so height usually binds before width. Must run after the sheet is in the
 *  document: an unattached element measures zero and every title "fits". */
function fitBands(bandMM) {
  for (const band of sheet.querySelectorAll('.band')) {
    const span = band.firstElementChild;
    if (!span) continue;
    let size = Math.min(4.4, bandMM * 0.62);
    span.style.fontSize = mm(size);
    while (size > 1.6
           && (span.scrollWidth > band.clientWidth || span.scrollHeight > band.clientHeight)) {
      size -= 0.1;
      span.style.fontSize = mm(size);
    }
  }
}

function drawInsert(s, x, y) {
  const tuck = s.h - s.face - s.band;
  const node = el('insert', { left: mm(x), top: mm(y), width: mm(s.w), height: mm(s.h) });

  const face = el('face', { width: mm(s.w), height: mm(s.face) });
  if (imageURL) {
    const img = document.createElement('img');
    img.src = imageURL;
    img.alt = '';
    face.append(img);
  }
  node.append(face);

  if (s.band > 0) {
    const band = el('band', { top: mm(s.face), width: mm(s.w), height: mm(s.band) });
    if (!s.blankBand && s.title) {
      const span = document.createElement('span');
      span.textContent = s.title;
      band.append(span);
    }
    node.append(band);
  }

  if (tuck > 0) {
    const t = el('tuck', { top: mm(s.face + s.band), width: mm(s.w), height: mm(tuck) });
    const lbl = document.createElement('span');
    lbl.textContent = 'tuck inside';
    t.append(lbl);
    node.append(t);
  }

  if (s.folds) {
    node.append(el('fold', { top: mm(s.face), width: mm(s.w) }));
    if (tuck > 0) node.append(el('fold', { top: mm(s.face + s.band), width: mm(s.w) }));
  }

  node.append(el('edge'));
  if (s.marks) cropMarks(node, s.w, s.h);
  return node;
}

function drawRuler(x, y, len = 100) {
  const r = el('rule', { left: mm(x), top: mm(y), width: mm(len) });

  const note = el('note', { left: 0, top: mm(-9) });
  note.className = 'note';
  note.textContent =
    'Scale check: 0-100 must measure exactly 100 mm. If it does not, the print '
    + 'dialogue rescaled and every insert is wrong by the same factor.';
  r.append(note);

  r.append(el('base', { width: mm(len) }));
  for (let i = 0; i <= len; i++) {
    const long = i % 10 === 0, mid = i % 5 === 0;
    r.append(el('tick', {
      left: mm(i), height: mm(long ? 4.5 : mid ? 3 : 1.6),
      width: mm(long ? 0.35 : 0.25),
    }));
    if (long) {
      const n = el('num', { left: mm(i + 0.6), top: mm(5) });
      n.className = 'num';
      n.textContent = String(i);
      r.append(n);
    }
  }
  return r;
}

function render() {
  const s = readState();
  save(s);

  const tuck = s.h - s.face - s.band;
  $('geomNote').textContent = tuck < 0
    ? `Front face and spine add up to more than the total height — the insert cannot fold.`
    : `Front face 0–${s.face} mm, spine ${s.face}–${s.face + s.band} mm, tuck ${tuck} mm.`;

  sheet.replaceChildren();

  if (tuck < 0) return;

  const { spots, margin, bottom } = layout(s.copies, s.w, s.h);
  for (const p of spots) sheet.append(drawInsert(s, p.x, p.y));

  if (s.ruler && bottom + 20 < SHEET.h) sheet.append(drawRuler(margin, bottom + 18));

  fitBands(s.band);   // after append: measurement needs the nodes in the document

  if (!imageURL) {
    const e = el('empty');
    e.className = 'empty';
    e.textContent = 'Choose artwork to see it here. The layout, folds and cut marks are already correct.';
    sheet.append(e);
  }

  if (spots.length < s.copies) {
    console.warn(`only ${spots.length} of ${s.copies} inserts fit on A4 at ${s.w}x${s.h} mm`);
  }
}

/* --- fit the preview to the window (screen only) -------------------------- */

function fitPreview() {
  const wrap = $('previewWrap');
  const zoom = Math.min(1, wrap.clientWidth / (sheet.offsetWidth || 1));
  document.documentElement.style.setProperty('--zoom', String(zoom));
  wrap.style.height = `${sheet.offsetHeight * zoom}px`;
}

/* --- wiring --------------------------------------------------------------- */

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (imageURL) URL.revokeObjectURL(imageURL);
  imageURL = URL.createObjectURL(file);
  $('dropLabel').textContent = file.name;
  if (!$('title').value.trim()) {
    // "Artist - Album - 01 Track.flac" and friends: the folder name is usually
    // the better guess, but a file drop only gives us the file.
    $('title').value = file.name
      .replace(/\.[^.]+$/, '')      // extension
      .replace(/_+/g, ' ')          // underscores, but keep hyphens: "Artist - Album"
      .replace(/\s+/g, ' ')
      .trim();
  }
  render();
  fitPreview();
}

for (const id of ['title', 'gw', 'gh', 'gf', 'gb']) {
  $(id).addEventListener('input', () => { render(); fitPreview(); });
}
for (const id of ['copies', 'blankBand', 'marks', 'folds', 'ruler']) {
  $(id).addEventListener('change', () => { render(); fitPreview(); });
}

$('file').addEventListener('change', (e) => loadFile(e.target.files[0]));

const drop = $('drop');
for (const ev of ['dragenter', 'dragover']) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
}
for (const ev of ['dragleave', 'drop']) {
  drop.addEventListener(ev, () => drop.classList.remove('over'));
}
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  loadFile(e.dataTransfer.files[0]);
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});

$('reset').addEventListener('click', () => {
  $('gw').value = DEFAULTS.w;
  $('gh').value = DEFAULTS.h;
  $('gf').value = DEFAULTS.face;
  $('gb').value = DEFAULTS.band;
  render();
  fitPreview();
});

$('print').addEventListener('click', () => window.print());

// The preview is scaled for the screen; printing must use the unscaled sheet.
window.addEventListener('beforeprint', () => {
  document.documentElement.style.setProperty('--zoom', '1');
  $('previewWrap').style.height = '';
});
window.addEventListener('afterprint', fitPreview);
window.addEventListener('resize', fitPreview);

restore();
render();
fitPreview();
