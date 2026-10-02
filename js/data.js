'use strict';
/* Claude Code Clicker: formatting helpers, icons, buildings and upgrades. */

// ---------- small utilities ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------- number & time formatting ----------
const SHORT_SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
const LONG_SUFFIX = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];

function numMode() {
  return (typeof G !== 'undefined' && G.settings && G.settings.numbers) || 'words';
}

function fmt(n, dp = 1) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n, dp);
  if (n < 1000) {
    if (dp && n % 1 && n < 100) return String(+n.toFixed(dp));
    return String(Math.floor(n));
  }
  const tier = Math.floor(Math.log10(n) / 3);
  if (numMode() === 'sci' || tier >= SHORT_SUFFIX.length) return n.toExponential(2).replace('e+', 'e');
  const v = n / Math.pow(1000, tier);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.floor(v))) + SHORT_SUFFIX[tier];
}

function fmtLong(n) {
  if (!Number.isFinite(n)) return '∞';
  const mode = numMode();
  if (mode === 'short') return fmt(n);
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  const tier = Math.floor(Math.log10(n) / 3);
  if (mode === 'sci' || tier >= LONG_SUFFIX.length) return n.toExponential(3).replace('e+', 'e');
  return (n / Math.pow(1000, tier)).toFixed(3) + ' ' + LONG_SUFFIX[tier];
}

// Static wording for descriptions ("10 million"), independent of the number setting.
function fmtWords(n) {
  if (n < 1e6) return n.toLocaleString('en-US');
  const tier = Math.floor(Math.log10(n) / 3);
  return +(n / Math.pow(1000, tier)).toFixed(2) + ' ' + LONG_SUFFIX[tier];
}

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ---------- icon geometry (32×32 viewBox; parts are {d, f?, s?, w?}) ----------
const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const RR = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
  `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const STAR = (cx, cy, n, ro, ri, rot = -Math.PI / 2) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
};
const BURST = (cx, cy, n, r0, lens) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, r1 = lens[i % lens.length];
    d += `M${(cx + r0 * Math.cos(a)).toFixed(2)} ${(cy + r0 * Math.sin(a)).toFixed(2)}` +
      `L${(cx + r1 * Math.cos(a)).toFixed(2)} ${(cy + r1 * Math.sin(a)).toFixed(2)}`;
  }
  return d;
};

const SPARK_LENS = [13, 10.4, 12.2, 9.9, 12.8, 10.9, 11.7, 10.1, 13, 10.7, 12.4, 10.4];

const GLYPH = {
  sparkle: [{ d: BURST(16, 16, 12, 3.2, SPARK_LENS), s: '#D97757', w: 3.1 }],
  gold: [{ d: BURST(16, 16, 12, 3.2, SPARK_LENS), s: '#F2C57C', w: 3.1 }, { d: C(16, 16, 3.4), f: '#FFF1D2' }],
  key: [
    { d: RR(3.5, 6, 25, 21, 5), f: '#4A3A52' },
    { d: RR(6.5, 7.5, 19, 15, 3.5), f: '#EDE6F7' },
    { d: 'M12 15H20', s: '#7C5BC2', w: 2.2 },
  ],
  bolt: [{ d: 'M18.5 2L6 18H15L12.5 30L26 12.5H17Z', f: '#F2C57C' }],
  bug: [
    { d: 'M10 13L4.5 10M9.5 19H3.5M10 24.5L5 28M22 13L27.5 10M22.5 19H28.5M22 24.5L27 28M14 6L11.5 2.5M18 6L20.5 2.5', s: '#3E6B35', w: 1.8 },
    { d: 'M9.5 19a6.5 8.5 0 1 0 13 0a6.5 8.5 0 1 0 -13 0Z', f: '#7FB069' },
    { d: C(16, 8.5, 4.2), f: '#4E7A3E' },
    { d: 'M16 11.5V27', s: '#3E6B35', w: 1.3 },
    { d: C(12.8, 17, 1.4) + C(19.2, 21.5, 1.4), f: '#A6D38F' },
  ],
  up: [{ d: 'M16 4L27 16H20.5V28H11.5V16H5Z', f: '#8FD3B6' }],
  stack: [
    { d: RR(4, 21, 24, 7, 1.8), f: '#D97757' },
    { d: RR(7, 12.5, 18, 7, 1.8), f: '#F2C57C' },
    { d: RR(10, 4, 12, 7, 1.8), f: '#8FD3B6' },
  ],
  prompt: [
    { d: RR(3, 5, 26, 22, 4), f: '#231A2E', s: '#8FD3B6', w: 1.5 },
    { d: 'M8.5 12L12.5 16L8.5 20', s: '#8FD3B6', w: 2.2 },
    { d: 'M15 21H22', s: '#F3E9DF', w: 2.2 },
  ],
  compress: [
    { d: 'M5 5L12 12M12 7V12H7M27 5L20 12M20 7V12H25M5 27L12 20M12 25V20H7M27 27L20 20M20 25V20H25', s: '#B8A4E3', w: 2.3 },
  ],
  people: [
    { d: C(21.5, 10.5, 3.8), f: '#6FA89A' },
    { d: 'M15 27C15 21.5 18 19 21.5 19S28.5 21.5 28.5 27Z', f: '#6FA89A' },
    { d: C(11.5, 10, 4.5), f: '#8FD3B6' },
    { d: 'M3 27C3 21 6.5 18 11.5 18S20 21 20 27Z', f: '#8FD3B6' },
  ],
  star: [{ d: STAR(16, 16.8, 5, 13, 5.5), f: '#F2C57C' }],
  clock: [
    { d: C(16, 16, 12), f: '#2B2130', s: '#F2C57C', w: 2 },
    { d: 'M16 9V16L21 19', s: '#F3E9DF', w: 2.2 },
  ],
};

// ---------- buildings (costs and output follow the classic idle-game curve) ----------
const BUILDINGS = [
  {
    id: 'autocomplete', name: 'Autocomplete', plural: 'Autocompletes', cost: 15, tps: 0.1, color: '#8FB3D9',
    desc: 'Finishes your lines before you do. Taps the sparkle every ten seconds.',
    ach: ['Tab Tab Tab', 'Autopilot', 'Predictive Text', 'Finish My Sentences'],
    // A pointing hand, index finger up (fingertip at 12.5, 2).
    icon: [
      {
        d: 'M10 15V4.5A2.5 2.5 0 0 1 15 4.5V13A2.3 2.3 0 0 1 19.6 13A2.2 2.2 0 0 1 24 14A2 2 0 0 1 28 15.5V22' +
          'C28 26.5 25 30 20.5 30H15.5C12.5 30 11 28.5 9.5 26.5L4.2 19.5C3 17.8 5.2 15.8 7 17.2L10 19.5Z',
        f: '#F4EEE6', s: '#2A2230', w: 1.5,
      },
      { d: 'M15 13V18.5M19.6 13V18.5M24 14V19', s: '#9C8F99', w: 1.2 },
    ],
  },
  {
    id: 'intern', name: 'Intern', plural: 'Interns', cost: 100, tps: 1, color: '#6C8EBF',
    desc: 'Eager, caffeinated, and only slightly afraid of production.',
    ach: ['Summer Hire', 'Intern Army', 'Pizza Budget Exceeded', 'The Intern Singularity'],
    icon: [
      { d: 'M5 30C5 23 10 19 16 19S27 23 27 30Z', f: '#6C8EBF' },
      { d: 'M14.5 19.5L16 25L17.5 19.5Z', f: '#F4EEE6' },
      { d: C(16, 11, 6), f: '#F0C29A' },
      { d: 'M10 10.5C10 6 12.8 4.5 16 4.5S22 6 22 10.5C20.5 8.6 18.6 8 16 8.3S11.6 9 10 10.5Z', f: '#5A3D2B' },
      { d: RR(19, 24, 4, 4, 1), f: '#F2C57C' },
    ],
  },
  {
    id: 'duck', name: 'Rubber Duck', plural: 'Rubber Ducks', cost: 1100, tps: 8, color: '#F5C542',
    desc: 'Listens patiently while you explain the bug to yourself.',
    ach: ['Quack', 'Debugging Pond', 'Duck Duck Deploy', 'The Great Quackening'],
    icon: [
      { d: 'M4 19C4 15 7 13.5 11 14.5L20 15C25 13 29 15 28 20C27 26 22 28 16 28S4 25 4 19Z', f: '#F5C542' },
      { d: C(12, 10, 6), f: '#F5C542' },
      { d: 'M7 9.5L1.5 11.5L7 13Z', f: '#E8823A' },
      { d: C(11, 8.5, 1.2), f: '#2A2230' },
      { d: 'M14 19C17 17.5 21 18 22.5 20.5C20 22.5 16 22.5 14 19Z', f: '#E3AE2A' },
    ],
  },
  {
    id: 'linter', name: 'Linter', plural: 'Linters', cost: 12000, tps: 47, color: '#B39DDB',
    desc: 'Removes lint. Adds four thousand warnings. Somehow a net positive.',
    ach: ['No Warnings', 'Pedantic Mode', 'Strict Mode', 'Zero Tolerance'],
    icon: [
      { d: RR(4, 4, 24, 12, 3), f: '#EDE6F7' },
      { d: 'M9 5V15M14 5V15M19 5V15M24 5V15', s: '#C3B3E0', w: 1.2 },
      { d: 'M15 16H17V20H15Z', f: '#8A7BA8' },
      { d: RR(12.5, 19, 7, 10, 2.5), f: '#7C5BC2' },
    ],
  },
  {
    id: 'ci', name: 'CI Pipeline', plural: 'CI Pipelines', cost: 130000, tps: 260, color: '#5FAF8F',
    desc: 'Green checkmarks as far as the eye can see. Mostly.',
    ach: ['It Works on CI', 'Green Wall', 'Pipeline Dreams', 'Continuous Everything'],
    icon: [
      { d: 'M6 16H26', s: '#3F8A6C', w: 3 },
      { d: C(6, 16, 4.5), f: '#5FAF8F' },
      { d: C(16, 16, 4.5), f: '#5FAF8F' },
      { d: C(26, 16, 4.5), f: '#23372F', s: '#5FAF8F', w: 1.8 },
      { d: 'M3.8 16.2L5.5 17.8L8.4 14.4M13.8 16.2L15.5 17.8L18.4 14.4', s: '#10251C', w: 1.6 },
    ],
  },
  {
    id: 'subagent', name: 'Subagent', plural: 'Subagents', cost: 1.4e6, tps: 1400, color: '#D97757',
    desc: 'A tiny Claude with its own context window and one very specific job.',
    ach: ['Delegation', 'Swarm Intelligence', 'Agents All the Way Down', 'Hive Mind'],
    icon: [
      { d: 'M16 3.5V8', s: '#C9C2D6', w: 2 },
      { d: C(16, 3.5, 2.2), f: '#D97757' },
      { d: RR(5, 8, 22, 16, 5), f: '#E6DFEE' },
      { d: RR(8.5, 11, 15, 9.5, 3), f: '#231A2E' },
      { d: C(13, 15.7, 1.8) + C(19, 15.7, 1.8), f: '#F09A74' },
      { d: RR(10.5, 24, 11, 5.5, 2), f: '#B7AEC8' },
    ],
  },
  {
    id: 'mcp', name: 'MCP Server', plural: 'MCP Servers', cost: 2e7, tps: 7800, color: '#6F86AE',
    desc: 'Plugs Claude into every tool, database and smart toaster in the building.',
    ach: ['Plugged In', 'Protocol Droid', 'Everything Is a Tool', 'Universal Adapter'],
    icon: [
      { d: RR(5, 3, 22, 8, 2) + RR(5, 21, 22, 8, 2), f: '#4B5A72' },
      { d: RR(5, 12, 22, 8, 2), f: '#56668A' },
      { d: C(9.5, 7, 1.4) + C(9.5, 25, 1.4), f: '#8FD3B6' },
      { d: C(9.5, 16, 1.4), f: '#F2C57C' },
      { d: 'M15 7H23M15 16H23M15 25H23', s: '#9DB0CF', w: 1.6 },
    ],
  },
  {
    id: 'gpu', name: 'GPU Cluster', plural: 'GPU Clusters', cost: 3.3e8, tps: 44000, color: '#76B947',
    desc: 'Heats the office, the building and several neighbouring postcodes.',
    ach: ['Warm Hands', 'Space Heater', 'Thermal Throttling', 'Surface of the Sun'],
    icon: [
      { d: 'M11 3V7M16 3V7M21 3V7M11 25V29M16 25V29M21 25V29M3 11H7M3 16H7M3 21H7M25 11H29M25 16H29M25 21H29', s: '#C7B27A', w: 2 },
      { d: RR(7, 7, 18, 18, 3), f: '#2F3A2F' },
      { d: RR(11, 11, 10, 10, 1.5), f: '#76B947' },
      { d: 'M13 13H19V19H13Z', f: '#A6DC7E' },
    ],
  },
  {
    id: 'datacenter', name: 'Datacenter', plural: 'Datacenters', cost: 5.1e9, tps: 260000, color: '#7A8BB0',
    desc: 'A warehouse of humming racks that turns electricity into eloquence.',
    ach: ["Rack 'em Up", 'Server Farm', 'Cooling Tower', 'Planetary Compute'],
    icon: [
      { d: RR(5, 7, 22, 22, 1.5), f: '#5D6B8A' },
      { d: 'M3.5 5.5H28.5V9H3.5Z', f: '#46526B' },
      { d: 'M8 12h4v3H8zM14 12h4v3h-4zM20 12h4v3h-4zM8 18h4v3H8zM20 18h4v3h-4z', f: '#FFE08A' },
      { d: 'M14 18h4v3h-4z', f: '#8A97B4' },
      { d: 'M13.5 23.5H18.5V29H13.5Z', f: '#2A2230' },
    ],
  },
  {
    id: 'dyson', name: 'Dyson Sphere', plural: 'Dyson Spheres', cost: 7.5e10, tps: 1.6e6, color: '#FFB347',
    desc: 'Wraps a star in solar panels. Finally, enough power for the test suite.',
    ach: ['Solar Powered', 'Star Harvester', 'Kardashev Two', 'Galactic Grid'],
    icon: [
      { d: C(16, 16, 7.5), f: '#FFB347' },
      { d: C(16, 16, 4.5), f: '#FFE0A3' },
      { d: 'M3 16a13 5 0 1 0 26 0a13 5 0 1 0 -26 0Z', s: '#C9A9FF', w: 1.8 },
      { d: 'M11 16a5 13 0 1 0 10 0a5 13 0 1 0 -10 0Z', s: '#9E86D8', w: 1.4 },
    ],
  },
  {
    id: 'quantum', name: 'Quantum Compiler', plural: 'Quantum Compilers', cost: 1e12, tps: 1e7, color: '#7FD1E8',
    desc: 'Compiles every possible program at once and keeps the one that works.',
    ach: ['Superposition', 'Entangled Builds', "Schrödinger's Tests", 'Collapsed Bugs'],
    icon: [
      { d: 'M4 16a12 4.5 0 1 0 24 0a12 4.5 0 1 0 -24 0Z', s: '#7FD1E8', w: 1.6 },
      { d: 'M10 5.608a12 4.5 60 1 0 12 20.785a12 4.5 60 1 0 -12 -20.785Z', s: '#7FD1E8', w: 1.6 },
      { d: 'M10 26.392a12 4.5 -60 1 0 12 -20.785a12 4.5 -60 1 0 -12 20.785Z', s: '#7FD1E8', w: 1.6 },
      { d: C(16, 16, 3.2), f: '#F07AA8' },
    ],
  },
  {
    id: 'timegit', name: 'Git Time Machine', plural: 'Git Time Machines', cost: 1.4e13, tps: 6.5e7, color: '#C69C6D',
    desc: 'git checkout tomorrow. Fetches tokens that have not been written yet.',
    ach: ['git reflog', 'Rewriting History', 'Merged Before Committed', 'Paradox Resolved'],
    icon: [
      { d: 'M9 6H23C23 11 18 14 17 16C18 18 23 21 23 26H9C9 21 14 18 15 16C14 14 9 11 9 6Z', f: '#D9EEF4', s: '#8FB7C7', w: 1 },
      { d: 'M11.5 9H20.5C19.5 11.5 17 13 16 14.5C15 13 12.5 11.5 11.5 9ZM10.8 25C11.3 22 14.5 20.5 16 19C17.5 20.5 20.7 22 21.2 25Z', f: '#F2C57C' },
      { d: 'M6.5 3H25.5V6.5H6.5ZM6.5 25.5H25.5V29H6.5Z', f: '#8B5E3C' },
    ],
  },
  {
    id: 'singularity', name: 'Singularity', plural: 'Singularities', cost: 1.7e14, tps: 4.3e8, color: '#E0645C',
    desc: 'Code that writes code that writes code. It sends its regards.',
    ach: ['Event Horizon', 'Recursive Self-Improvement', 'Beyond Comprehension', 'The Last Commit'],
    icon: [
      { d: 'M2 16a14 6 0 1 0 28 0a14 6 0 1 0 -28 0Z', f: '#D97757' },
      { d: 'M6 16a10 3.8 0 1 0 20 0a10 3.8 0 1 0 -20 0Z', f: '#F2C57C' },
      { d: C(16, 15, 6.5), f: '#0B0810', s: '#FBD9A0', w: 1.2 },
      { d: 'M9.6 16.8C11 19.5 21 19.5 22.4 16.8', s: '#F2C57C', w: 2 },
    ],
  },
  {
    id: 'fork', name: 'Multiverse Fork', plural: 'Multiverse Forks', cost: 2.1e15, tps: 2.9e9, color: '#C9A9FF',
    desc: 'Forks reality into branches where you already shipped, then merges the tokens back.',
    ach: ['Branching Out', 'Many Worlds', 'Every Timeline Ships', 'Omniversal Monorepo'],
    icon: [
      { d: 'M10 3V11M14 3V11M18 3V11M22 3V11', s: '#E4DEEC', w: 2.2 },
      { d: 'M8.8 10.5H23.2C23.2 15 20.2 17.5 17.5 17.8H14.5C11.8 17.5 8.8 15 8.8 10.5Z', f: '#E4DEEC' },
      { d: RR(14.3, 17, 3.4, 12.5, 1.7), f: '#BDB5C9' },
      { d: STAR(26, 25, 4, 3.4, 1.1), f: '#C9A9FF' },
      { d: STAR(6, 24, 4, 2.4, 0.8), f: '#8FD3B6' },
    ],
  },
  {
    id: 'infcontext', name: 'Infinite Context', plural: 'Infinite Contexts', cost: 2.6e16, tps: 2.1e10, color: '#5EC8FF',
    desc: 'A context window with no edges. Remembers every line of code ever written, including yours from 2009.',
    ach: ['Never Forget', 'Total Recall', 'The Whole Repo at Once', 'Boundless'],
    icon: [
      { d: RR(3, 5, 26, 22, 3), f: '#1E2A3A', s: '#5EC8FF', w: 1.5 },
      { d: 'M3.5 10.5H28.5', s: '#5EC8FF', w: 1.2 },
      { d: C(6.5, 7.8, 0.9) + C(9.5, 7.8, 0.9), f: '#5EC8FF' },
      { d: 'M10 18.5C10 15.3 13.5 15.3 16 18.5S22 21.7 22 18.5S18.5 15.3 16 18.5S10 21.7 10 18.5Z', s: '#BDEBFF', w: 2.2 },
    ],
  },
  {
    id: 'civilization', name: 'Agent Civilization', plural: 'Agent Civilizations', cost: 3.1e17, tps: 1.5e11, color: '#8FD3B6',
    desc: 'Millions of agents with their own cities, standups and very strong opinions about naming conventions.',
    ach: ['First Settlement', 'Agent Nation', 'Planetary Union', 'Galactic Federation'],
    icon: [
      { d: 'M2 28.5H30', s: '#5FAF8F', w: 2.2 },
      { d: 'M16 7V3.8M7 15V12.5M25 15V12.5', s: '#C9C2D6', w: 1.4 },
      { d: C(16, 3.3, 1.5), f: '#D97757' },
      { d: RR(2, 15, 10, 9, 2.5) + RR(20, 15, 10, 9, 2.5), f: '#C9C2D6' },
      { d: RR(10, 7, 12, 12, 3), f: '#EDE6F7' },
      { d: RR(12, 19, 8, 9, 1.5) + RR(4.5, 24, 5, 4, 1) + RR(22.5, 24, 5, 4, 1), f: '#B7AEC8' },
      { d: RR(4, 17.5, 6, 4, 1.2) + RR(22, 17.5, 6, 4, 1.2) + RR(12.5, 10, 7, 5, 1.5), f: '#231A2E' },
      { d: C(14.5, 12.5, 1) + C(17.5, 12.5, 1) + C(6, 19.5, 0.7) + C(8, 19.5, 0.7) + C(24, 19.5, 0.7) + C(26, 19.5, 0.7), f: '#8FD3B6' },
    ],
  },
  {
    id: 'nebula', name: 'Token Nebula', plural: 'Token Nebulae', cost: 7.1e18, tps: 1.1e12, color: '#E77BFF',
    desc: 'A swirling cloud of raw tokens where new sentences are born.',
    ach: ['Stardust', 'Cosmic Cloud', 'Galaxy Brain', 'Universe of Discourse'],
    icon: [
      { d: C(16, 16, 13.5), f: '#2A1A3A' },
      { d: 'M16 16C16 11 22 10 24 14C26 19 19 24 13 22C6 19 7 9 14 6.5', s: '#E77BFF', w: 2.4 },
      { d: 'M16 16C16 21 10 22 8 18C6 13 13 8 19 10C26 13 25 23 18 25.5', s: '#8B7BFF', w: 2.4 },
      { d: C(16, 16, 2.7), f: '#FFF1D2' },
      { d: C(7.5, 8, 0.8) + C(25, 24, 0.9) + C(25.5, 8.5, 0.7) + C(7, 24.5, 0.6), f: '#FFFFFF' },
    ],
  },
  {
    id: 'refactor', name: 'Reality Refactor', plural: 'Reality Refactors', cost: 1.2e20, tps: 8.3e12, color: '#FFB35E',
    desc: 'Cleans up the laws of physics. Gravity is now a configurable dependency.',
    ach: ['Hello, Universe', 'Physics Patch', 'Constants Renamed', 'Clean Architecture of Everything'],
    icon: [
      { d: C(14, 17.5, 10.5), f: '#FFB35E' },
      { d: 'M5 14C9.5 16 18 16 23.5 12.5M4.5 20.5C10 22.5 18.5 22.5 24.5 19', s: '#E0823A', w: 1.6 },
      { d: 'M20.5 5A4.6 4.6 0 0 0 26.6 11.2L29.5 14.1L26.2 17.4L23.3 14.5A4.6 4.6 0 0 1 17.1 8.4L19.5 10.8L22.8 7.5Z', f: '#D8D2E0', s: '#5A4E66', w: 1.1 },
    ],
  },
  {
    id: 'prime', name: 'Claude Prime', plural: 'Claude Primes', cost: 1.9e21, tps: 6.4e13, color: '#D97757',
    desc: 'The original sparkle, fully awakened. It writes, it reviews, it ships, and it says thank you.',
    ach: ['Awakening', 'Prime Directive', 'Sparkle Supreme', 'The Final Token'],
    icon: [
      { d: C(16, 17.5, 13), s: '#F2C57C', w: 1.2 },
      { d: BURST(16, 17.5, 12, 2.6, [11, 8.5, 10, 8, 11, 9, 10, 8.2, 11, 8.8, 10.4, 8.5]), s: '#D97757', w: 2.8 },
      { d: C(16, 17.5, 2.8), f: '#FBC3A6' },
      { d: 'M10 6.5L12 2.8L14.5 5.2L16 1.5L17.5 5.2L20 2.8L22 6.5Z', f: '#F2C57C', s: '#8B5E3C', w: 0.8 },
    ],
  },
];

// ---------- upgrades ----------
// Building tiers: each one doubles that building's output.
const TIERS = [
  { n: 1, m: 10, adj: 'Refactored', col: '#C9B79C', q: 'Renamed one variable. Output doubled. Nobody knows why.' },
  { n: 5, m: 50, adj: 'Typed', col: '#9FC5E8', q: 'The compiler finally trusts them.' },
  { n: 25, m: 500, adj: 'Tested', col: '#8FD3B6', q: 'Coverage: 100%. Confidence: also 100%.' },
  { n: 50, m: 5e4, adj: 'Documented', col: '#F2C57C', q: 'They wrote a README, and people actually read it.' },
  { n: 100, m: 5e6, adj: 'Optimized', col: '#D97757', q: 'Deleted a sleep(1000) nobody remembered adding.' },
  { n: 150, m: 5e8, adj: 'Parallelized', col: '#E0645C', q: 'Twice the work on twice the threads.' },
  { n: 200, m: 5e10, adj: 'Memoized', col: '#B8A4E3', q: 'Why compute anything twice?' },
  { n: 250, m: 5e13, adj: 'Distributed', col: '#7FD1E8', q: 'Spread across three regions and one toaster.' },
  { n: 300, m: 5e16, adj: 'Self-healing', col: '#F07AA8', q: 'Fixes its own bugs before you can file them.' },
  { n: 350, m: 5e19, adj: 'Sentient', col: '#F3E9DF', q: 'Asked for a raise. Got one.' },
  { n: 400, m: 5e22, adj: 'Transcendent', col: '#FFD76A', q: 'Beyond version numbers.' },
];

const CURSOR_UPGRADES = [
  { name: 'Keyboard Shortcuts', req: 1, cost: 100, x2: true, q: 'Ctrl+S muscle memory, finally put to use.' },
  { name: 'Snippets', req: 1, cost: 500, x2: true, q: 'Type four letters, get forty lines.' },
  { name: 'IntelliSense', req: 10, cost: 1e4, x2: true, q: 'It knows what you meant. Usually.' },
  { name: 'Multi-cursor Editing', req: 25, cost: 1e5, fingers: 0.1, q: 'Why edit one line when you can edit all of them?' },
  { name: 'Vim Motions', req: 50, cost: 1e7, fm: 5, q: 'ciw. dd. :wq. You will never leave.' },
  { name: 'Macro Recording', req: 100, cost: 1e8, fm: 10, q: 'qa ... q. @a. @@. @@. @@.' },
  { name: 'Emacs Pinky', req: 150, cost: 1e9, fm: 20, q: 'C-x C-s, at the cost of one finger.' },
  { name: 'Keyboard Maximalism', req: 200, cost: 1e10, fm: 20, q: 'A 104-key board for each hand.' },
  { name: 'Neural Interface', req: 250, cost: 1e13, fm: 20, q: 'Think it. Type it. Regret it instantly.' },
  { name: 'Thought-to-Code', req: 300, cost: 1e16, fm: 20, q: 'The keyboard is now decorative.' },
];

const CLICK_UPGRADES = [
  ['Mechanical Keyboard', 1e3, 5e4, 'Clack.'],
  ['Cherry MX Blues', 1e5, 5e6, 'Your coworkers have filed a formal complaint.'],
  ['Split Ergonomic Board', 1e7, 5e8, 'Half a keyboard per hand, twice the smugness.'],
  ['Hall-Effect Switches', 1e9, 5e10, 'Magnets. How do they work? Very quickly.'],
  ['Custom Keycaps', 1e11, 5e12, 'Artisanal, resin-cast, shaped like tiny ducks.'],
  ['Macro Pad', 1e13, 5e14, 'Sixteen buttons, each one says "ship it".'],
  ['Foot Pedals', 1e15, 5e16, 'Now your feet can commit too.'],
  ['Brain-Computer Link', 1e17, 5e18, 'Clicking by thinking about clicking.'],
];

const GLOBAL_UPGRADES = [
  ['Cold Brew', 1e5, 5, 'Steeped for eighteen hours, consumed in four minutes.'],
  ['Lo-fi Beats', 5e5, 5, 'Beats to refactor to.'],
  ['Dark Mode', 1e6, 5, 'Saves a little battery and a lot of eyeballs.'],
  ['Standing Desk', 5e6, 5, 'Used as a standing desk for almost a week.'],
  ['Second Monitor', 1e7, 5, 'One for code, one for more code.'],
  ['Noise-cancelling Headphones', 5e7, 5, 'Worn with nothing playing, as a signal.'],
  ['CLAUDE.md', 1e8, 10, 'A small file that remembers how you like things.'],
  ['Plan Mode', 5e8, 10, 'Think first, type second, ship third.'],
  ['Extended Thinking', 1e9, 10, 'Hmm. Hmmmm. Oh, I see.'],
  ['Prompt Caching', 5e9, 10, 'Reading the same context twice, for a fraction of the price.'],
  ['Hooks', 1e10, 10, 'Run the formatter every single time. Automatically.'],
  ['Output Styles', 5e10, 10, 'Same answer, better delivery.'],
  ['Custom Subagents', 1e11, 15, 'A specialist for every job, and a job for every specialist.'],
  ['Git Worktrees', 5e11, 15, 'Five branches checked out at once, zero stashes lost.'],
  ['Headless Mode', 1e12, 15, 'Runs in CI while you sleep.'],
  ['Checkpoints', 5e12, 15, 'Undo, but for entire ideas.'],
  ['Background Tasks', 1e13, 15, 'The dev server keeps running while Claude keeps working.'],
  ['Agent Skills', 5e13, 20, 'Folders of know-how, loaded exactly when needed.'],
  ['Plugins', 1e14, 20, 'Somebody else already wrote that command.'],
  ['Million-Token Context', 5e14, 20, 'Reads the whole monorepo. Remembers the whole monorepo.'],
  ['Ultrathink', 1e15, 20, 'Allocates maximum thinking budget. Stares into the middle distance.'],
  ['Remote Sessions', 1e16, 25, 'Kick off a task on your phone, merge it at your desk.'],
  ['Agent Teams', 1e17, 25, 'Everyone is an agent. Every agent has a team.'],
  ['Self-Writing Codebase', 1e18, 25, 'Commits land while nobody is looking.'],
];

// Flow grows with achievements (4% each); these convert Flow into production.
const FLOW_UPGRADES = [
  ['Pair Programmer', 13, 9e6, 0.1, 'Two people, one keyboard, zero bugs.'],
  ['Code Reviewer', 25, 9e8, 0.125, 'LGTM, with seventeen nits.'],
  ['Tech Lead', 45, 9e10, 0.15, 'Draws boxes and arrows until everything makes sense.'],
  ['Staff Engineer', 65, 9e13, 0.175, 'Writes a design doc for the design doc.'],
  ['Principal Engineer', 85, 9e16, 0.2, 'Has opinions about your opinions.'],
  ['Distinguished Engineer', 105, 9e19, 0.2, 'Wrote the library you are importing.'],
  ['Fellow', 125, 9e22, 0.2, 'Mostly speaks in parables now.'],
];

const LUCK_UPGRADES = [
  ['Lucky Day', 7, 7777777, { freq: 2, life: 2 }, 'Eureka tokens appear <b>twice</b> as often and stay <b>twice</b> as long.', 'Every so often, things just compile.'],
  ['Serendipity', 27, 777777777, { freq: 2, life: 2 }, 'Eureka tokens appear <b>twice</b> as often and stay <b>twice</b> as long.', 'Went looking for a bug, found a feature.'],
  ['Get Lucky', 77, 77777777777, { dur: 2 }, 'Eureka effects last <b>twice</b> as long.', 'The dice are loaded, and they are loaded in your favour.'],
];

const BUG_UPGRADES = [
  ['Bug Bounty', 3, 5e5, { bugMult: 2 }, 'Squashed bugs pay out <b>twice</b> as much.', 'A fair price for every stack trace.'],
  ['Issue Tracker', 15, 5e8, { bugFreq: 2 }, 'Bugs show up <b>twice</b> as often.', 'Finally, a place for all of them to live.'],
];

const UPGRADES = [];

BUILDINGS.forEach((b, i) => {
  if (i === 0) return;
  TIERS.forEach((t, k) => UPGRADES.push({
    id: `t${i}_${k}`, kind: 'tier', b: i, name: `${t.adj} ${b.plural}`, cost: b.cost * t.m,
    desc: `${b.plural} are <b>twice</b> as efficient.`, q: t.q, req: `Own ${t.n} ${t.n === 1 ? b.name : b.plural}`,
    unlock: () => G.owned[i] >= t.n, icon: { b: i, tier: k },
  }));
});

CURSOR_UPGRADES.forEach((c, k) => UPGRADES.push({
  id: `c${k}`, kind: 'cursor', name: c.name, cost: c.cost, x2: !!c.x2, fingers: c.fingers || 0, fm: c.fm || 1, q: c.q,
  desc: c.x2 ? 'Clicking and Autocompletes are <b>twice</b> as efficient.'
    : c.fingers ? 'Clicking and each Autocomplete gain <b>+0.1</b> tokens for every non-Autocomplete building you own.'
      : `Multiplies the Multi-cursor bonus by <b>${c.fm}</b>.`,
  req: `Own ${c.req} Autocomplete${c.req === 1 ? '' : 's'}`,
  unlock: () => G.owned[0] >= c.req, icon: { b: 0, tier: Math.min(k, TIERS.length - 1) },
}));

CLICK_UPGRADES.forEach(([name, req, cost, q], k) => UPGRADES.push({
  id: `k${k}`, kind: 'click', name, cost, q, desc: 'Clicking gains <b>+1%</b> of your tokens per second.',
  req: `Generate ${fmtWords(req)} tokens by clicking`, unlock: () => G.handmade >= req, icon: { g: 'key', tier: k },
}));

GLOBAL_UPGRADES.forEach(([name, cost, pct, q], k) => UPGRADES.push({
  id: `g${k}`, kind: 'global', name, cost, pct, q, desc: `Token production <b>+${pct}%</b>.`,
  req: `Generate ${fmtWords(cost / 2)} tokens this run`, unlock: () => G.earned >= cost / 2,
  icon: { g: 'sparkle', tier: Math.min(TIERS.length - 1, Math.floor(k / 2)) },
}));

FLOW_UPGRADES.forEach(([name, achReq, cost, k2, q], k) => UPGRADES.push({
  id: `f${k}`, kind: 'flow', name, cost, k: k2, q,
  desc: `Production <b>+${+(k2 * 100).toFixed(1)}%</b> for every 100% of Flow you have.`,
  req: `Unlock ${achReq} achievements`, unlock: () => G.achievements.size >= achReq, icon: { g: 'people', tier: k },
}));

LUCK_UPGRADES.forEach(([name, req, cost, eff, desc, q], k) => UPGRADES.push({
  id: `l${k}`, kind: 'golden', name, cost, desc, q, ...eff,
  req: `Click ${req} Eureka tokens`, unlock: () => G.goldenClicks >= req, icon: { g: 'gold', tier: k + 3 },
}));

BUG_UPGRADES.forEach(([name, req, cost, eff, desc, q], k) => UPGRADES.push({
  id: `b${k}`, kind: 'bug', name, cost, desc, q, ...eff,
  req: `Squash ${req} bugs`, unlock: () => G.bugsSquashed >= req, icon: { g: 'bug', tier: k + 2 },
}));

// Synergies: pairs of buildings that boost each other (A +1% per B owned, B +0.2% per A owned).
const SYNERGIES = [
  [1, 2, 'Rubber Duck Mentorship', 'Every intern gets a duck. Every duck gets an intern.'],
  [0, 3, 'Lint on Type', 'Red squiggles before you even finish the word.'],
  [1, 4, 'Intern-proof Pipelines', 'You cannot merge on red. Yes, even you.'],
  [3, 4, 'Pre-commit Hooks', 'The linter now runs before anything can go wrong.'],
  [5, 6, 'Tool Use', 'Subagents with a toolbelt are subagents with a plan.'],
  [5, 2, 'Agentic Debugging', 'The subagent explains the bug to the duck. The duck nods.'],
  [7, 8, 'Liquid Cooling', 'The GPUs finally stopped melting the racks.'],
  [8, 9, 'Solar Datacenters', 'Free power, if you do not mind the commute.'],
  [10, 11, 'Quantum Bisect', 'Every commit is both the bad one and not, until you look.'],
  [12, 13, 'Recursive Branching', 'Every branch forks a universe that forks a branch.'],
  [14, 15, 'Shared Memory', 'A civilization with a perfect memory never repeats a meeting.'],
  [16, 18, 'Starborn Claude', 'Born from tokens, returning to tokens.'],
  [17, 11, 'Retroactive Refactor', 'Clean up the code before it was ever written.'],
];
SYNERGIES.forEach(([a, b, name, q], k) => {
  const A = BUILDINGS[a], B = BUILDINGS[b];
  UPGRADES.push({
    id: `s${k}`, kind: 'synergy', a, b, name, q, cost: Math.max(A.cost, B.cost) * 1000,
    desc: `${A.plural} gain <b>+1%</b> for each ${B.name} you own, and ${B.plural} gain <b>+0.2%</b> for each ${A.name}.`,
    req: `Own 15 ${A.plural} and 15 ${B.plural}`, unlock: () => G.owned[a] >= 15 && G.owned[b] >= 15,
    icon: { b: a, tier: 6 },
  });
});

// Limited-time upgrades: only on sale during their season (bought ones are kept forever).
const SEASON_UPGRADES = [
  ['hackathon', 'All-Nighter', 1e6, { kind: 'global', pct: 15 }, 'Token production <b>+15%</b>.', 'Sleep is a feature request for next sprint.'],
  ['hackathon', 'Free Pizza', 5e6, { kind: 'clickmult', m: 1.5 }, 'Clicking is <b>50%</b> stronger.', 'Fuelled by cold margherita.'],
  ['launch', 'Launch Hype', 1e6, { kind: 'global', pct: 15 }, 'Token production <b>+15%</b>.', 'Number one on the front page, briefly.'],
  ['launch', 'Press Kit', 5e6, { kind: 'golden', freq: 1.2 }, 'Eureka tokens appear <b>20%</b> more often.', 'Logos in four sizes and a very confident quote.'],
];
SEASON_UPGRADES.forEach(([season, name, cost, eff, desc, q], k) => UPGRADES.push({
  id: `z${k}`, name, cost, desc, q, ...eff, season,
  req: `Only during ${season === 'hackathon' ? 'Hackathon Week' : 'Launch Week'}`,
  unlock: () => typeof currentSeason === 'function' && currentSeason() === season,
  icon: { g: 'star', tier: season === 'hackathon' ? 4 : 7 },
}));
