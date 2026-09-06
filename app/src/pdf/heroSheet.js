import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE = Object.freeze({ width: 792, height: 612 }); // landscape Letter, points
const MARGIN = 24;
const INK = rgb(0.09, 0.086, 0.102);
const MUTED = rgb(0.42, 0.40, 0.38);
const PAPER = rgb(0.953, 0.929, 0.878);
const RED = rgb(0.784, 0.125, 0.184);
const LINE = rgb(0.60, 0.56, 0.50);

/** Named regions are exported for visual tests and future alternate themes. */
export const SHEET_LAYOUT = Object.freeze({
  page: PAGE,
  identity: { x: 24, y: 536, w: 744, h: 52 },
  attributes: { x: 24, y: 381, w: 744, h: 148 },
  feats: { x: 24, y: 266, w: 744, h: 108 },
  resources: { x: 24, y: 207, w: 744, h: 51 },
  guns: { x: 24, y: 24, w: 410, h: 171 },
  gear: { x: 442, y: 24, w: 166, h: 171 },
  ride: { x: 616, y: 24, w: 152, h: 171 },
});

const ATTRIBUTE_SKILLS = {
  brawn: ['endure', 'fight', 'force', 'stunt'],
  nerves: ['cool', 'drive', 'shoot', 'survival'],
  smooth: ['flirt', 'leadership', 'speech', 'style'],
  focus: ['detect', 'fix', 'heal', 'know'],
  crime: ['awareness', 'dexterity', 'stealth', 'streetwise'],
};

function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return value.name || value.id || fallback;
}

function lookup(data, collection, value) {
  const id = typeof value === 'string' ? value : value?.id;
  const group = data?.[collection] || {};
  // Data imports may be passed either as the contract group itself
  // ({ roles: { commando: ... } }) or as the complete JSON document
  // ({ roles: { roles: { commando: ... } } }).
  const source = group[collection] || group;
  return (id && source[id]) || value || {};
}

function titleCase(id) {
  return text(id).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function valueName(data, collection, value) {
  const record = lookup(data, collection, value);
  return text(record.name, titleCase(value));
}

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rangeValue(gun, key) {
  const ranges = gun?.range || gun?.ranges || {};
  return text(ranges[key], '—');
}

function getGuns(hero) {
  return Array.isArray(hero?.gear?.guns) ? hero.gear.guns : [];
}

function getItems(hero) {
  return Array.isArray(hero?.gear?.items) ? hero.gear.items : [];
}

function checkRect(label, rect) {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > PAGE.width || rect.y + rect.h > PAGE.height) {
    throw new Error(`Hero sheet overflow in ${label}`);
  }
}

function drawBox(page, label, rect, options = {}) {
  checkRect(label, rect);
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    borderColor: options.borderColor || LINE,
    borderWidth: options.borderWidth || 0.8,
    color: options.color,
    opacity: options.opacity,
  });
}

function wrap(font, value, size, maxWidth) {
  const words = text(value).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    // A single unbroken token is still checked instead of silently escaping its box.
    if (font.widthOfTextAtSize(word, size) > maxWidth) return null;
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(page, font, value, x, y, maxWidth, maxLines, size, options = {}) {
  const lines = wrap(font, value, size, maxWidth);
  if (!lines || lines.length > maxLines) throw new Error(`Hero sheet overflow in ${options.label || 'text'}`);
  lines.forEach((line, index) => page.drawText(line, {
    x,
    y: y - index * (options.lineHeight || size + 1),
    size,
    font,
    color: options.color || INK,
    characterSpacing: options.characterSpacing,
  }));
  return lines.length;
}

function drawLabel(page, font, value, x, y, size = 7, color = MUTED) {
  page.drawText(text(value).toUpperCase(), { x, y, size, font, color, characterSpacing: 0.5 });
}

function drawTracker(page, x, y, count, max, options = {}) {
  const width = options.width || 10;
  const height = options.height || 10;
  const gap = options.gap || 2;
  const filled = Math.max(0, Math.min(max, Math.floor(numeric(count))));
  for (let i = 0; i < max; i += 1) {
    const px = x + i * (width + gap);
    page.drawRectangle({
      x: px,
      y,
      width,
      height,
      borderColor: INK,
      borderWidth: 0.6,
      color: i < filled ? RED : PAPER,
    });
  }
}

function drawCircleTracker(page, x, y, count, max, radius = 5) {
  const filled = Math.max(0, Math.min(max, Math.floor(numeric(count))));
  for (let i = 0; i < max; i += 1) {
    page.drawCircle({ x: x + i * (radius * 2 + 3), y, size: radius, borderColor: INK, borderWidth: 0.65, color: i < filled ? RED : PAPER });
  }
}

function gunName(data, gun) {
  return text(gun?.name, valueName(data, 'gear', gun?.id));
}

/**
 * Draws the toolkit's own one-page hero sheet.  It intentionally uses only
 * pdf-lib's standard Helvetica faces so the same bytes work in Vite and the
 * single-file build.  The function is async because pdf-lib embeds fonts and
 * serializes the finished document asynchronously.
 */
export async function drawHeroSheet(hero = {}, data = {}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: PAPER });

  // Identity strip.
  const identity = SHEET_LAYOUT.identity;
  drawBox(page, 'identity', identity, { color: PAPER });
  page.drawRectangle({ x: identity.x, y: identity.y + identity.h - 13, width: identity.w, height: 13, color: RED });
  page.drawText('OUTGUNNED // HERO SHEET', { x: identity.x + 8, y: identity.y + identity.h - 10, size: 8, font: bold, color: PAPER, characterSpacing: 0.6 });
  const personal = hero.personal || {};
  const name = text(personal.name, 'Unnamed Hero');
  drawWrapped(page, bold, name, identity.x + 8, identity.y + 27, 190, 1, 16, { label: 'identity name' });
  drawLabel(page, regular, 'Name', identity.x + 8, identity.y + 8);
  const roleName = valueName(data, 'roles', hero.role);
  const tropeName = valueName(data, 'tropes', hero.trope);
  drawWrapped(page, bold, roleName, identity.x + 215, identity.y + 29, 150, 1, 11, { label: 'role' });
  drawLabel(page, regular, 'Role', identity.x + 215, identity.y + 14);
  drawWrapped(page, bold, tropeName, identity.x + 380, identity.y + 29, 155, 1, 11, { label: 'trope' });
  drawLabel(page, regular, 'Trope', identity.x + 380, identity.y + 14);
  const personalLine = [personal.job, personal.age, personal.catchphrase].filter(Boolean).map(text).join('  |  ');
  drawWrapped(page, regular, personalLine || 'Job  |  Age  |  Catchphrase', identity.x + 550, identity.y + 30, 184, 2, 7, { label: 'personal data', lineHeight: 8 });
  drawWrapped(page, regular, `Flaw: ${text(personal.flaw, '—')}`, identity.x + 550, identity.y + 14, 184, 1, 7.5, { label: 'flaw' });
  drawLabel(page, regular, `You Look: ${text(hero.conditions?.join?.(', ') || hero.youLook || personal.youLook, '—')}`, identity.x + 215, identity.y + 8, 6.5);

  // Attributes and their four skills.
  const attrsBox = SHEET_LAYOUT.attributes;
  drawBox(page, 'attributes', attrsBox, { color: PAPER });
  drawLabel(page, bold, 'Attributes & Skills', attrsBox.x + 8, attrsBox.y + attrsBox.h - 12, 8, RED);
  const attrs = hero.attributes || {};
  const skills = hero.skills || {};
  const attrKeys = Object.keys(ATTRIBUTE_SKILLS);
  const colW = (attrsBox.w - 16) / attrKeys.length;
  attrKeys.forEach((attr, index) => {
    const x = attrsBox.x + 8 + index * colW;
    if (index > 0) page.drawLine({ start: { x, y: attrsBox.y + 8 }, end: { x, y: attrsBox.y + attrsBox.h - 18 }, thickness: 0.5, color: LINE });
    page.drawText(attr.toUpperCase(), { x: x + 7, y: attrsBox.y + attrsBox.h - 30, size: 10, font: bold, color: INK, characterSpacing: 0.5 });
    drawCircleTracker(page, x + 8, attrsBox.y + attrsBox.h - 43, attrs[attr], 3, 4.2);
    ATTRIBUTE_SKILLS[attr].forEach((skill, skillIndex) => {
      const sy = attrsBox.y + attrsBox.h - 64 - skillIndex * 18;
      page.drawText(titleCase(skill), { x: x + 7, y: sy, size: 7.2, font: regular, color: INK });
      drawCircleTracker(page, x + colW - 39, sy + 2, skills[skill], 3, 3.3);
    });
  });

  // Feats, with enough room for the four-feat Old hero and the young hero's special feat.
  const featsBox = SHEET_LAYOUT.feats;
  drawBox(page, 'feats', featsBox, { color: PAPER });
  drawLabel(page, bold, 'Feats', featsBox.x + 8, featsBox.y + featsBox.h - 12, 8, RED);
  const featValues = Array.isArray(hero.feats) ? hero.feats : [];
  const featCols = 3;
  const featW = (featsBox.w - 20) / featCols;
  const featH = 42;
  featValues.slice(0, 6).forEach((feat, index) => {
    const col = index % featCols;
    const row = Math.floor(index / featCols);
    const x = featsBox.x + 8 + col * featW;
    const y = featsBox.y + featsBox.h - 21 - row * featH;
    const record = lookup(data, 'feats', feat);
    const featName = text(feat?.name, valueName(data, 'feats', feat));
    page.drawText(featName, { x, y, size: 8.2, font: bold, color: INK });
    drawWrapped(page, regular, text(record.summary, '—'), x, y - 10, featW - 12, 2, 6.6, { label: `feat ${featName}`, lineHeight: 8 });
  });
  for (let index = featValues.length; index < 6; index += 1) {
    const col = index % featCols;
    const row = Math.floor(index / featCols);
    const x = featsBox.x + 8 + col * featW;
    const y = featsBox.y + featsBox.h - 21 - row * featH;
    page.drawLine({ start: { x, y: y - 13 }, end: { x: x + featW - 12, y: y - 13 }, thickness: 0.5, color: LINE });
  }

  // Resource strip and all empty trackers.
  const resourcesBox = SHEET_LAYOUT.resources;
  drawBox(page, 'resources', resourcesBox, { color: PAPER });
  drawLabel(page, bold, 'Grit', resourcesBox.x + 8, resourcesBox.y + 34, 7, RED);
  // Grit is a track of twelve empty boxes on the printed sheet.  A caller may
  // provide gritFilled/gritUsed for an in-progress sheet, but the engine's
  // `grit: 12` is a capacity and must not render twelve spent boxes.
  drawTracker(page, resourcesBox.x + 8, resourcesBox.y + 13, hero.resources?.gritFilled ?? hero.resources?.gritUsed ?? 0, 12, { width: 10, height: 13, gap: 2 });
  const resourceLabels = [
    [hero.superpower ? 'Power' : 'Adrenaline', hero.superpower ? hero.resources?.power : hero.resources?.adrenaline, 6],
    ['Spotlight', hero.resources?.spotlight, 3],
    ['Cash', hero.resources?.cash, 5],
    ['Death Roulette', hero.resources?.lethalBullets, 6],
  ];
  let rx = resourcesBox.x + 170;
  resourceLabels.forEach(([label, count, max]) => {
    drawLabel(page, regular, label, rx, resourcesBox.y + 34, 6.5, MUTED);
    drawTracker(page, rx, resourcesBox.y + 13, count, max, { width: 9, height: 13, gap: 2 });
    rx += max * 11 + 35;
  });

  // Guns table.
  const gunsBox = SHEET_LAYOUT.guns;
  drawBox(page, 'guns', gunsBox, { color: PAPER });
  drawLabel(page, bold, 'Guns', gunsBox.x + 8, gunsBox.y + gunsBox.h - 12, 8, RED);
  const gx = gunsBox.x + 8;
  const gunCols = [110, 52, 52, 52, 52, 58];
  const headings = ['Name', 'Melee', 'Close', 'Medium', 'Long', 'Mags'];
  let cursor = gx;
  headings.forEach((heading, index) => { drawLabel(page, regular, heading, cursor, gunsBox.y + gunsBox.h - 27, 6.2); cursor += gunCols[index]; });
  page.drawLine({ start: { x: gx, y: gunsBox.y + gunsBox.h - 31 }, end: { x: gunsBox.x + gunsBox.w - 8, y: gunsBox.y + gunsBox.h - 31 }, thickness: 0.6, color: LINE });
  getGuns(hero).slice(0, 3).forEach((gun, index) => {
    const gy = gunsBox.y + gunsBox.h - 49 - index * 32;
    let x = gx;
    const vals = [gunName(data, gun), rangeValue(gun, 'melee'), rangeValue(gun, 'close'), rangeValue(gun, 'medium'), rangeValue(gun, 'long')];
    vals.forEach((val, valIndex) => { drawWrapped(page, regular, val, x, gy, gunCols[valIndex] - 7, 1, 7, { label: `gun ${vals[0]}` }); x += gunCols[valIndex]; });
    drawTracker(page, x, gy - 4, numeric(gun.mags, 2), 3, { width: 11, height: 11, gap: 2 });
  });
  for (let index = getGuns(hero).length; index < 3; index += 1) {
    const gy = gunsBox.y + gunsBox.h - 49 - index * 32;
    page.drawLine({ start: { x: gx, y: gy - 5 }, end: { x: gunsBox.x + gunsBox.w - 8, y: gy - 5 }, thickness: 0.4, color: LINE });
  }

  // Five gear lines and storage, keeping the section useful even for an empty hero.
  const gearBox = SHEET_LAYOUT.gear;
  drawBox(page, 'gear', gearBox, { color: PAPER });
  drawLabel(page, bold, 'Gear', gearBox.x + 8, gearBox.y + gearBox.h - 12, 8, RED);
  getItems(hero).slice(0, 5).forEach((item, index) => {
    const iy = gearBox.y + gearBox.h - 29 - index * 19;
    drawWrapped(page, regular, text(item?.name, valueName(data, 'gear', item)), gearBox.x + 8, iy, 115, 1, 7.2, { label: 'gear item' });
    page.drawRectangle({ x: gearBox.x + gearBox.w - 20, y: iy - 2, width: 9, height: 9, borderColor: INK, borderWidth: 0.6, color: item?.bag ? RED : PAPER });
  });
  drawLabel(page, regular, 'Storage', gearBox.x + 8, gearBox.y + 24, 6.5);
  drawWrapped(page, regular, Array.isArray(hero.gear?.storage) ? hero.gear.storage.map(text).join(', ') : '—', gearBox.x + 8, gearBox.y + 13, gearBox.w - 16, 1, 6.6, { label: 'storage' });

  // Ride: name, speed, type and the two three-box shield tracks.
  const rideBox = SHEET_LAYOUT.ride;
  drawBox(page, 'ride', rideBox, { color: PAPER });
  drawLabel(page, bold, 'Ride', rideBox.x + 8, rideBox.y + rideBox.h - 12, 8, RED);
  const ride = hero.gear?.ride;
  drawWrapped(page, regular, text(ride?.name, '—'), rideBox.x + 8, rideBox.y + rideBox.h - 31, rideBox.w - 16, 1, 8, { label: 'ride name' });
  drawLabel(page, regular, `Speed ${text(ride?.speed, '—')}`, rideBox.x + 8, rideBox.y + rideBox.h - 45, 6.7);
  drawLabel(page, regular, 'Shields', rideBox.x + 8, rideBox.y + rideBox.h - 63, 6.5);
  drawTracker(page, rideBox.x + 8, rideBox.y + rideBox.h - 82, ride?.shields ?? ride?.shield, 3, { width: 13, height: 13, gap: 3 });
  drawTracker(page, rideBox.x + 8, rideBox.y + rideBox.h - 103, ride?.shields2, 3, { width: 13, height: 13, gap: 3 });
  drawLabel(page, regular, 'Type', rideBox.x + 8, rideBox.y + 55, 6.5);
  drawWrapped(page, regular, Array.isArray(ride?.types) ? ride.types.join(', ') : text(ride?.type, '—'), rideBox.x + 8, rideBox.y + 42, rideBox.w - 16, 3, 6.5, { label: 'ride type', lineHeight: 8 });

  return pdf.save();
}

export default drawHeroSheet;
