/* =====================================================================
   High Stakes (light): rules only. No DOM, no Three.js, so the browser
   game and the Node simulator (tools/simulate-stakes.mjs) share this file.

   A correct call pays 20 x ODDS x CHARMS. Riskier calls have bigger odds.
   Every charm is a plain multiplier ("Spades pay double"). Reach the
   table's points goal before your calls run out.
   ===================================================================== */

export const BASE_PAY = 20;
export const CALLS = 14;
export const MAX_CHARMS = 5;
// Deals are larger than Classic because a miss is expected here.
export const OPENING_BONUS = 2;
// A miss also takes this share of what the call would have paid off your points.
export const MISS_COST = .5;
// A completed row, column or diagonal pays this many points.
export const LINE_PAY = 20;
// Clearing a table pays tokens, plus a few for every call you didn't need.
export const CLEAR_TOKENS = 40, SPARE_CALL_TOKENS = 2;
export const SUITS = ['♠', '♥', '♦', '♣'];

/* ---------------------------- seeded rng -------------------------- */
export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function makeRng(seed) {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffleWith(rng, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const randomSeed = () => Array.from({length: 6}, () => SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)]).join('');

/* ---------------------------- risk tiers -------------------------- */
export const TIERS = [
  {id: 'safe', name: 'Safe', odds: 1},
  {id: 'fair', name: 'Fair', odds: 2},
  {id: 'bold', name: 'Bold', odds: 4},
  {id: 'long', name: 'Long shot', odds: 8}
];
export function tierOf(p) { return p >= .7 ? TIERS[0] : p >= .5 ? TIERS[1] : p >= .33 ? TIERS[2] : TIERS[3]; }
// Risk buys board space as well as points: a Bold or Long shot win refills a slot.
export const riskRefill = tier => tier.id === 'long' || tier.id === 'bold';

/* ------------------------------ charms ----------------------------
   x(c) returns a multiplier or nothing. c: {card, drawn, dir, slot, tier,
   streak, board, mem, callsLeft}. `drawn` is null in the forecast.
   Growing charms keep a counter in mem: after() runs on a win, cleared()
   when a table is beaten, show() labels the counter.
   ------------------------------------------------------------------ */
const filled = b => b.filter(Boolean).length;
const grow = n => +(n).toFixed(2);
export const CHARMS = [
  {id: 'middling', icon: 'tower', rarity: 1, cost: 45, name: 'Middle Man', desc: '6s, 7s and 8s pay triple.', x: c => c.card.v >= 5 && c.card.v <= 7 && 3},
  {id: 'center', icon: 'sun', rarity: 1, cost: 40, name: 'Center Stage', desc: 'The middle position pays double.', x: c => c.slot === 4 && 2},
  {id: 'downer', icon: 'down', rarity: 1, cost: 40, name: 'Going Down', desc: 'Lower calls pay 1.5×.', x: c => c.dir === 'lower' && 1.5},
  {id: 'riser', icon: 'up', rarity: 1, cost: 40, name: 'Going Up', desc: 'Higher calls pay 1.5×.', x: c => c.dir === 'higher' && 1.5},
  {id: 'steady', icon: 'ward', rarity: 2, cost: 50, name: 'Steady Hand', desc: 'Safe calls pay double.', x: c => c.tier.id === 'safe' && 2},
  {id: 'pairs', icon: 'mirror', rarity: 2, cost: 55, name: 'Double Vision', desc: 'If another card on the table has the same rank, pays triple.', x: c => c.board.filter(x => x && x.v === c.card.v).length > 1 && 3},
  {id: 'shave', icon: 'feather', rarity: 2, cost: 55, name: 'Close Shave', desc: 'Winning by just 1 or 2 ranks pays triple.', x: c => c.drawn && Math.abs(c.drawn.v - c.card.v) <= 2 && 3},
  {id: 'flame', icon: 'flame', rarity: 3, cost: 75, name: 'Pilot Light', desc: 'Each win in your current streak adds 0.25× to every call.', x: c => c.streak && grow(1 + .25 * c.streak)},
  {id: 'daredevil', icon: 'bolt', rarity: 3, cost: 75, name: 'Daredevil', desc: 'Long shots pay triple.', x: c => c.tier.id === 'long' && 3},
  {id: 'gambler', icon: 'dice', rarity: 3, cost: 70, name: 'Nerve', desc: 'Grows: every Long shot you win adds 0.25× to every call, for the rest of the run.', x: c => c.mem.n && grow(1 + .25 * c.mem.n), after: (c, m) => { if (c.tier.id === 'long') m.n = (m.n || 0) + 1; }, show: m => '×' + grow(1 + .25 * (m.n || 0))},
  {id: 'snowball', icon: 'sprout', rarity: 3, cost: 80, name: 'Compounding', desc: 'Grows: every call pays 1.1×, plus 0.2× more for each table you beat.', x: c => grow(1.1 + .2 * (c.mem.n || 0)), cleared: m => { m.n = (m.n || 0) + 1; }, show: m => '×' + grow(1.1 + .2 * (m.n || 0))}
];
export const charmById = Object.fromEntries(CHARMS.map(c => [c.id, c]));

/* ----------------------------- payout ----------------------------- */
export function payout(ctx, ids, memory) {
  const tier = ctx.tier || tierOf(ctx.p), steps = [];
  let x = 1;
  for (const id of ids) {
    const charm = charmById[id], m = charm?.x?.({...ctx, tier, mem: memory[id] || {}});
    if (m && m !== 1) { x *= m; steps.push({id, x: m}); }
  }
  return {tier, odds: tier.odds, x: grow(x), steps, total: Math.round(BASE_PAY * tier.odds * x)};
}
export function afterWin(ctx, ids, memory) { for (const id of ids) charmById[id]?.after?.(ctx, memory[id] ||= {}); }
export function afterTable(ids, memory) { for (const id of ids) charmById[id]?.cleared?.(memory[id] ||= {}); }

/* ------------------------------ goals ----------------------------- */
export const GOALS = [350, 500, 700, 900, 1150, 1450, 1800];
export const LIMITS = [
  {name: 'Normal', desc: 'Start here.', k: 1},
  {name: 'Hard', desc: 'Goals are 40% higher.', k: 1.4},
  {name: 'No limit', desc: 'Goals are 80% higher, and every deck has an extra Joker.', k: 1.8, joker: 1}
];
export const goalFor = (stage, limit = 0) => Math.round(GOALS[stage - 1] * LIMITS[limit].k / 10) * 10;

/* ------------------------------- shop ----------------------------- */
export function freshDeck() { return SUITS.flatMap(s => Array.from({length: 13}, (_, v) => ({v, s}))); }
export function rollCharms(rng, owned, utility, count = 3) {
  const pool = [...CHARMS.map(c => ({id: c.id, w: [0, 6, 4, 2][c.rarity]})), ...utility.map(a => ({id: a.id, w: 2}))].filter(c => !owned.includes(c.id));
  const out = [];
  while (out.length < count && pool.length) {
    let r = rng() * pool.reduce((n, c) => n + c.w, 0), k = 0;
    while (k < pool.length - 1 && (r -= pool[k].w) > 0) k++;
    out.push(pool.splice(k, 1)[0].id);
  }
  return out;
}
