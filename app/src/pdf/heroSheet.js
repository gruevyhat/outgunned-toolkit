import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { groupFeatIds } from '../engine/build.js';

const PAGE = Object.freeze({ width: 792, height: 612 }); // landscape Letter, points
const MARGIN = 24;
const INK = rgb(0.09, 0.086, 0.102);
const MUTED = rgb(0.42, 0.40, 0.38);
const PAPER = rgb(0.953, 0.929, 0.878);
const PAPER_ALT = rgb(0.98, 0.965, 0.93);
const RED = rgb(0.784, 0.125, 0.184);
const LINE = rgb(0.60, 0.56, 0.50);

/** Named regions are exported for visual tests and future alternate themes. */
export const SHEET_LAYOUT = Object.freeze({
  page: PAGE,
  identity: { x: 24, y: 532, w: 744, h: 56 },
  attributes: { x: 24, y: 378, w: 744, h: 146 },
  feats: { x: 24, y: 264, w: 744, h: 106 },
  resources: { x: 24, y: 205, w: 744, h: 51 },
  story: { x: 24, y: 166, w: 744, h: 31 },
  guns: { x: 24, y: 24, w: 410, h: 134 },
  gear: { x: 442, y: 24, w: 166, h: 134 },
  ride: { x: 616, y: 24, w: 152, h: 134 },
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
  return text(ranges[key], '-');
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

function fittedLine(font, value, size, maxWidth) {
  let output = text(value);
  if (font.widthOfTextAtSize(output, size) <= maxWidth) return output;
  while (output.length && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) output = output.slice(0, -1);
  return `${output.trim()}...`;
}

function drawFittedLine(page, font, value, x, y, maxWidth, size, color = INK) {
  page.drawText(fittedLine(font, value, size, maxWidth), { x, y, size, font, color });
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

function drawGritTracker(page, font, x, y, count, max = 12) {
  const filled = Math.max(0, Math.min(max, Math.floor(numeric(count))));
  for (let i = 0; i < max; i += 1) {
    const px = x + i * 12;
    if (i === 7) {
      page.drawCircle({ x: px + 5, y: y - 7.5, size: 5.5, borderColor: MUTED, borderWidth: 1, color: i < filled ? INK : PAPER_ALT });
      page.drawLine({ start: { x: px + 1.5, y: y - 11 }, end: { x: px + 8.5, y: y - 4 }, thickness: 1, color: i < filled ? PAPER : MUTED });
      page.drawLine({ start: { x: px + 8.5, y: y - 11 }, end: { x: px + 1.5, y: y - 4 }, thickness: 1, color: i < filled ? PAPER : MUTED });
      page.drawText('BAD!', { x: px - 2, y: y + 3, size: 4.7, font, color: MUTED });
    } else {
      page.drawSvgPath('M 0 12 L 5 15 L 10 12 L 9 5 L 5 0 L 1 5 Z', { x: px, y, borderColor: RED, borderWidth: 1, color: i < filled ? RED : PAPER });
      if (i === max - 1) {
        page.drawText('!', { x: px + 3.6, y: y + 4.5, size: 8, font, color: i < filled ? PAPER : RED });
        page.drawText('HOT!', { x: px - 2, y: y + 3, size: 4.7, font, color: RED });
      }
    }
  }
}

function drawAdrenalineTracker(page, x, y, count, max = 6) {
  const filled = Math.max(0, Math.min(max, Math.floor(numeric(count))));
  for (let i = 0; i < max; i += 1) {
    const px = x + i * 13;
    page.drawRectangle({ x: px, y, width: 10, height: 15, borderColor: RED, borderWidth: 1, color: i < filled ? RED : PAPER });
    page.drawLine({ start: { x: px + 6, y: y + 12 }, end: { x: px + 4, y: y + 8 }, thickness: 1.1, color: i < filled ? PAPER : RED });
    page.drawLine({ start: { x: px + 4, y: y + 8 }, end: { x: px + 7, y: y + 8 }, thickness: 1.1, color: i < filled ? PAPER : RED });
    page.drawLine({ start: { x: px + 7, y: y + 8 }, end: { x: px + 4, y: y + 3 }, thickness: 1.1, color: i < filled ? PAPER : RED });
  }
}

function drawRouletteTracker(page, font, x, y, count) {
  const filled = Math.max(0, Math.min(6, Math.floor(numeric(count))));
  const cx = x + 19, cy = y + 8;
  page.drawCircle({ x: cx, y: cy, size: 18, color: RED });
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 3 * i, chamberX = cx + Math.cos(angle) * 11, chamberY = cy + Math.sin(angle) * 11;
    page.drawCircle({ x: chamberX, y: chamberY, size: 4.2, borderColor: PAPER, borderWidth: .75, color: i < filled ? INK : PAPER_ALT });
  }
  page.drawCircle({ x: cx, y: cy, size: 4.3, color: INK });
  page.drawText('X', { x: cx - 2.3, y: cy - 2.5, size: 5.5, font, color: PAPER });
}

function drawSpotlightTracker(page, font, x, y, count, max = 3) {
  const filled = Math.max(0, Math.min(max, Math.floor(numeric(count))));
  for (let i = 0; i < max; i += 1) {
    const cx = x + 6 + i * 15;
    page.drawCircle({ x: cx, y: y + 6, size: 6, borderColor: RED, borderWidth: 1.1, color: i < filled ? RED : PAPER });
    page.drawText('*', { x: cx - 2.3, y: y + 2.7, size: 8, font, color: i < filled ? PAPER : RED });
  }
}

function drawCashTracker(page, font, x, y, count, max = 5) {
  const filled = Math.max(0, Math.min(max, Math.floor(numeric(count))));
  for (let i = 0; i < max; i += 1) {
    const cx = x + 5.5 + i * 13;
    page.drawCircle({ x: cx, y: y + 5.5, size: 5.5, borderColor: INK, borderWidth: 1, color: i < filled ? RED : PAPER });
    page.drawText('$', { x: cx - 2.2, y: y + 2.4, size: 5.8, font, color: i < filled ? PAPER : INK });
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
  drawBox(page, 'identity', identity, { color: PAPER_ALT });
  page.drawRectangle({ x: identity.x, y: identity.y + identity.h - 13, width: identity.w, height: 13, color: RED });
  page.drawText('OUTGUNNED // HERO SHEET', { x: identity.x + 8, y: identity.y + identity.h - 10, size: 8, font: bold, color: PAPER, characterSpacing: 0.6 });
  const personal = hero.personal || {};
  const name = text(personal.name, 'Unnamed Hero');
  drawFittedLine(page, bold, name, identity.x + 8, identity.y + 28, 190, 16);
  drawLabel(page, regular, 'Name', identity.x + 8, identity.y + 8);
  const roleName = valueName(data, 'roles', hero.role);
  const tropeName = valueName(data, 'tropes', hero.trope);
  drawFittedLine(page, bold, roleName, identity.x + 215, identity.y + 30, 150, 11);
  drawLabel(page, regular, 'Role', identity.x + 215, identity.y + 14);
  drawFittedLine(page, bold, tropeName, identity.x + 380, identity.y + 30, 155, 11);
  drawLabel(page, regular, 'Trope', identity.x + 380, identity.y + 14);
  const personalLine = [personal.job, personal.age, personal.catchphrase].filter(Boolean).map(text).join('  |  ');
  drawWrapped(page, regular, personalLine || 'Job  |  Age  |  Catchphrase', identity.x + 550, identity.y + 30, 184, 2, 7, { label: 'personal data', lineHeight: 8 });
  drawFittedLine(page, regular, `Flaw: ${text(personal.flaw, '-')}`, identity.x + 550, identity.y + 14, 184, 7.5);
  drawLabel(page, regular, `You Look: ${text(hero.conditions?.join?.(', ') || hero.youLook || personal.youLook, '-')}`, identity.x + 215, identity.y + 8, 6.5);

  // Attributes and their four skills.
  const attrsBox = SHEET_LAYOUT.attributes;
  drawBox(page, 'attributes', attrsBox, { color: PAPER_ALT });
  drawLabel(page, bold, 'Attributes & Skills', attrsBox.x + 8, attrsBox.y + attrsBox.h - 12, 8, RED);
  const attrs = hero.attributes || {};
  const skills = hero.skills || {};
  const attrKeys = Object.keys(ATTRIBUTE_SKILLS);
  const colW = (attrsBox.w - 16) / attrKeys.length;
  attrKeys.forEach((attr, index) => {
    const x = attrsBox.x + 8 + index * colW;
    if (index > 0) page.drawLine({ start: { x, y: attrsBox.y + 8 }, end: { x, y: attrsBox.y + attrsBox.h - 18 }, thickness: 0.5, color: LINE });
    page.drawRectangle({ x: x + 4, y: attrsBox.y + attrsBox.h - 48, width: colW - 8, height: 25, color: RED });
    page.drawText(attr.toUpperCase(), { x: x + 9, y: attrsBox.y + attrsBox.h - 34, size: 9.5, font: bold, color: PAPER, characterSpacing: 0.5 });
    const attributeCount = Math.max(0, Math.min(3, Math.floor(numeric(attrs[attr]))));
    for (let dot = 0; dot < 3; dot += 1) page.drawCircle({ x: x + colW - 47 + dot * 12, y: attrsBox.y + attrsBox.h - 35, size: 4.3, borderColor: PAPER, borderWidth: .8, color: dot < attributeCount ? PAPER : RED });
    ATTRIBUTE_SKILLS[attr].forEach((skill, skillIndex) => {
      const sy = attrsBox.y + attrsBox.h - 64 - skillIndex * 18;
      page.drawText(titleCase(skill), { x: x + 7, y: sy, size: 7.2, font: regular, color: INK });
      drawCircleTracker(page, x + colW - 39, sy + 2, skills[skill], 3, 3.3);
    });
  });

  // Feats, with enough room for the four-feat Old hero and the young hero's special feat.
  const featsBox = SHEET_LAYOUT.feats;
  drawBox(page, 'feats', featsBox, { color: PAPER_ALT });
  drawLabel(page, bold, 'Feats', featsBox.x + 8, featsBox.y + featsBox.h - 12, 8, RED);
  const featValues = groupFeatIds(Array.isArray(hero.feats) ? hero.feats : []);
  const featCols = 3;
  const featW = (featsBox.w - 20) / featCols;
  const featH = 42;
  featValues.slice(0, 6).forEach(({ id: feat, count }, index) => {
    const col = index % featCols;
    const row = Math.floor(index / featCols);
    const x = featsBox.x + 8 + col * featW;
    const y = featsBox.y + featsBox.h - 21 - row * featH;
    const record = lookup(data, 'feats', feat);
    const baseFeatName = text(feat?.name, valueName(data, 'feats', feat));
    const featName = `${baseFeatName}${count > 1 ? ` (x${count})` : ''}`;
    drawFittedLine(page, bold, featName, x, y, featW - 12, 8.2);
    drawWrapped(page, regular, text(record.summary, '-'), x, y - 10, featW - 12, 2, 6.6, { label: `feat ${featName}`, lineHeight: 8 });
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
  drawBox(page, 'resources', resourcesBox, { color: PAPER_ALT });
  drawLabel(page, bold, 'Grit', resourcesBox.x + 8, resourcesBox.y + 34, 7, RED);
  // Grit is a track of twelve empty boxes on the printed sheet.  A caller may
  // provide gritFilled/gritUsed for an in-progress sheet, but the engine's
  // `grit: 12` is a capacity and must not render twelve spent boxes.
  drawGritTracker(page, bold, resourcesBox.x + 8, resourcesBox.y + 18, hero.resources?.gritFilled ?? hero.resources?.gritUsed ?? 0);
  const resourceLabels = [
    [hero.superpower ? 'Power' : 'Adrenaline', hero.superpower ? hero.resources?.power : hero.resources?.adrenaline, 6],
    ['Spotlight', hero.resources?.spotlight, 3],
    ['Cash', hero.resources?.cash, 5],
    ['Death Roulette', hero.resources?.lethalBullets, 6],
  ];
  let rx = resourcesBox.x + 170;
  resourceLabels.forEach(([label, count, max]) => {
    drawLabel(page, regular, label, rx, resourcesBox.y + 34, 6.5, MUTED);
    if (label === 'Adrenaline') drawAdrenalineTracker(page, rx, resourcesBox.y + 11, count, max);
    else if (label === 'Spotlight') drawSpotlightTracker(page, bold, rx, resourcesBox.y + 13, count, max);
    else if (label === 'Cash') drawCashTracker(page, bold, rx, resourcesBox.y + 13, count, max);
    else if (label === 'Death Roulette') drawRouletteTracker(page, bold, rx + 70, resourcesBox.y + 12, count);
    else drawTracker(page, rx, resourcesBox.y + 13, count, max, { width: 9, height: 13, gap: 2 });
    rx += max * 11 + 35;
  });

  // Story strip keeps active-play notes on the printed sheet instead of
  // dropping information that is present in the interactive version.
  const storyBox = SHEET_LAYOUT.story;
  drawBox(page, 'story', storyBox, { color: PAPER_ALT });
  const storyColumns = [
    ['Mission', hero.mission, 350],
    ['Experiences', (hero.experiences || []).join(', '), 230],
    ['Conditions', (hero.conditions || []).join(', '), 130],
  ];
  let storyX = storyBox.x + 8;
  storyColumns.forEach(([label, value, width], index) => {
    if (index) page.drawLine({ start: { x: storyX - 7, y: storyBox.y + 5 }, end: { x: storyX - 7, y: storyBox.y + storyBox.h - 5 }, thickness: 0.45, color: LINE });
    drawLabel(page, bold, label, storyX, storyBox.y + 19, 6.2, RED);
    drawFittedLine(page, regular, text(value, '-'), storyX, storyBox.y + 7, width - 12, 6.7);
    storyX += width;
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
    const gy = gunsBox.y + gunsBox.h - 47 - index * 28;
    let x = gx;
    const vals = [gunName(data, gun), rangeValue(gun, 'melee'), rangeValue(gun, 'close'), rangeValue(gun, 'medium'), rangeValue(gun, 'long')];
    vals.forEach((val, valIndex) => { drawFittedLine(page, regular, val, x, gy, gunCols[valIndex] - 7, 7); x += gunCols[valIndex]; });
    drawTracker(page, x, gy - 4, numeric(gun.mags, 2), 3, { width: 11, height: 11, gap: 2 });
  });
  for (let index = getGuns(hero).length; index < 3; index += 1) {
    const gy = gunsBox.y + gunsBox.h - 47 - index * 28;
    page.drawLine({ start: { x: gx, y: gy - 5 }, end: { x: gunsBox.x + gunsBox.w - 8, y: gy - 5 }, thickness: 0.4, color: LINE });
  }

  // Five gear lines and storage, keeping the section useful even for an empty hero.
  const gearBox = SHEET_LAYOUT.gear;
  drawBox(page, 'gear', gearBox, { color: PAPER });
  drawLabel(page, bold, 'Gear', gearBox.x + 8, gearBox.y + gearBox.h - 12, 8, RED);
  getItems(hero).slice(0, 5).forEach((item, index) => {
    const iy = gearBox.y + gearBox.h - 28 - index * 16;
    drawFittedLine(page, regular, text(item?.name, valueName(data, 'gear', item)), gearBox.x + 8, iy, 115, 7.2);
    page.drawRectangle({ x: gearBox.x + gearBox.w - 20, y: iy - 2, width: 9, height: 9, borderColor: INK, borderWidth: 0.6, color: item?.bag ? RED : PAPER });
  });
  drawLabel(page, regular, 'Storage', gearBox.x + 8, gearBox.y + 19, 6.5);
  drawFittedLine(page, regular, Array.isArray(hero.gear?.storage) ? hero.gear.storage.map(text).join(', ') : '-', gearBox.x + 8, gearBox.y + 8, gearBox.w - 16, 6.6);

  // Ride: name, speed, type and the two three-box shield tracks.
  const rideBox = SHEET_LAYOUT.ride;
  drawBox(page, 'ride', rideBox, { color: PAPER });
  drawLabel(page, bold, 'Ride', rideBox.x + 8, rideBox.y + rideBox.h - 12, 8, RED);
  const ride = hero.gear?.ride;
  drawFittedLine(page, regular, text(ride?.name, '-'), rideBox.x + 8, rideBox.y + rideBox.h - 29, rideBox.w - 16, 8);
  drawLabel(page, regular, `Speed ${text(ride?.speed, '-')}`, rideBox.x + 8, rideBox.y + rideBox.h - 43, 6.7);
  drawLabel(page, regular, 'Shields', rideBox.x + 8, rideBox.y + 73, 6.5);
  drawTracker(page, rideBox.x + 8, rideBox.y + 53, ride?.shields ?? ride?.shield, 3, { width: 13, height: 13, gap: 3 });
  drawTracker(page, rideBox.x + 62, rideBox.y + 53, ride?.shields2, 3, { width: 13, height: 13, gap: 3 });
  drawLabel(page, regular, 'Type', rideBox.x + 8, rideBox.y + 35, 6.5);
  drawWrapped(page, regular, Array.isArray(ride?.types) ? ride.types.join(', ') : text(ride?.type, '-'), rideBox.x + 8, rideBox.y + 23, rideBox.w - 16, 2, 6.5, { label: 'ride type', lineHeight: 8 });

  return pdf.save();
}

export default drawHeroSheet;
