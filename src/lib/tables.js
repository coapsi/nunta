// Geometria meselor: unde sta fiecare loc, in coordonate locale (centrul mesei = 0,0).

export const SHAPES = {
  round: 'Rotundă',
  rect: 'Dreptunghiulară',
  presidium: 'Prezidiu (o singură latură)',
  serpentine: 'Lungă, șerpuită',
  zone: 'Zonă (ring, DJ, bar)',
};

export const SEAT_R = 15;
const GAP = 38;

function serpentinePoints(seats, config) {
  const perSide = Math.max(1, Math.ceil(seats / 2));
  const length = Math.max(perSide * (GAP + 4), 120);
  const curves = Math.min(8, Math.max(1, Number(config?.curves) || 2));
  const amp = Math.min(Number(config?.amp) || 70, length / (curves * 2.2));
  const pts = [];
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push({ x: -length / 2 + t * length, y: amp * Math.sin(Math.PI * curves * t) });
  }
  return pts;
}

export function layout(t) {
  const seats = Math.max(0, Number(t.seats) || 0);
  const out = [];

  if (t.shape === 'zone') {
    const w = Number(t.config?.w) || 220;
    const h = Number(t.config?.h) || 160;
    return { seats: out, w, h, bounds: Math.max(w, h) / 2 };
  }

  if (t.shape === 'rect' || t.shape === 'presidium') {
    const oneSide = t.shape === 'presidium';
    const top = oneSide ? seats : Math.ceil(seats / 2);
    const bottom = seats - top;
    const w = Math.max(top * GAP, 80);
    const h = oneSide ? 46 : 58;
    for (let i = 0; i < top; i++) out.push({ x: -w / 2 + ((i + 0.5) * w) / top, y: -h / 2 - SEAT_R - 5 });
    for (let i = 0; i < bottom; i++) out.push({ x: -w / 2 + ((i + 0.5) * w) / bottom, y: h / 2 + SEAT_R + 5 });
    return { seats: out, w, h, bounds: w / 2 + 30 };
  }

  if (t.shape === 'serpentine') {
    const pts = serpentinePoints(seats, t.config);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = cum[cum.length - 1];
    const at = (dist) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < dist) i++;
      const a = pts[i - 1];
      const b = pts[i];
      const f = (dist - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, nx: -(b.y - a.y) / len, ny: (b.x - a.x) / len };
    };
    const top = Math.ceil(seats / 2);
    const bottom = seats - top;
    const off = 23 + SEAT_R + 4;
    for (let i = 0; i < top; i++) {
      const p = at(((i + 0.5) * total) / top);
      out.push({ x: p.x - p.nx * off, y: p.y - p.ny * off });
    }
    for (let i = 0; i < bottom; i++) {
      const p = at(((i + 0.5) * total) / bottom);
      out.push({ x: p.x + p.nx * off, y: p.y + p.ny * off });
    }
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { seats: out, path, bounds: (pts[pts.length - 1].x - pts[0].x) / 2 + 40 };
  }

  // rotunda
  const r = Math.max(40, (seats * (SEAT_R * 2 + 6)) / (2 * Math.PI) - SEAT_R - 4);
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
    out.push({ x: Math.cos(a) * (r + SEAT_R + 5), y: Math.sin(a) * (r + SEAT_R + 5) });
  }
  return { seats: out, r, bounds: r + 40 };
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
