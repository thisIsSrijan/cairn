/**
 * Deterministic topographic contour generator for surveyor field ledger art.
 * Generates smooth closed SVG paths and a trail with 3 waypoints.
 */

export interface ContourOptions {
  seed: number;
  width: number;
  height: number;
  contourCount: number;
  centerX?: number;
  centerY?: number;
}

export interface Waypoint {
  id: string;
  x: number;
  y: number;
  label: string;
  stage: string;
}

export interface TrailResult {
  path: string;
  waypoints: Waypoint[];
}

/**
 * 32-bit Mulberry PRNG for deterministic random values.
 */
function createPrng(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Point {
  x: number;
  y: number;
}

/**
 * Converts an array of points into a smooth closed SVG cubic path.
 */
function pointsToClosedSvgPath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return "";

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < n; i++) {
    const pPrev = points[(i - 1 + n) % n];
    const pCurr = points[i];
    const pNext = points[(i + 1) % n];
    const pNextNext = points[(i + 2) % n];

    // Catmull-Rom to Cubic Bezier conversion
    const cp1x = pCurr.x + (pNext.x - pPrev.x) / 6;
    const cp1y = pCurr.y + (pNext.y - pPrev.y) / 6;
    const cp2x = pNext.x - (pNextNext.x - pCurr.x) / 6;
    const cp2y = pNext.y - (pNextNext.y - pCurr.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pNext.x.toFixed(2)} ${pNext.y.toFixed(2)}`;
  }

  d += " Z";
  return d;
}

/**
 * Generates an array of closed topographic contour SVG paths.
 */
export function generateContours(options: ContourOptions): string[] {
  const { seed, width, height, contourCount } = options;
  const prng = createPrng(seed);

  const cx = options.centerX ?? width * 0.55;
  const cy = options.centerY ?? height * 0.48;

  const minRadius = Math.min(width, height) * 0.12;
  const maxRadius = Math.min(width, height) * 0.48;
  const numVertices = 24;

  const paths: string[] = [];

  for (let k = 0; k < contourCount; k++) {
    const baseRadius =
      minRadius + ((maxRadius - minRadius) * (k + 1)) / (contourCount + 0.5);

    // Deterministic harmonic phase offsets for this layer
    const phase1 = prng() * Math.PI * 2;
    const phase2 = prng() * Math.PI * 2;
    const phase3 = prng() * Math.PI * 2;
    const amp1 = 0.12 + prng() * 0.08;
    const amp2 = 0.08 + prng() * 0.06;
    const amp3 = 0.04 + prng() * 0.04;

    const points: Point[] = [];

    for (let i = 0; i < numVertices; i++) {
      const theta = (i / numVertices) * Math.PI * 2;

      // Periodic harmonic perturbation ensures smooth wrap-around
      const noise =
        Math.sin(2 * theta + phase1) * amp1 +
        Math.cos(3 * theta + phase2) * amp2 +
        Math.sin(5 * theta + phase3) * amp3;

      const r = Math.max(10, baseRadius * (1 + noise));
      const px = Math.min(width - 2, Math.max(2, cx + r * Math.cos(theta)));
      const py = Math.min(height - 2, Math.max(2, cy + r * Math.sin(theta)));

      points.push({ x: px, y: py });
    }

    paths.push(pointsToClosedSvgPath(points));
  }

  return paths;
}

/**
 * Generates a dotted trail and 3 waypoints for the Ask flow.
 */
export function generateTrailWithWaypoints(options: {
  seed: number;
  width: number;
  height: number;
}): TrailResult {
  const { seed, width, height } = options;
  const prng = createPrng(seed);

  // 3 distinct waypoints representing the receipt trail
  const wp1: Waypoint = {
    id: "wp-discover",
    x: Math.round(width * (0.18 + prng() * 0.06)),
    y: Math.round(height * (0.64 + prng() * 0.08)),
    label: "01 Discover",
    stage: "Permitted sources",
  };

  const wp2: Waypoint = {
    id: "wp-extract",
    x: Math.round(width * (0.50 + prng() * 0.06)),
    y: Math.round(height * (0.44 + prng() * 0.08)),
    label: "02 Extract",
    stage: "Verbatim quotes",
  };

  const wp3: Waypoint = {
    id: "wp-verify",
    x: Math.round(width * (0.80 + prng() * 0.06)),
    y: Math.round(height * (0.28 + prng() * 0.08)),
    label: "03 Verify",
    stage: "Receipt verification",
  };

  // Build smooth open curve between waypoints with entry and exit handles
  const cp1x = (wp1.x + (wp2.x - wp1.x) * 0.5).toFixed(2);
  const cp1y = (wp1.y - height * 0.08).toFixed(2);
  const cp2x = (wp2.x - (wp2.x - wp1.x) * 0.1).toFixed(2);
  const cp2y = (wp2.y + height * 0.08).toFixed(2);

  const cp3x = (wp2.x + (wp3.x - wp2.x) * 0.4).toFixed(2);
  const cp3y = (wp2.y - height * 0.12).toFixed(2);
  const cp4x = (wp3.x - (wp3.x - wp2.x) * 0.3).toFixed(2);
  const cp4y = (wp3.y + height * 0.05).toFixed(2);

  const path = `M ${wp1.x.toFixed(2)} ${wp1.y.toFixed(2)} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${wp2.x.toFixed(2)} ${wp2.y.toFixed(2)} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${wp3.x.toFixed(2)} ${wp3.y.toFixed(2)}`;

  return {
    path,
    waypoints: [wp1, wp2, wp3],
  };
}
