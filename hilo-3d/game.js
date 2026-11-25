import * as THREE from 'three';
import {makeBossMachines} from './boss-machines.js';
import {makeRegister, makeFlexibleCard} from './tollkeeper.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================================
   HiLo — Midnight Table
   Gameplay rules are unchanged from the original build. Everything in
   this file that touches G (state) mirrors the original logic; the rest
   is presentation: scene, cards, HUD and screens.
   ===================================================================== */

const $ = id => document.getElementById(id);
const html = str => { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content.firstElementChild; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Cosmetic randomness never touches gameplay's Math.random shuffles.
let cseed = 90210;
const crand = () => ((cseed = (Math.imul(cseed, 1664525) + 1013904223) >>> 0) / 4294967296);

/* ----------------------------- fonts ------------------------------ */
await Promise.race([
  Promise.all([document.fonts.load('100px Anton'), document.fonts.load('800 40px Outfit'), document.fonts.load('600 40px Outfit'), document.fonts.load('900 100px "Playfair Display"'), document.fonts.load('900 40px Cinzel'), document.fonts.load('40px "Racing Sans One"')]),
  new Promise(r => setTimeout(r, 2500))
]).catch(() => {});

/* ----------------------------- icons ------------------------------ */
const ICONS = {
  chip:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  deck:'<rect x="8" y="3" width="12" height="16" rx="2"/><path d="M5 6.5v12A2.5 2.5 0 0 0 7.5 21H16"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  flame:'<path d="M12 2.8c.9 3.7 5.2 5.6 5.2 10.5a5.2 5.2 0 0 1-10.4.1c0-2.4 1.2-4 2.5-5.1.2 2 1 3 2.1 3.3C10.9 8.9 11 6 12 2.8z"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.6" cy="8.6" r="1.1" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="15.4" cy="8.6" r="1.1" fill="currentColor"/><circle cx="8.6" cy="15.4" r="1.1" fill="currentColor"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.6"/>',
  restart:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.6h4.6"/>',
  vs:'<path d="M3.5 6l3.6 12L10.7 6M20.2 7.6c-.8-1-2-1.6-3.3-1.6-1.9 0-3.3 1-3.3 2.8 0 3.9 6.8 2.4 6.8 6.4 0 1.8-1.5 2.8-3.5 2.8-1.4 0-2.7-.6-3.5-1.6"/>',
  up:'<path d="M12 20V5M5.5 11.5L12 5l6.5 6.5"/>',
  down:'<path d="M12 4v15M5.5 12.5L12 19l6.5-6.5"/>',
  push:'<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>',
  shield:'<path d="M12 3l7.5 3v5.6c0 4.6-3.1 7.9-7.5 9.4-4.4-1.5-7.5-4.8-7.5-9.4V6z"/>',
  ward:'<path d="M12 3l7.5 3v5.6c0 4.6-3.1 7.9-7.5 9.4-4.4-1.5-7.5-4.8-7.5-9.4V6z"/><path d="M8.6 12.2l2.3 2.3 4.6-4.8"/>',
  eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  swap:'<path d="M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>',
  coins:'<ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z"/>',
  feather:'<path d="M20 4c-7.5 0-13 5.4-13.6 13.4M20 4c.3 7.4-4.6 12.6-11.8 13.2M6.4 17.4L4 20M10.5 13.5h5.2M13 9.8h5"/>',
  mirror:'<ellipse cx="12" cy="9.5" rx="6" ry="6.5"/><path d="M12 16v5M9 21h6M9.5 8a3 3 0 0 1 2.5-2.4"/>',
  clover:'<circle cx="12" cy="7.6" r="3.4"/><circle cx="16.4" cy="12" r="3.4"/><circle cx="12" cy="16.4" r="3.4"/><circle cx="7.6" cy="12" r="3.4"/><path d="M14.6 14.6L19 21"/>',
  hourglass:'<path d="M6 3h12M6 21h12M7.5 3v2.5c0 3 4.5 4.5 4.5 6.5s-4.5 3.5-4.5 6.5V21M16.5 3v2.5c0 3-4.5 4.5-4.5 6.5s4.5 3.5 4.5 6.5V21"/>',
  lantern:'<path d="M9.5 3h5M12 3v2.5M8.5 7.5h7l1 2v8.5l-1 2.5h-7l-1-2.5V9.5zM13 10.5l-2.4 3.5h2.8L11 17.5"/>',
  anchor:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 13.5a7 7 0 0 0 14 0M8.5 10h7M3.5 13.5h3M17.5 13.5h3"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  map:'<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20"/>',
  diamond:'<path d="M6.5 4h11l4 5.5L12 20.5 2.5 9.5zM2.5 9.5h19M9 4l3 16.5L15 4"/>',
  waves:'<path d="M3 9c2.2-3 6.8-3 9 0s6.8 3 9 0M3 15.5c2.2-3 6.8-3 9 0s6.8 3 9 0"/>',
  bolt:'<path d="M13.5 2.5L4.5 14h7l-1 7.5 9-11.5h-7z"/>',
  coin:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.4"/><path d="M12 9.2v5.6"/>',
  sprout:'<path d="M12 21v-8.5M12 12.5C12 8.6 9 6 4.5 6c0 4 3 6.5 7.5 6.5zM12 14.5c0-3.4 2.6-5.8 7.5-5.8 0 3.6-3.2 5.8-7.5 5.8z"/>',
  tower:'<path d="M8 21l1.6-11h4.8L16 21M7 10h10M8.5 10V6.5L12 4l3.5 2.5V10M9.2 15.5h5.6"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  trophy:'<path d="M8 21h8M12 16.5V21M7 3.5h10V9a5 5 0 0 1-10 0zM7 5.5H4v1.8A3.2 3.2 0 0 0 7.2 10.5M17 5.5h3v1.8a3.2 3.2 0 0 1-3.2 3.2"/>',
  bust:'<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>',
  grid:'<rect x="4" y="4" width="4.3" height="4.3" rx="1"/><rect x="9.85" y="4" width="4.3" height="4.3" rx="1"/><rect x="15.7" y="4" width="4.3" height="4.3" rx="1"/><rect x="4" y="9.85" width="4.3" height="4.3" rx="1"/><rect x="9.85" y="9.85" width="4.3" height="4.3" rx="1"/><rect x="15.7" y="9.85" width="4.3" height="4.3" rx="1"/><rect x="4" y="15.7" width="4.3" height="4.3" rx="1"/><rect x="9.85" y="15.7" width="4.3" height="4.3" rx="1"/><rect x="15.7" y="15.7" width="4.3" height="4.3" rx="1"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  reroll:'<path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6M4.5 12a7.5 7.5 0 0 1 13.4-4.6"/><path d="M18.3 3.5v4.2h-4.2M5.7 20.5v-4.2h4.2"/>',
  play:'<path d="M7.5 4.8v14.4L19 12z" fill="currentColor"/>',
  book:'<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
  back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const icon = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const SUIT_D = {
  '♥':'M50 90C22 68 4 50 4 31 4 16 15 6 28 6c9 0 17 5 22 14C55 11 63 6 72 6c13 0 24 10 24 25 0 19-18 37-46 59z',
  '♦':'M50 3C60 22 74 38 90 50 74 62 60 78 50 97 40 78 26 62 10 50 26 38 40 22 50 3z',
  '♠':'M50 4C62 24 94 38 94 61c0 13-10 22-22 22-8 0-14-4-18-9 1 9 5 16 12 22H34c7-6 11-13 12-22-4 5-10 9-18 9C16 83 6 74 6 61 6 38 38 24 50 4z'
};
const suitSVG = s => s === '♣'
  ? '<svg class="suit" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="28" r="21"/><circle cx="29" cy="58" r="21"/><circle cx="71" cy="58" r="21"/><path d="M44 44h12v14H44zM55 58c0 16 5 28 13 38H32c8-10 13-22 13-38z"/></svg>'
  : `<svg class="suit" viewBox="0 0 100 100" aria-hidden="true"><path d="${SUIT_D[s]}"/></svg>`;

/* ----------------------------- data ------------------------------- */
const S = ['♠','♥','♦','♣'], R = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const ARTIFACTS=[
{id:'compass',icon:'compass',name:'The Compass',desc:'Every fifth correct guess grants a Swap.',cost:45},
{id:'phoenix',icon:'feather',name:'Phoenix Feather',desc:'Every third consecutive success refills an empty board slot.',cost:65},
{id:'mirror',icon:'mirror',name:'Mirror Trick',desc:'Once each stage, a normal missed guess leaves its card intact.',cost:75},
{id:'clover',icon:'clover',name:'Lucky Clover',desc:'Your first win at 35% odds or less each stage refills one empty slot.',cost:55},
{id:'timekeeper',icon:'hourglass',name:'Timekeeper',desc:'Every tenth correct guess gives a Peek token.',cost:50},
{id:'storm',icon:'lantern',name:'Storm Lantern',desc:'Each three-win streak milestone grants a Swap.',cost:55},
{id:'anchor',icon:'anchor',name:'Iron Anchor',desc:'Begin each stage with one extra board card.',cost:60},
{id:'salvage',icon:'wrench',name:'Salvage Kit',desc:'Your first unsaved miss per stage restores one empty slot.',cost:55},
{id:'ember',icon:'sun',name:'Ember Engine',desc:'Reaching a five-win streak grants a Peek.',cost:65},
{id:'collector',icon:'map',name:'Treasure Map',desc:'New completed lines grant 6 additional Pit Stop tokens.',cost:65},
{id:'diamond',icon:'diamond',name:'Diamond Eye',desc:'Successful predictions at 35% odds or less earn 5 extra tokens.',cost:55},
{id:'twin',icon:'waves',name:'Twin Signals',desc:'Filling all nine board slots also grants a Swap.',cost:70}
];
const UPGRADES=[
{id:'ward',icon:'ward',name:'Ward',desc:'First miss on this position per stage is blocked.',cost:35},
{id:'amp',icon:'bolt',name:'Amplifier',desc:'Every third correct guess here earns 12 extra tokens.',cost:35},
{id:'kindle',icon:'flame',name:'Kindling',desc:'Correct guesses here grant an extra streak step.',cost:45},
{id:'mint',icon:'coin',name:'Mint',desc:'Correct guesses here earn 3 extra Pit Stop tokens.',cost:35},
{id:'seed',icon:'sprout',name:'Seedbed',desc:'Every third successful guess here refills a board slot.',cost:40},
{id:'scout',icon:'tower',name:'Watchtower',desc:'Every fourth successful guess here earns a Peek.',cost:40}
];
const UPGRADE_COLORS={ward:0x66cfff,amp:0xc18aff,kindle:0xff8854,mint:0x57e0c0,seed:0xa4dc65,scout:0xf1a5dc};
const hex = n => '#' + n.toString(16).padStart(6, '0');
const TICKETS=[
{id:'lucky',icon:'star',name:'Lucky Ticket',desc:'Start each stage with one Swap.'},
{id:'fire',icon:'flame',name:'Fire Ticket',desc:'Each seven-win streak milestone grants a Peek.'},
{id:'risk',icon:'dice',name:'Risk Ticket',desc:'Wins at 40% odds or less earn 6 extra tokens.'}
];
const BOSSES=[
{id:'toll',name:'The Tollkeeper',desc:'Each lost position costs 10 tokens. Unpaid tolls come out of future earnings.',start:3,jokers:2},
{id:'collector',name:'The Collector',desc:'Unprotected misses lock empty positions, up to three per stage.',start:2,jokers:2},
{id:'sharp',name:'The Cardsharp',desc:'Every fourth guess is a Double Draw: both cards must be higher, or both lower, than your card. The tray lights up one guess early.',start:2,jokers:2},
{id:'elevator',name:'The Elevator Operator',desc:'The board runs as three lanes. The lowest card in each column is playable. In the left column, losing the front card opens the one behind it.',start:3,jokers:2},
{id:'roller',name:'The High Roller',desc:'One card is the stake. Win on it to refill an empty slot. Miss and lose the stake and its marked neighbor too.',start:3,jokers:2},
{id:'house',name:'The House',desc:'Stamp all four suits before the deck runs out. A correct guess stamps the suit of the card you played.',start:2,jokers:2},
{id:'driver',name:'The Final Driver',desc:'Finish the deck with at least two occupied cards. Four Jokers await.',start:1,jokers:4}
];
const FINAL=BOSSES.length;
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const brief = {
 'Lucky Ticket':'+1 Swap each stage','Fire Ticket':'7-win streak → Peek','Risk Ticket':'Low odds → +6 tokens',
 'The Compass':'5 correct → Swap','Phoenix Feather':'3-win streak → refill','Mirror Trick':'First miss saved each stage',
 'Lucky Clover':'First low-odds win → refill','Timekeeper':'10 correct → Peek','Storm Lantern':'3-win streak → Swap',
 'Iron Anchor':'+1 starting board card','Salvage Kit':'First lost card → refill','Ember Engine':'5-win streak → Peek',
 'Treasure Map':'Completed line → +6 tokens','Diamond Eye':'Low odds → +5 tokens','Twin Signals':'Full board → Swap',
 'Ward':'Blocks the first miss here','Amplifier':'3 correct here → +12 tokens','Kindling':'Extra streak step here',
 'Mint':'+3 tokens per correct guess','Seedbed':'3 correct here → refill','Watchtower':'4 correct here → Peek'
};
const BOSS_PRESENTATION = [
 {id:'toll',mark:'♠',name:'The Tollkeeper',rule:'Each lost position costs 10 tokens. Unpaid tolls carry forward.',accent:'#e8c27a',felt:'#1f5a36',light:0xffcf94,notes:[110,164.81,220],
  base:0x3a1d0e,rail:[0x2c170b,.55,0],trim:[0xc99a4c,.3,1],band:[0xb8893f,.32,1],chips:[['#d8a73e','#8a6420','coin'],['#c9973a','#7a5618','coin'],['#e0b44c','#94692a','coin']]},
 {id:'collector',mark:'♦',name:'The Collector',rule:'Lost positions lock. Up to three.',accent:'#cfd8e3',felt:'#1a2a52',light:0xe2ebff,notes:[98,146.83,207.65],
  base:0x23272d,rail:[0x6d7680,.32,.9],trim:[0xe3e9f0,.2,1],band:[0xa3acb6,.28,1],chips:[['#c9d0d8','#4a5563','chip'],['#1b2a52','#c9d0d8','chip'],['#8e98a4','#20262e','chip']]},
 {id:'sharp',mark:'♥',name:'The Cardsharp',rule:'Every fourth guess is a Double Draw. Watch the tray.',accent:'#e0b866',felt:'#51182a',light:0xffd6b8,notes:[103.83,155.56,207.65],
  base:0x2a0c1e,rail:[0x431421,.90,0],trim:[0xc99a4c,.3,1],band:[0xb8893f,.32,1],chips:[['#5a1a46','#e0b866','chip'],['#e0b866','#3b1230','chip'],['#1a1216','#e0b866','chip']]},
 {id:'elevator',mark:'♣',name:'The Elevator Operator',rule:'Three lanes. Only the front card of each lane plays.',accent:'#e2c06a',felt:'#103a3b',light:0xfff0c8,notes:[92.5,138.59,185],
  base:0x0d2526,rail:[0x234843,.32,.45],trim:[0xd8b45a,.28,1],band:[0xc9a24a,.3,1],chips:[['#1f5a58','#e2c06a','chip'],['#e2c06a','#123c3c','chip'],['#efe6d0','#1f5a58','chip']]},
 {id:'roller',mark:'♦',name:'The High Roller',rule:'Win the stake to refill. Miss it and lose two.',accent:'#f2c35a',felt:'#1c1722',light:0xffe2b4,notes:[116.54,174.61,233.08],
  base:0x3a080d,rail:[0x690f10,.16,.3],trim:[0xf0c35a,.22,1],band:[0xe0b04a,.24,1],chips:[['#e0b04a','#6a0f18','coin'],['#141418','#f2c35a','chip'],['#9e1622','#f7e6c0','chip']]},
 {id:'house',mark:'♠',name:'The House',rule:'Stamp all four suits before the deck runs out.',accent:'#d4b06a',felt:'#163a25',light:0xfff0d4,notes:[87.31,130.81,174.61],
  base:0x251f15,rail:[0x6a5634,.42,.85],trim:[0xc9a35a,.3,1],band:[0xa8874a,.35,1],chips:[['#efe6d0','#163a25','chip'],['#163a25','#efe6d0','chip'],['#1a1612','#d4b06a','chip']]},
 {id:'driver',mark:'♣',name:'The Final Driver',rule:'Finish with at least two cards. Four Jokers.',accent:'#ff4a3d',felt:'#62121f',light:0xffc0b0,notes:[82.41,123.47,174.61],
  base:0x0b0b0d,rail:[0x18181b,.22,.35],trim:[0xd8202c,.25,.6],band:[0xc4c8ce,.2,1],chips:[['#d8202c','#ffffff','chip'],['#141418','#ff4a3d','chip'],['#e8e8ea','#141418','chip']]}
];
const PORTRAIT = {toll:'coin',collector:'collector',sharp:'classic',elevator:'classic',roller:'coin',house:'classic',driver:'racing'};


/* --------------------------- renderer ----------------------------- */
const isSmall = Math.min(innerWidth, innerHeight) < 600;
let quality = (() => { try { const q = localStorage.getItem('hilo-quality'); if (q) return q === 'high'; } catch (e) {} return !isSmall; })();
const renderer = new THREE.WebGLRenderer({canvas: $('scene'), antialias: true, alpha: true, powerPreference: 'high-performance'});
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
const camera = new THREE.PerspectiveCamera(28, 1, .1, 200);

/* ---------------------------- layout ------------------------------ */
const CW = 1.17, CH = 1.65, CT = .024, FELT_Y = .70, CARD_Y = FELT_Y + CT / 2 + .004;
const slots = Array.from({length: 9}, (_, i) => ({x: (i % 3 - 1) * 1.54, z: Math.floor(i / 3) * 1.9 - 1.76}));
const deckX = 3.3, deckZ = -1.76, discardX = 3.3, discardZ = 2.04, chipX = 3.3, chipZ = .14;
const FW = 7.3, FD = 6.9, FCX = .86, FCZ = .14;
const VIEW = {minX: FCX - FW / 2 - .5, maxX: FCX + FW / 2 + .5, minZ: FCZ - FD / 2 - .5, maxZ: FCZ + FD / 2 + .5};
const lookTarget = new THREE.Vector3(FCX, .7, FCZ);
const camBase = new THREE.Vector3();
let playRect = {x: 0, y: 0, w: innerWidth, h: innerHeight};

function computePlayRect() {
  const W = innerWidth, H = innerHeight;
  const top = $('topbar').getBoundingClientRect(), pan = $('panel').getBoundingClientRect();
  const side = pan.height > H * .5 && pan.width < W * .5;
  const r = side
    ? {x: 10, y: top.bottom + 6, w: pan.left - 24, h: H - top.bottom - 16}
    : {x: 4, y: top.bottom + 2, w: W - 8, h: pan.top - top.bottom - 6};
  r.w = Math.max(140, r.w); r.h = Math.max(140, r.h);
  return r;
}
function positionCamera() {
  const W = innerWidth, H = innerHeight;
  playRect = computePlayRect();
  const portrait = playRect.w / playRect.h < 1.1;
  const elev = THREE.MathUtils.degToRad(portrait ? 70 : 54);
  const corners = [];
  for (const x of [VIEW.minX, VIEW.maxX]) for (const z of [VIEW.minZ, VIEW.maxZ]) for (const y of [.25, .95]) corners.push(new THREE.Vector3(x, y, z));
  const cx = playRect.x + playRect.w / 2, cy = playRect.y + playRect.h / 2;
  let dist = 22, sx = 0, sy = 0;
  const v = new THREE.Vector3();
  for (let it = 0; it < 6; it++) {
    camBase.set(lookTarget.x, lookTarget.y + dist * Math.sin(elev), lookTarget.z + dist * Math.cos(elev));
    camera.position.copy(camBase); camera.lookAt(lookTarget);
    const ox = cx + sx, oy = cy + sy;
    const Fw = 2 * Math.max(ox, W - ox, 1), Fh = 2 * Math.max(oy, H - oy, 1);
    camera.aspect = Fw / Fh;
    camera.setViewOffset(Fw, Fh, Fw / 2 - ox, Fh / 2 - oy, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of corners) {
      v.copy(c).project(camera);
      const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    dist *= Math.max((x1 - x0) / (playRect.w * .98), (y1 - y0) / (playRect.h * .98));
    sx += cx - (x0 + x1) / 2; sy += cy - (y0 + y1) / 2;
  }
}
function resizeScene() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality ? 2 : 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = quality;
  positionCamera();
}

/* --------------------------- textures ----------------------------- */
function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  paint(canvas.getContext('2d'), canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const SUIT_PATH = {
  '♥': new Path2D(SUIT_D['♥']), '♦': new Path2D(SUIT_D['♦']), '♠': new Path2D(SUIT_D['♠']),
  '♣': (() => { const p = new Path2D(); for (const [x, y] of [[50, 28], [29, 58], [71, 58]]) { p.moveTo(x + 21, y); p.arc(x, y, 21, 0, Math.PI * 2); } p.rect(44, 44, 12, 14); p.moveTo(55, 58); p.bezierCurveTo(55, 74, 60, 86, 68, 96); p.lineTo(32, 96); p.bezierCurveTo(40, 86, 45, 74, 45, 58); p.closePath(); return p; })()
};
function suitAt(g, s, x, y, size, color, flip = false) {
  g.save(); g.translate(x, y); if (flip) g.rotate(Math.PI);
  const k = size / 100; g.scale(k, k); g.translate(-50, -50);
  g.fillStyle = color; g.fill(SUIT_PATH[s]); g.restore();
}
function starPath(g, cx, cy, R1, r1, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rad = i % 2 ? r1 : R1; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  g.closePath();
}
const CARD_W = 512, CARD_H = 716, RED = '#c51f38', BLK = '#15203a', GOLD = '#d9a944';
let artBoss = 'toll'; // which boss style new card faces are painted in
const INK = '#1c1916', SKIN = '#f1d7b2', GOLDI = '#d4a240';
function bustPath(g) {
  g.beginPath(); g.moveTo(408, 250); g.bezierCurveTo(390, 226, 330, 222, 300, 250); g.bezierCurveTo(284, 266, 280, 290, 276, 312);
  g.lineTo(254, 352); g.lineTo(276, 362); g.lineTo(272, 384); g.lineTo(282, 392); g.bezierCurveTo(280, 412, 290, 428, 318, 436);
  g.bezierCurveTo(330, 440, 350, 440, 372, 430); g.lineTo(380, 470); g.lineTo(436, 470); g.bezierCurveTo(446, 410, 452, 296, 408, 250); g.closePath();
}
function paintPortrait(g, card, style, ink) {
  const red = ink === RED, cloth = red ? '#b3262c' : '#24304d', trim = style === 'racing' ? '#e8e8ea' : GOLDI;
  const fillStroke = (fill, w = 6) => { g.fillStyle = fill; g.fill(); g.lineWidth = w; g.strokeStyle = INK; g.stroke(); };
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  // shoulders
  g.beginPath(); g.moveTo(176, 700); g.bezierCurveTo(186, 560, 250, 500, 320, 486); g.lineTo(430, 486); g.bezierCurveTo(476, 500, 500, 560, 504, 700); g.closePath(); fillStroke(cloth);
  if (style === 'racing') { // checkered racing collar
    g.save(); g.beginPath(); g.moveTo(300, 492); g.lineTo(450, 492); g.lineTo(470, 560); g.lineTo(280, 560); g.closePath(); g.clip();
    for (let x = 270; x < 480; x += 18) for (let y = 488; y < 566; y += 18) { g.fillStyle = ((x - 270) / 18 + (y - 488) / 18) % 2 ? '#f4f0e8' : INK; g.fillRect(x, y, 18, 18); }
    g.restore(); g.beginPath(); g.moveTo(300, 492); g.lineTo(450, 492); g.lineTo(470, 560); g.lineTo(280, 560); g.closePath(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  } else { g.beginPath(); g.moveTo(330, 488); g.lineTo(372, 560); g.lineTo(420, 488); fillStroke(trim, 5); }
  // hood behind the head (Collector's queen)
  if (style === 'collector' && card.v === 11) { g.beginPath(); g.moveTo(262, 520); g.bezierCurveTo(230, 360, 260, 200, 360, 196); g.bezierCurveTo(470, 196, 486, 330, 470, 520); g.closePath(); fillStroke(red ? '#9a1f25' : '#2a3658'); }
  // long hair for queens
  if (card.v === 11 && style !== 'collector') { g.beginPath(); g.moveTo(330, 236); g.bezierCurveTo(440, 220, 480, 320, 468, 480); g.lineTo(400, 480); g.bezierCurveTo(410, 400, 400, 330, 360, 300); g.closePath(); fillStroke(style === 'racing' ? '#c8913a' : '#5a3418'); }
  bustPath(g); fillStroke(SKIN);
  g.beginPath(); g.ellipse(386, 342, 14, 22, .1, 0, 7); fillStroke(SKIN, 4);
  g.lineWidth = 5; g.beginPath(); g.moveTo(286, 318); g.lineTo(306, 316); g.stroke(); g.beginPath(); g.moveTo(282, 300); g.lineTo(310, 296); g.stroke();
  g.beginPath(); g.moveTo(276, 380); g.lineTo(288, 378); g.stroke();
  if (card.v === 12) { g.beginPath(); g.moveTo(282, 390); g.bezierCurveTo(284, 440, 306, 470, 340, 470); g.bezierCurveTo(372, 470, 384, 440, 384, 400); g.lineTo(350, 392); g.lineTo(310, 380); g.closePath(); fillStroke(style === 'racing' ? '#d9d9dc' : '#6b4424'); }
  // headgear
  if (card.v === 12 && style !== 'racing') { // crown
    g.beginPath(); g.moveTo(296, 262); g.lineTo(290, 196); g.lineTo(322, 226); g.lineTo(352, 178); g.lineTo(382, 222); g.lineTo(414, 192); g.lineTo(416, 262); g.closePath(); fillStroke(GOLDI, 5);
    for (const [x, y] of [[290, 194], [352, 176], [414, 190]]) { g.beginPath(); g.arc(x, y, 8, 0, 7); fillStroke(red ? '#c8303a' : '#3b5aa8', 4); }
  } else if (card.v === 12) { // driver king: swept hair + shades
    g.beginPath(); g.moveTo(296, 270); g.bezierCurveTo(300, 210, 380, 196, 440, 236); g.bezierCurveTo(430, 260, 410, 266, 400, 300); g.lineTo(300, 272); g.closePath(); fillStroke('#e6e6e8', 5);
  } else if (card.v === 11 && style !== 'collector' && style !== 'racing') { g.beginPath(); g.moveTo(300, 254); g.bezierCurveTo(320, 214, 380, 212, 402, 246); g.lineTo(392, 256); g.lineTo(304, 262); g.closePath(); fillStroke(GOLDI, 5); g.beginPath(); g.arc(350, 228, 9, 0, 7); fillStroke(red ? '#c8303a' : '#3b5aa8', 4); }
  else if (card.v === 10 && style !== 'racing') { // flat cap
    g.beginPath(); g.moveTo(268, 272); g.bezierCurveTo(260, 222, 330, 200, 400, 214); g.bezierCurveTo(440, 224, 446, 262, 430, 284); g.lineTo(300, 272); g.closePath(); fillStroke(style === 'collector' ? '#2b2f36' : '#3a2a1c');
    g.beginPath(); g.moveTo(240, 286); g.quadraticCurveTo(262, 266, 300, 272); g.lineTo(296, 284); g.closePath(); fillStroke(INK, 4);
  } else if (style === 'racing') { // racing cap / helmet with goggles
    g.beginPath(); g.moveTo(290, 276); g.bezierCurveTo(286, 214, 360, 196, 420, 220); g.bezierCurveTo(450, 240, 452, 290, 436, 320); g.lineTo(400, 300); g.lineTo(296, 280); g.closePath(); fillStroke(card.v === 10 ? '#c8202a' : '#d9a23c', 5);
  }
  if (style === 'racing') { // goggles / shades
    if (card.v === 12) { g.beginPath(); g.roundRect(270, 300, 70, 26, 8); fillStroke('#141418', 4); g.beginPath(); g.moveTo(340, 312); g.lineTo(388, 318); g.lineWidth = 6; g.stroke(); }
    else { for (const x of [312, 356]) { g.beginPath(); g.arc(x, 252, 20, 0, 7); fillStroke('#9fd4ea', 5); } g.lineWidth = 6; g.beginPath(); g.moveTo(332, 252); g.lineTo(336, 252); g.stroke(); }
  }
  // held prop: coin (Tollkeeper), key (Collector)
  if (style === 'coin' || (style === 'collector' && card.v !== 11)) { g.beginPath(); g.arc(260, 570, 40, 0, 7); fillStroke(GOLDI, 5); g.beginPath(); g.arc(260, 570, 27, 0, 7); g.lineWidth = 3; g.stroke(); g.beginPath(); g.ellipse(296, 590, 26, 18, -.5, 0, 7); fillStroke(SKIN, 5); }
  if (style === 'collector' && card.v === 11) { g.lineWidth = 12; g.strokeStyle = GOLDI; g.beginPath(); g.moveTo(250, 640); g.lineTo(250, 540); g.stroke(); g.beginPath(); g.arc(250, 522, 22, 0, 7); g.lineWidth = 9; g.stroke(); g.fillStyle = GOLDI; g.fillRect(250, 610, 24, 10); g.fillRect(250, 628, 18, 10); g.beginPath(); g.ellipse(268, 584, 26, 18, -.4, 0, 7); fillStroke(SKIN, 5); }
  g.restore();
}
function cardFace(g, card) {
  const joker = !!card.joker;
  const paper = g.createLinearGradient(0, 0, CARD_W, CARD_H);
  paper.addColorStop(0, '#fbf3e2'); paper.addColorStop(1, '#ecdfc4');
  g.fillStyle = paper; g.fillRect(0, 0, CARD_W, CARD_H);
  // print grain
  g.fillStyle = 'rgba(120,90,40,.05)'; for (let i = 0; i < 900; i++) g.fillRect(crand() * 512, crand() * 716, 2, 2);
  g.strokeStyle = 'rgba(120,90,40,.25)'; g.lineWidth = 3; rr(g, 16, 16, 480, 684, 30); g.stroke();
  const ink = joker ? '#6a2d9a' : (card.s === '♥' || card.s === '♦') ? RED : '#16140f';
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (joker) {
    paintPanel(g, '#7a3bb0', '#2c1149');
    g.save(); g.translate(256, 330);
    for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = i % 2 ? 'rgba(255,214,120,.22)' : 'rgba(255,214,120,.08)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -260); g.lineTo(22, -260); g.closePath(); g.fill(); }
    g.restore();
    starPath(g, 256, 320, 120, 50); g.fillStyle = '#ffd36b'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#3d1660'; g.stroke();
    g.textAlign = 'center'; g.font = '96px Anton'; g.fillStyle = '#ffe7a8'; g.fillText('JOKER', 256, 580);
    starPath(g, 60, 80, 34, 14); g.fillStyle = ink; g.fill();
    return;
  }
  const r = R[card.v];
  if (card.v >= 10) {
    paintPortrait(g, card, PORTRAIT[artBoss], ink);
    g.fillStyle = ink; g.font = '900 168px "Playfair Display", Georgia, serif'; g.fillText(r, 34, 176);
    suitAt(g, card.s, 92, 250, 92, ink);
  } else {
    g.fillStyle = ink; g.font = `900 ${r.length > 1 ? 196 : 236}px "Playfair Display", Georgia, serif`; g.fillText(r, 40, 246);
    suitAt(g, card.s, 318, 498, 270, ink);
  }
}
function paintPanel(g, top, bottom) {
  const x = 112, y = 74, w = 288, h = 568;
  const grad = g.createLinearGradient(0, y, 0, y + h); grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.save(); rr(g, x, y, w, h, 26); g.fillStyle = grad; g.fill(); g.restore();
  g.strokeStyle = GOLD; g.lineWidth = 6; rr(g, x, y, w, h, 26); g.stroke();
}
const tex = card => canvasTexture(CARD_W, CARD_H, g => cardFace(g, card));
function paintBack(g, id) {
  const frame = (base, line, rim) => {
    g.fillStyle = rim; g.fillRect(0, 0, 512, 716);
    rr(g, 18, 18, 476, 680, 26); g.fillStyle = base; g.fill();
    g.strokeStyle = line; g.lineWidth = 4; rr(g, 40, 40, 432, 636, 16); g.stroke(); g.lineWidth = 1.5; rr(g, 52, 52, 408, 612, 12); g.stroke();
  };
  if (id === 'toll') {
    frame('#1d4a2c', '#d8ad5a', '#14301d');
    const v = g.createRadialGradient(256, 358, 30, 256, 358, 380); v.addColorStop(0, 'rgba(255,230,160,.14)'); v.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = v; g.fillRect(18, 18, 476, 680);
    g.strokeStyle = '#d8ad5a'; g.fillStyle = '#d8ad5a';
    for (let side of [-1, 1]) for (let k = 0; k < 11; k++) { const a = Math.PI / 2 + side * (.35 + k * .22); g.save(); g.translate(256 + Math.cos(a) * 140, 370 + Math.sin(a) * 140); g.rotate(a + side * 1.1); g.beginPath(); g.ellipse(0, 0, 9, 22, 0, 0, 7); g.fill(); g.restore(); }
    g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(256, 280); g.lineTo(256, 440); g.moveTo(186, 300); g.lineTo(326, 300); g.moveTo(216, 470); g.lineTo(296, 470); g.moveTo(256, 440); g.lineTo(256, 470); g.stroke();
    g.lineWidth = 2.5; for (const x of [186, 326]) { g.beginPath(); g.moveTo(x, 300); g.lineTo(x - 30, 380); g.moveTo(x, 300); g.lineTo(x + 30, 380); g.stroke(); g.beginPath(); g.ellipse(x, 380, 34, 12, 0, 0, Math.PI); g.fill(); }
    starPath(g, 256, 266, 16, 7); g.fill();
    starPath(g, 256, 112, 14, 6); g.fill(); starPath(g, 256, 604, 14, 6); g.fill();
  } else if (id === 'collector') {
    frame('#15214a', '#c9d2dc', '#0d1430');
    g.save(); g.translate(256, 358); g.strokeStyle = 'rgba(201,210,220,.45)'; g.lineWidth = 2;
    for (let i = 0; i < 64; i++) { g.rotate(Math.PI / 32); g.beginPath(); g.moveTo(0, 70); g.lineTo(0, i % 2 ? 170 : 220); g.stroke(); }
    g.restore();
    g.fillStyle = '#dfe5ec'; g.beginPath(); g.arc(256, 330, 50, 0, 7); g.fill();
    g.beginPath(); g.moveTo(232, 360); g.lineTo(280, 360); g.lineTo(296, 452); g.lineTo(216, 452); g.closePath(); g.fill();
    g.fillStyle = '#0d1430'; g.beginPath(); g.arc(256, 330, 24, 0, 7); g.fill(); g.beginPath(); g.moveTo(246, 340); g.lineTo(266, 340); g.lineTo(276, 420); g.lineTo(236, 420); g.closePath(); g.fill();
    for (const [x, y] of [[70, 70], [442, 70], [70, 646], [442, 646]]) { g.fillStyle = '#c9d2dc'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
  } else if (id === 'sharp') {
    frame('#3b1230', '#e0b866', '#24081c');
    g.save(); rr(g, 52, 52, 408, 612, 12); g.clip();
    g.fillStyle = '#c99a4c'; g.beginPath(); g.moveTo(256, 52); g.lineTo(460, 52); g.lineTo(460, 664); g.lineTo(256, 664); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,20,40,.35)'; g.lineWidth = 2; for (let d = -700; d < 700; d += 14) { g.beginPath(); g.moveTo(256 + d, 52); g.lineTo(256 + d + 612, 664); g.stroke(); g.beginPath(); g.moveTo(256 + d + 612, 52); g.lineTo(256 + d, 664); g.stroke(); }
    g.restore();
    for (const [w, col, lw] of [[150, '#e0b866', 8], [110, '#3b1230', 6], [70, '#e0b866', 5]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(256, 358 - w * 1.4); g.lineTo(256 + w, 358); g.lineTo(256, 358 + w * 1.4); g.lineTo(256 - w, 358); g.closePath(); g.stroke(); }
    g.fillStyle = '#f6e7c4'; g.beginPath(); g.moveTo(256, 310); g.lineTo(286, 358); g.lineTo(256, 406); g.lineTo(226, 358); g.closePath(); g.fill();
  } else if (id === 'elevator') {
    frame('#123c3c', '#e2c06a', '#0a2626');
    g.save(); g.translate(256, 420); g.strokeStyle = 'rgba(226,192,106,.55)'; g.lineWidth = 3;
    for (let k = 0; k <= 12; k++) { const a = Math.PI + k / 12 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); g.lineTo(Math.cos(a) * 170, Math.sin(a) * 170); g.stroke(); }
    g.lineWidth = 5; for (const rad of [60, 170, 190]) { g.beginPath(); g.arc(0, 0, rad, Math.PI, 0); g.stroke(); }
    g.restore();
    g.fillStyle = '#e2c06a'; g.beginPath(); g.moveTo(256, 300); g.lineTo(290, 350); g.lineTo(222, 350); g.closePath(); g.fill();
    g.strokeStyle = '#e2c06a'; g.lineWidth = 4; g.strokeRect(150, 440, 212, 150); g.beginPath(); g.moveTo(256, 440); g.lineTo(256, 590); g.stroke();
    for (let x = 160; x < 360; x += 16) { g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 450); g.lineTo(x, 580); g.stroke(); }
  } else if (id === 'roller') {
    frame('#0f0d0b', '#f2c35a', '#2a0508');
    g.save(); g.translate(256, 380); g.strokeStyle = 'rgba(242,195,90,.35)'; g.lineWidth = 3;
    for (let k = 0; k < 28; k++) { const a = -Math.PI + k / 27 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * 110, Math.sin(a) * 110); g.lineTo(Math.cos(a) * 300, Math.sin(a) * 300); g.stroke(); }
    g.restore();
    const chipAt = (x, y, n) => { for (let k = n - 1; k >= 0; k--) { g.fillStyle = '#b98a2e'; g.beginPath(); g.ellipse(x, y - k * 14 + 6, 48, 18, 0, 0, 7); g.fill(); g.fillStyle = '#f2c35a'; g.beginPath(); g.ellipse(x, y - k * 14, 48, 18, 0, 0, 7); g.fill(); g.strokeStyle = '#6a4a12'; g.lineWidth = 2; g.stroke(); } };
    chipAt(196, 470, 4); chipAt(316, 480, 3); chipAt(256, 420, 5);
    g.font = '900 40px Cinzel, Georgia'; g.textAlign = 'center'; g.fillStyle = '#f2c35a'; g.fillText('HIGH ROLLER', 256, 600);
  } else if (id === 'house') {
    frame('#f1e6cc', '#1d1a14', '#d8c9a4');
    g.strokeStyle = 'rgba(29,26,20,.35)'; g.lineWidth = 1.5;
    for (let y = 70; y < 650; y += 22) for (let x = 70; x < 450; x += 22) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke(); }
    g.fillStyle = '#f1e6cc'; g.beginPath(); g.arc(256, 358, 150, 0, 7); g.fill();
    g.strokeStyle = '#1d1a14'; g.lineWidth = 5; g.beginPath(); g.arc(256, 358, 150, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(256, 358, 136, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(256, 230); g.lineTo(256, 486); g.moveTo(128, 358); g.lineTo(384, 358); g.stroke();
    [['♥', 256, 278], ['♠', 196, 358], ['♣', 316, 358], ['♦', 256, 438]].forEach(([su, x, y]) => suitAt(g, su, x, y, 58, '#1d1a14'));
  } else {
    frame('#111114', '#d8202c', '#2a2a2e');
    for (const y0 of [60, 616]) for (let row = 0; row < 2; row++) for (let x = 0; x < 13; x++) { g.fillStyle = (x + row) % 2 ? '#d8202c' : '#141418'; g.fillRect(52 + x * 31.4, y0 + row * 20, 31.4, 20); }
    g.save(); g.translate(256, 380);
    g.lineCap = 'round'; g.strokeStyle = '#3a3a40'; g.lineWidth = 18; g.beginPath(); g.arc(0, 0, 150, Math.PI * .8, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#d8202c'; g.beginPath(); g.arc(0, 0, 150, Math.PI * 1.85, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#f2f2f2'; for (let k = 0; k <= 16; k++) { const a = Math.PI * .8 + k / 16 * Math.PI * 1.4; g.lineWidth = k % 2 ? 2 : 5; g.beginPath(); g.moveTo(Math.cos(a) * 118, Math.sin(a) * 118); g.lineTo(Math.cos(a) * (k % 2 ? 128 : 136), Math.sin(a) * (k % 2 ? 128 : 136)); g.stroke(); }
    g.rotate(Math.PI * 1.95); g.fillStyle = '#ff3b30'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(0, -132); g.lineTo(8, 0); g.closePath(); g.fill();
    g.restore(); g.fillStyle = '#e8e8ea'; g.beginPath(); g.arc(256, 380, 16, 0, 7); g.fill();
    g.font = 'italic 44px "Racing Sans One", Anton'; g.textAlign = 'center'; g.fillStyle = '#f2f2f2'; g.fillText('HI·LO', 256, 470);
  }
}
const backTextures = BOSS_PRESENTATION.map(t => canvasTexture(CARD_W, CARD_H, g => paintBack(g, t.id)));
const backTex = backTextures[0];

// soft white glow shapes (tinted per use)
function glowCanvas(w, h, draw) { return canvasTexture(w, h, g => { g.shadowColor = '#fff'; g.shadowOffsetX = 2000; draw(g, -2000); }); }
const glowTex = glowCanvas(256, 320, (g, o) => { g.shadowBlur = 38; g.fillStyle = '#fff'; rr(g, 60 + o, 62, 136, 196, 18); g.fill(); g.shadowBlur = 14; g.fill(); });
const ringTex = glowCanvas(256, 320, (g, o) => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.shadowBlur = 16; rr(g, 40 + o, 40, 176, 240, 20); g.stroke(); g.shadowBlur = 4; g.stroke(); });
const dotTex = canvasTexture(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const barTex = glowCanvas(512, 64, (g, o) => { g.shadowBlur = 16; g.fillStyle = '#fff'; rr(g, 30 + o, 24, 452, 16, 8); g.fill(); g.shadowBlur = 6; g.fill(); });
const lockTex = canvasTexture(256, 256, g => {
  g.strokeStyle = '#ff6b5e'; g.fillStyle = 'rgba(255,90,80,.16)'; g.lineWidth = 14; g.lineCap = 'round'; g.lineJoin = 'round';
  rr(g, 58, 116, 140, 104, 18); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(88, 116); g.lineTo(88, 88); g.arc(128, 88, 40, Math.PI, 0); g.lineTo(168, 116); g.stroke();
  g.fillStyle = '#ff6b5e'; g.beginPath(); g.arc(128, 160, 12, 0, 7); g.fill(); g.fillRect(122, 160, 12, 30);
});

/* ---------------------------- table ------------------------------- */
const mat = (color, roughness = .8, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, metalness, ...extra});
function roundedPath(path, w, d, r) {
  const x = w / 2, y = d / 2;
  path.moveTo(-x + r, -y);
  path.lineTo(x - r, -y); path.quadraticCurveTo(x, -y, x, -y + r);
  path.lineTo(x, y - r); path.quadraticCurveTo(x, y, x - r, y);
  path.lineTo(-x + r, y); path.quadraticCurveTo(-x, y, -x, y - r);
  path.lineTo(-x, -y + r); path.quadraticCurveTo(-x, -y, -x + r, -y);
  path.closePath(); return path;
}
function remapUV(geo, w, h) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  uv.needsUpdate = true; return geo;
}
function slab(w, d, r, depth, bevel, hole) {
  const s = roundedPath(new THREE.Shape(), w, d, r);
  if (hole) s.holes.push(roundedPath(new THREE.Path(), ...hole));
  const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 20});
  g.rotateX(-Math.PI / 2); return g;
}
function addMesh(geo, material, x, y, z, {cast = false, receive = true} = {}) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive; scene.add(m); return m;
}
const woodMat = mat(0x2a160d, .55, 0, {envMapIntensity: .5});
const leatherMat = mat(0x1a120e, .62, 0, {envMapIntensity: .6});
const brassMat = mat(0xc9a050, .28, 1, {envMapIntensity: 1.2});
const trimMat = mat(0xc9a050, .3, 1, {envMapIntensity: 1.2, emissive: 0xff6a1a, emissiveIntensity: 0});
const walnut = new THREE.TextureLoader().load(new URL('./art/walnut.jpg',import.meta.url).href);
walnut.colorSpace = THREE.SRGBColorSpace;
walnut.wrapS = walnut.wrapT = THREE.MirroredRepeatWrapping;
const walnutAmount = {value:0};
for (const rail of [woodMat,leatherMat]) {
  rail.onBeforeCompile = shader => {
    shader.uniforms.walnutMap = {value:walnut}; shader.uniforms.walnutAmount = walnutAmount;
    shader.vertexShader = 'varying vec3 timberPos;\n' + shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntimberPos = position;');
    shader.fragmentShader = 'uniform sampler2D walnutMap; uniform float walnutAmount; varying vec3 timberPos;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float side = smoothstep(-.36,.36,abs(timberPos.x)-abs(timberPos.z)-.2);
      vec2 grain = mix(timberPos.xz,timberPos.zx,side)*vec2(.75,2.1);
      vec3 wood = texture2D(walnutMap,grain+vec2(.1,timberPos.y*1.8)).rgb;
      diffuseColor.rgb = mix(diffuseColor.rgb,wood*1.35,walnutAmount);
    `);
  };
}
const feltMat = mat(0xffffff, 1, 0, {envMapIntensity: .25});
addMesh(slab(FW + 1.25, FD + 1.25, 1.05, .45, .05), woodMat, FCX, .08, FCZ, {cast: true});
addMesh(slab(FW + 1.1, FD + 1.1, .98, .14, .07, [FW + .02, FD + .02, .5]), leatherMat, FCX, .66, FCZ, {cast: true});
addMesh(slab(FW + .14, FD + .14, .55, .02, .012, [FW - .02, FD - .02, .48]), trimMat, FCX, .69, FCZ);
addMesh(slab(FW + 1.18, FD + 1.18, 1.02, .015, .008, [FW + 1.04, FD + 1.04, .96]), brassMat, FCX, .83, FCZ);
const feltGeo = remapUV(new THREE.ShapeGeometry(roundedPath(new THREE.Shape(), FW, FD, .5), 16), FW, FD); feltGeo.rotateX(-Math.PI / 2);
const felt = addMesh(feltGeo, feltMat, FCX, FELT_Y, FCZ);
function paintFelt(theme) {
  const ppu = isSmall ? 150 : 190, cw = Math.round(FW * ppu), ch = Math.round(FD * ppu);
  const P = (x, z) => [(x - (FCX - FW / 2)) * ppu, (z - (FCZ - FD / 2)) * ppu];
  return canvasTexture(cw, ch, g => {
    g.fillStyle = theme.felt; g.fillRect(0, 0, cw, ch);
    const img = g.getImageData(0, 0, cw, ch), d = img.data; let seed = 7;
    for (let i = 0; i < d.length; i += 4) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const n = (seed / 4294967296 - .5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    if (theme.id === 'sharp') {
      // Velvet nap catches the lamplight along the cushions.
      for (let edge=0;edge<2;edge++) {
        g.save(); if (edge) {g.translate(cw,ch);g.rotate(Math.PI);}
        for (let band=0;band<7;band++) {
          g.beginPath();g.moveTo(0,band*5);g.bezierCurveTo(cw*.22,15+band*5,cw*.60,band*3,cw,22+band*3);
          g.strokeStyle=band%2?'rgba(255,177,150,.13)':'rgba(51,0,15,.65)';g.lineWidth=2;g.stroke();
        }
        g.restore();
      }
    }
    const [gx, gz] = P(.4, .14);
    const pool = g.createRadialGradient(gx, gz, 40, gx, gz, cw * .62); pool.addColorStop(0, 'rgba(255,240,200,.13)'); pool.addColorStop(.6, 'rgba(0,0,0,0)'); pool.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = pool; g.fillRect(0, 0, cw, ch);
    const acc = theme.accent;
    g.globalAlpha = .55; g.strokeStyle = acc; g.lineWidth = ppu * .02; rr(g, ppu * .16, ppu * .16, cw - ppu * .32, ch - ppu * .32, ppu * .4); g.stroke();
    g.globalAlpha = .3; g.lineWidth = ppu * .008; rr(g, ppu * .22, ppu * .22, cw - ppu * .44, ch - ppu * .44, ppu * .35); g.stroke();
    g.globalAlpha = .05; suitAt(g, theme.mark, ...P(0, .14), ppu * 3.4, '#fff'); g.globalAlpha = 1;
    for (const s of slots) {
      const [x, y] = P(s.x, s.z), w = (CW + .1) * ppu, h = (CH + .1) * ppu;
      rr(g, x - w / 2, y - h / 2, w, h, ppu * .1); g.fillStyle = 'rgba(0,0,0,.2)'; g.fill();
      g.globalAlpha = .35; g.strokeStyle = acc; g.lineWidth = ppu * .012; g.setLineDash([ppu * .06, ppu * .045]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    const label = (text, x, z, size = .17) => { g.font = `600 ${Math.round(size * ppu)}px Outfit`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = acc; g.globalAlpha = .6; g.fillText(text.split('').join(String.fromCharCode(8202)), ...P(x, z)); g.globalAlpha = 1; };
    for (const [x, z] of [[deckX, deckZ], [discardX, discardZ]]) {
      const [px, py] = P(x, z), w = (CW + .14) * ppu, h = (CH + .14) * ppu;
      rr(g, px - w / 2, py - h / 2, w, h, ppu * .12); g.fillStyle = 'rgba(0,0,0,.24)'; g.fill(); g.globalAlpha = .5; g.strokeStyle = acc; g.lineWidth = ppu * .014; g.stroke(); g.globalAlpha = 1;
    }
    label('DECK', deckX, deckZ - CH / 2 - .24); label('DISCARD', discardX, discardZ + CH / 2 + .24); label('TOKENS', chipX, chipZ + .66, .13);
    const [cx, cz] = P(chipX, chipZ); g.globalAlpha = .35; g.strokeStyle = acc; g.lineWidth = ppu * .012; g.beginPath(); g.arc(cx, cz, ppu * .62, 0, 7); g.stroke(); g.globalAlpha = 1;
    g.font = `${Math.round(ppu * .34)}px Anton`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = acc; g.globalAlpha = .5;
    g.fillText('HI · LO', ...P(0, -3.0)); g.globalAlpha = .4; g.font = `600 ${Math.round(ppu * .12)}px Outfit`;
    g.fillText(('MIDNIGHT TABLE  ·  ' + theme.name.toUpperCase()).split('').join(' '), ...P(0, 3.06)); g.globalAlpha = 1;
  });
}
const spot = new THREE.SpotLight(0xffd9a8, 160, 30, .62, .7, 1.4);
spot.position.set(-1.2, 11, 3.2); spot.target.position.set(.6, .6, .1);
spot.castShadow = true; spot.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048); spot.shadow.bias = -.0002; spot.shadow.normalBias = .02; spot.shadow.radius = 4;
const hemi = new THREE.HemisphereLight(0xdbe4ff, 0x1a0f0a, .55);
const fill = new THREE.DirectionalLight(0xbfd8ff, .5); fill.position.set(6, 6, 6);
const warmLight = new THREE.PointLight(0xff7a2c, 0, 14, 1.6); warmLight.position.set(0, 2.2, 1.2);
const jokerLight = new THREE.PointLight(0xb46bff, 0, 10, 1.4); jokerLight.position.set(deckX, 2.4, deckZ);
scene.add(spot, spot.target, hemi, fill, warmLight, jokerLight);

/* ----------------------------- cards ------------------------------ */
const cardShape = () => roundedPath(new THREE.Shape(), CW, CH, .09);
const faceGeo = remapUV(new THREE.ShapeGeometry(cardShape(), 8), CW, CH); faceGeo.rotateX(-Math.PI / 2); faceGeo.translate(0, CT / 2 + .0008, 0);
const backGeo = remapUV(new THREE.ShapeGeometry(cardShape(), 8), CW, CH); backGeo.rotateX(Math.PI / 2); backGeo.translate(0, -CT / 2 - .0008, 0);
const edgeGeo = new THREE.ExtrudeGeometry(cardShape(), {depth: CT, bevelEnabled: false, curveSegments: 8}); edgeGeo.rotateX(-Math.PI / 2); edgeGeo.translate(0, -CT / 2, 0);
const edgeMat = mat(0xf3ecdc, .7);
const backMat = new THREE.MeshStandardMaterial({map: backTex, roughness: .42, metalness: 0, envMapIntensity: .7});
const shieldRingGeo = new THREE.PlaneGeometry(1.62, 2.12).rotateX(-Math.PI / 2);
const flexibleCard = makeFlexibleCard(CW, CH, CT);
function makeCard(card, faceMat) {
  const group = new THREE.Group();
  const face = faceMat || new THREE.MeshBasicMaterial({map: card ? tex(card) : null, toneMapped: false});
  const [front, back, edge] = faceMat ? flexibleCard : [faceGeo,backGeo,edgeGeo];
  const f = new THREE.Mesh(front, face), b = new THREE.Mesh(back, backMat), e = new THREE.Mesh(edge, edgeMat);
  e.castShadow = true; b.castShadow = true;
  group.add(f, b, e); group.userData.face = face; group.userData.ownsFace = !faceMat;
  return group;
}
function disposeCard(m) {
  if (!m) return; scene.remove(m);
  if (m.userData.ownsFace) { m.userData.face.map?.dispose(); m.userData.face.dispose(); }
  if (m.userData.shield) m.userData.shield.material.dispose();
}
let G = null, animations = [], reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, soundOn = true, shopOffers = null, hovered = -1, swapFrom = null;
let discards = [], pile = [], highlights = Array(9).fill(null), feedbackTimeout;
const cardMeshes = Array(9).fill(null);
const deckTopY = () => FELT_Y + deckThick() + CT / 2 + .002;
const PILE_MAX = 8, PILE_STEP = CT + .004, pileY = k => FELT_Y + CT / 2 + .003 + k * PILE_STEP;
function pilePose() {
  const n = Math.min(pile.length + discards.length, PILE_MAX - 1);
  return {pos: new THREE.Vector3(discardX + (crand() - .5) * .14, pileY(n), discardZ + (crand() - .5) * .14), rotY: (crand() - .5) * .55};
}
function tossGroup(m) {
  if (m.userData.shield) m.userData.shield.visible = false;
  const target = pilePose();
  if (reduced) { m.position.copy(target.pos); m.rotation.set(0, target.rotY, 0); addToPile(m); return; }
  discards.push({m, from: m.position.clone(), rz: m.rotation.z, ry: m.rotation.y, target, start: performance.now(), duration: 520});
}
function addToPile(m) { pile.push(m); while (pile.length > PILE_MAX) disposeCard(pile.shift()); pile.forEach((c, k) => { c.position.y = pileY(k); }); }
function tossCard(card, from) {
  const m = makeCard(card); scene.add(m);
  m.position.copy(from || new THREE.Vector3(slots[G.selected]?.x ?? 0, CARD_Y + .6, slots[G.selected]?.z ?? 0));
  tossGroup(m);
}
function clearPile() { for (const m of pile) disposeCard(m); pile = []; for (const d of discards) disposeCard(d.m); discards = []; }
function discardCard(i) {
  const m = cardMeshes[i]; if (!m) return;
  cardMeshes[i] = null; sound('discard'); tossGroup(m);
}
function meshCard(c, i, animate = false, opts = {}) {
  const old = cardMeshes[i];
  if (old) { if (opts.tossOld) tossGroup(old); else disposeCard(old); }
  cardMeshes[i] = null;
  if (!c) return;
  const p = slots[i], m = makeCard(c);
  m.userData.index = i; scene.add(m); cardMeshes[i] = m;
  if (opts.from) { m.position.copy(opts.from); }
  else if (animate && !reduced) { m.position.set(deckX, deckTopY(), deckZ); m.rotation.z = Math.PI; animations.push({m, p, start: performance.now(), duration: 480}); }
  else m.position.set(p.x, CARD_Y, p.z);
  if (animate) sound('deal');
}

/* ------------------------- deck & chips --------------------------- */
const deckUnitGeo = new THREE.ExtrudeGeometry(cardShape(), {depth: 1, bevelEnabled: false, curveSegments: 8}); deckUnitGeo.rotateX(-Math.PI / 2);
const deckSideTex = canvasTexture(16, 256, g => { g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 16, 256); g.fillStyle = 'rgba(120,100,70,.35)'; for (let y = 0; y < 256; y += 6) g.fillRect(0, y, 16, 1); });
const deckBody = addMesh(deckUnitGeo, mat(0xf0e7d3, .85), deckX, FELT_Y, deckZ, {cast: true});
const deckTop = new THREE.Mesh(faceGeo, backMat); deckTop.position.set(deckX, FELT_Y, deckZ); deckTop.castShadow = true; scene.add(deckTop);
let deckShown = 54;
const deckThick = () => .02 + Math.max(0, deckShown) * .0042;
function syncDeck(now, dt) {
  const target = G?.deck?.length ?? 54;
  deckShown = reduced ? target : THREE.MathUtils.damp(deckShown, target, 10, dt);
  const t = deckThick();
  deckBody.scale.y = t; deckTop.position.y = FELT_Y + t - CT / 2 + .001;
  const visible = target > 0 || deckShown > .5;
  deckBody.visible = deckTop.visible = visible;
}
const chipGeo = new THREE.CylinderGeometry(.25, .25, .05, 40);
function chipSet([base, mark, kind]) {
  const coin = kind === 'coin';
  const side = canvasTexture(256, 16, g => { g.fillStyle = base; g.fillRect(0, 0, 256, 16); g.fillStyle = mark; if (coin) for (let x = 0; x < 256; x += 6) g.fillRect(x, 0, 2, 16); else for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 12, 16); });
  const top = canvasTexture(128, 128, g => {
    if (coin) {
      const r = g.createRadialGradient(50, 44, 4, 64, 64, 64); r.addColorStop(0, '#fff0b8'); r.addColorStop(.5, base); r.addColorStop(1, mark);
      g.fillStyle = r; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
      g.strokeStyle = mark; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
      starPath(g, 64, 64, 26, 11); g.fillStyle = mark; g.fill();
      return;
    }
    g.fillStyle = base; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
    g.fillStyle = mark; for (let i = 0; i < 8; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 4); g.fillRect(-7, -64, 14, 18); g.restore(); }
    g.strokeStyle = mark; g.lineWidth = 3; g.setLineDash([6, 6]); g.beginPath(); g.arc(64, 64, 36, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(64, 64, 30, 0, 7); g.fill();
  });
  const m = (o, metal) => new THREE.MeshStandardMaterial({map: o, roughness: coin ? .3 : .45, metalness: coin ? .8 : 0, envMapIntensity: coin ? 1.1 : .6});
  return [m(side), m(top), m(top)];
}
const chipMatSets = BOSS_PRESENTATION.map(t => t.chips.map(chipSet));
let chipMats = chipMatSets[0];
const chips = [], chipsLeaving = [];
const stackPos = [[chipX - .27, chipZ - .14], [chipX + .27, chipZ - .14], [chipX, chipZ + .3]];
function syncChips(count) {
  while (chips.length < count) {
    const k = chips.length, s = k % 3, h = Math.floor(k / 3), [x, z] = stackPos[s];
    const m = new THREE.Mesh(chipGeo, chipMats[s]); m.castShadow = m.receiveShadow = true;
    m.userData.rest = new THREE.Vector3(x + (crand() - .5) * .03, FELT_Y + .025 + h * .051, z + (crand() - .5) * .03);
    m.position.copy(m.userData.rest); if (!reduced) m.position.y += 1.2 + h * .05; m.rotation.y = crand() * 6;
    scene.add(m); chips.push(m);
  }
  while (chips.length > count) { const m = chips.pop(); if (reduced) scene.remove(m); else chipsLeaving.push({m, start: performance.now()}); }
}

/* ------------------------------ fx -------------------------------- */
const additive = (color, map, opacity = 0) => new THREE.MeshBasicMaterial({color, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
const selGlows = slots.map(p => { const m = addMesh(new THREE.PlaneGeometry(1.95, 2.45).rotateX(-Math.PI / 2), additive(0xffd36b, glowTex), p.x, FELT_Y + .004, p.z); m.renderOrder = 2; return m; });
const upRings = slots.map(p => { const m = addMesh(new THREE.PlaneGeometry(1.7, 2.18).rotateX(-Math.PI / 2), additive(0xffffff, ringTex), p.x, FELT_Y + .003, p.z); m.visible = false; return m; });
const lockMeshes = slots.map(p => { const m = addMesh(new THREE.PlaneGeometry(.7, .7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: lockTex, transparent: true, depthWrite: false, toneMapped: false}), p.x, FELT_Y + .005, p.z); m.visible = false; return m; });
const slotEffects = slots.map(() => ({label: null, id: null}));
// The Elevator Operator: brass lane rails, corner brackets and lamps on playable cards.
const bracketTex = canvasTexture(256, 320, g => { g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; const L = 50; for (const [x, y, dx, dy] of [[18, 18, 1, 1], [238, 18, -1, 1], [18, 302, 1, -1], [238, 302, -1, -1]]) { g.beginPath(); g.moveTo(x + dx * L, y); g.lineTo(x, y); g.lineTo(x, y + dy * L); g.stroke(); } });
const brackets = slots.map(p => { const m = addMesh(new THREE.PlaneGeometry(1.52, 2.0).rotateX(-Math.PI / 2), additive(0xfff0c0, bracketTex), p.x, FELT_Y + .006, p.z); m.visible = false; m.renderOrder = 3; return m; });
const laneDeco = new THREE.Group(); scene.add(laneDeco); laneDeco.visible = false;
for (const x of [-.77, .77]) {
  const rod = new THREE.Mesh(new THREE.BoxGeometry(.07, .09, 5.9), brassMat); rod.position.set(x, FELT_Y + .045, .14); rod.castShadow = true; laneDeco.add(rod);
  for (const z of [-2.8, 3.08]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .14, 16), brassMat); cap.position.set(x, FELT_Y + .07, z); laneDeco.add(cap); }
}
const lamps = [0, 1, 2].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: dotTex, color: 0xffd98a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false})); sp.scale.setScalar(.55); sp.renderOrder = 7; laneDeco.add(sp); return sp; });
// The High Roller: gold ring around the stake card, red ring around its marked neighbor.
const stakeRing = addMesh(new THREE.PlaneGeometry(1.86, 2.4).rotateX(-Math.PI / 2), additive(0xffc94a, ringTex), 0, FELT_Y + .007, 0); stakeRing.visible = false;
const mateRing = addMesh(new THREE.PlaneGeometry(1.74, 2.24).rotateX(-Math.PI / 2), additive(0xff3b3b, ringTex), 0, FELT_Y + .007, 0); mateRing.visible = false;
const stakeLabel = addMesh(new THREE.PlaneGeometry(.9, .22).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({transparent: true, depthWrite: false, toneMapped: false, map: canvasTexture(256, 64, g => { rr(g, 4, 4, 248, 56, 28); g.fillStyle = '#1a0a04'; g.fill(); g.strokeStyle = '#f2c35a'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#f2c35a'; g.font = '900 34px Cinzel, Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STAKE', 128, 34); })}), 0, FELT_Y + .008, 0); stakeLabel.visible = false;
const mateLabel = addMesh(new THREE.PlaneGeometry(.9, .22).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({transparent: true, depthWrite: false, toneMapped: false, map: canvasTexture(256, 64, g => { rr(g, 4, 4, 248, 56, 28); g.fillStyle = '#1a0406'; g.fill(); g.strokeStyle = '#ff5a4a'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#ff8a7a'; g.font = '900 30px Cinzel, Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AT RISK', 128, 34); })}), 0, FELT_Y + .008, 0); mateLabel.visible = false;
const bossMachines = makeBossMachines({scene,slab,slots,canvasTexture});
const frontSlots = [-1,-1,-1];
const register = makeRegister({
  scene, slab, canvasTexture, chipGeometry:chipGeo, chipMaterial:chipMatSets[0][0], glow:dotTex,
  imageURL:new URL('./art/toll-register.jpg',import.meta.url).href
});
const latchSteel = mat(0xb8c5cf,.24,.88), latchBase = mat(0x34404d,.47,.74);
const latchPlate = slab(.26,.34,.045,.045,.012), latchTongue = slab(.13,.34,.03,.055,.009);
const latchPin = new THREE.CylinderGeometry(.033,.033,.014,12);
const clasps = slots.map(p => {
  const pair = new THREE.Group(); pair.visible = false; scene.add(pair);
  const tongues = [-1,1].map(sign => {
    const mount = new THREE.Group(); pair.add(mount);
    mount.position.set(p.x + sign*(CW/2-.035),FELT_Y+.01,p.z + sign*(CH/2-.08));
    mount.rotation.y = sign < 0 ? Math.PI*.24 : Math.PI*1.24;
    const base = new THREE.Mesh(latchPlate,latchBase); mount.add(base);
    const tongue = new THREE.Mesh(latchTongue,latchSteel); tongue.position.y = .05; tongue.castShadow = true; mount.add(tongue);
    const pin = new THREE.Mesh(latchPin,latchSteel); pin.position.set(0,.114,0); mount.add(pin);
    return tongue;
  });
  return {pair,tongues,start:0};
});
function animateBossProps(now, dt) {
  const id = G ? bossId() : '', ready = G?.phase === 'playing' || G?.phase === 'busy';
  register.update(currentTheme === 1 && !lesson, G?.tollDebt || 0, ready ? G.streak : 0, now, reduced);
  for (let i=0;i<clasps.length;i++) {
    const latch = clasps[i], locked = id === 'collector' && !!G.locked[i] && !G.board[i] && !lesson;
    if (!locked) { latch.pair.visible = false; continue; }
    if (!latch.pair.visible) { latch.pair.visible = true; latch.start = now; }
    const t = reduced ? 1 : Math.min(1,(now-latch.start)/200);
    for (const tongue of latch.tongues) tongue.position.z = .23*(1-(1-t)**3);
  }
  const lanes = id === 'elevator' && !lesson;
  laneDeco.visible = lanes && ready;
  bossMachines.show(!lesson && G && currentTheme === G.stage && G.phase !== 'ticket' ? id : '');
  if (lanes) for (let col=0;col<3;col++) frontSlots[col] = frontOfLane(col);
  const doubleDraw = id === 'sharp' && (G.phase === 'busy' ? G.stageGuesses % 4 === 0 : isDoubleNext());
  bossMachines.update(G,now,dt,reduced,sound,frontSlots,doubleDraw);
  for (let i = 0; i < 9; i++) {
    const on = lanes && ready && playable(i);
    brackets[i].visible = on;
    if (on) brackets[i].material.opacity = (i === G.selected ? .95 : .55) + Math.sin(now * .004 + i) * .08;
  }
  if (lanes) for (let col = 0; col < 3; col++) {
    const front = frontSlots[col];
    const lamp = lamps[col]; lamp.visible = front >= 0 && ready;
    if (front >= 0) { const p = slots[front]; lamp.position.set(p.x, CARD_Y + .5, p.z - CH / 2 - .18); lamp.material.opacity = .75 + Math.sin(now * .006 + col) * .15; }
  }
  const stake = id === 'roller' && ready && !lesson && G.stake >= 0 && G.board[G.stake];
  for (const m of [stakeRing, stakeLabel]) m.visible = !!stake;
  for (const m of [mateRing, mateLabel]) m.visible = !!stake && G.stakeMate >= 0 && !!G.board[G.stakeMate];
  if (stake) {
    const a = slots[G.stake]; stakeRing.position.x = stakeLabel.position.x = a.x; stakeRing.position.z = a.z; stakeLabel.position.z = a.z - CH / 2 - .125; stakeLabel.position.y = .765;
    stakeRing.material.opacity = .8 + Math.sin(now * .008) * .2; stakeRing.scale.setScalar(1 + Math.sin(now * .004) * .02);
    if (G.stakeMate >= 0) { const b = slots[G.stakeMate]; mateRing.position.x = mateLabel.position.x = b.x; mateRing.position.z = b.z; mateLabel.position.z = b.z - CH / 2 - .125; mateRing.material.opacity = .55 + Math.sin(now * .008 + 2) * .25; }
  }
  // back-lane cards sit in shadow behind the cage
  for (const m of cardMeshes) if (m) { const f = m.userData.face, target = lanes && !playable(m.userData.index) ? .72 : 1; const v = reduced ? target : THREE.MathUtils.damp(f.color.r, target, 8, dt); f.color.setScalar(v); }
}
function syncSlotEffects() {
  if (!G) return;
  slotEffects.forEach((fx, i) => {
    const id = G.upgrades[i]; upRings[i].visible = !!id;
    lockMeshes[i].visible = !!G.locked?.[i] && !G.board[i];
    if (!id) { if (fx.label) fx.label.visible = false; return; }
    const color = UPGRADE_COLORS[id]; upRings[i].material.color.setHex(color);
    if (fx.id !== id) {
      if (fx.label) { scene.remove(fx.label); fx.label.material.map.dispose(); fx.label.material.dispose(); }
      const up = UPGRADES.find(u => u.id === id);
      const texture = canvasTexture(512, 80, g => { g.fillStyle = hex(color); g.font = '700 46px Outfit'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = hex(color); g.shadowBlur = 10; g.fillText(up.name.toUpperCase().split('').join(' '), 256, 42); });
      fx.label = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .195).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: texture, transparent: true, toneMapped: false, depthWrite: false}));
      fx.label.position.set(slots[i].x, FELT_Y + .006, slots[i].z + CH / 2 + .17); scene.add(fx.label); fx.id = id;
    }
    fx.label.visible = true;
  });
}
const lineGlows = LINES.map(([a, , c]) => {
  const A = slots[a], C = slots[c], dx = C.x - A.x, dz = C.z - A.z, len = Math.hypot(dx, dz) + 1.4;
  const g = new THREE.Group(); g.position.set((A.x + C.x) / 2, CARD_Y + .32, (A.z + C.z) / 2); g.rotation.y = -Math.atan2(dz, dx);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, .55).rotateX(-Math.PI / 2), additive(0xffcf6a, barTex)); m.renderOrder = 5; g.add(m); scene.add(g); return m;
});
const sparks = Array.from({length: 160}, () => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: dotTex, color: 0xffd16b, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false}));
  s.visible = false; s.renderOrder = 6; scene.add(s); return {s, life: 0, max: 1, vel: new THREE.Vector3(), size: .1, rise: false};
});
let sparkCursor = 0;
function spawnSpark(x, y, z, color, vx, vy, vz, life, size, rise = false) {
  const p = sparks[sparkCursor++ % sparks.length];
  p.s.position.set(x, y, z); p.vel.set(vx, vy, vz); p.life = p.max = life; p.size = size; p.rise = rise;
  p.s.material.color.setHex(color); p.s.visible = true;
}
function burst(index, color = 0xffd16b, count = 18) {
  if (reduced) return;
  const p = slots[index] || {x: deckX, z: deckZ};
  for (let j = 0; j < count; j++) {
    const a = j * 2.39996 + crand(), sp = .8 + crand() * 1.6;
    spawnSpark(p.x, CARD_Y + .3, p.z, color, Math.cos(a) * sp, 1.6 + crand() * 2.2, Math.sin(a) * sp, .7 + crand() * .5, .1 + crand() * .1);
  }
}
function animateSparks(dt) {
  for (const p of sparks) {
    if (p.life <= 0) { p.s.visible = false; continue; }
    p.life -= dt;
    if (p.rise) { p.vel.y += 1.2 * dt; p.vel.x *= .97; p.vel.z *= .97; } else p.vel.y -= 6 * dt;
    p.s.position.addScaledVector(p.vel, dt);
    const k = Math.max(0, p.life / p.max);
    p.s.material.opacity = k; p.s.scale.setScalar(p.size * (.4 + .6 * k));
  }
}
const project = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2]; };
function floatLabel(text, index, color = '#ffe3a1', minor = false) {
  const p = slots[index] || {x: deckX, z: deckZ};
  const [x, y] = project(p.x, CARD_Y + .5, p.z - .2);
  const node = document.createElement('div'); node.className = 'scoreFly' + (minor ? ' minor' : ''); node.textContent = text;
  node.style.left = x + 'px'; node.style.top = (y + (minor ? 34 : 0)) + 'px'; node.style.setProperty('--fx-color', color);
  $('fxLayer').append(node); setTimeout(() => node.remove(), reduced ? 650 : 1200);
}
function upgradeTrigger(id, index) { const up = UPGRADES.find(u => u.id === id); if (!up) return; burst(index, UPGRADE_COLORS[id], 12); floatLabel(up.name.toUpperCase(), index, hex(UPGRADE_COLORS[id]), true); }
let shake = 0;
function kick(amount) { if (!reduced) shake = Math.max(shake, amount); }

/* ------------------------- presentation --------------------------- */
const casino = {heat: 0, jokerUntil: 0, dealerUntil: 0, shieldUntil: Array(9).fill(0), lineUntil: Array(8).fill(0)};
const jokerMesh = makeCard({joker: true}); jokerMesh.visible = false; scene.add(jokerMesh);
let drawRevealUntil = 0, revealMotion = null, revealPos = null, revealPos2 = null;
const drawnFace = new THREE.MeshBasicMaterial({transparent: true, toneMapped: false});
const drawnCard = makeCard(null, drawnFace); drawnCard.visible = false; scene.add(drawnCard);
const drawnFace2 = new THREE.MeshBasicMaterial({toneMapped: false});
const drawnCard2 = makeCard(null, drawnFace2); drawnCard2.visible = false; scene.add(drawnCard2);
// A narrow varnish highlight follows the bent corner while the printed face stays bright.
for (const material of [drawnFace,drawnFace2]) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float paperCurl;\n' + shader.vertexShader.replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\npaperCurl = max(0.0, transformed.y - position.y);');
    shader.fragmentShader = 'varying float paperCurl;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += vec3(.32,.23,.12) * smoothstep(.025,.12,paperCurl) * (1.0-smoothstep(.12,.34,paperCurl));\n#include <opaque_fragment>');
  };
}
function showDrawnCard(card) {
  if (drawnFace.map) drawnFace.map.dispose();
  drawnFace.map = tex(card); drawnFace.needsUpdate = true;
  for (const card of [drawnCard, drawnCard2]) for (const layer of card.children) layer.morphTargetInfluences[0] = 0;
  const p = slots[G?.selected] || slots[0];
  drawnCard.rotation.set(0, 0, 0); drawnCard.position.set(p.x, CARD_Y + .7, p.z + .3);
  drawnFace.opacity = 1; drawRevealUntil = performance.now() + 1600;
}
function beginDraw(card, resolve, card2 = null) {
  showDrawnCard(card);
  drawRevealUntil = 0; revealPos = null; revealPos2 = null;
  if (card2) { drawnFace2.map?.dispose(); drawnFace2.map = tex(card2); drawnFace2.needsUpdate = true; }
  if (reduced) { sound('flip'); drawnCard.visible = false; resolve(); return; }
  const now = performance.now();
  revealMotion = {start: Math.max(now, casino.jokerUntil), duration: 900, slot: G.selected, resolve, two: !!card2};
  drawnCard.position.set(deckX, deckTopY(), deckZ); drawnCard.rotation.set(0, 0, Math.PI);
  drawnCard2.position.copy(drawnCard.position); drawnCard2.rotation.set(0, 0, Math.PI);
}
function revealJoker(count) {
  casino.jokerUntil = performance.now() + (reduced ? 650 : 1500);
  burst(-1, 0xc58aff, 40); floatLabel('JOKER  +' + count * 5, -1, '#dfb5ff');
  casino.dealerUntil = performance.now() + 650;
  banner('JOKER!', 'joker', '+' + (count * 5) + ' cards shuffled in');
}
function resetCasino() {
  swapFrom = null;
  register.reset(); bossMachines.reset();
  casino.jokerUntil = 0; drawRevealUntil = 0; revealMotion = null; drawnCard.visible = false;
  for (const p of sparks) { p.life = 0; p.s.visible = false; }
  $('fxLayer').replaceChildren();
  casino.dealerUntil = 0; casino.shieldUntil.fill(0); casino.lineUntil.fill(0);
}
let bannerTimer;
function banner(text, kind = 'info', sub = '') {
  const b = $('banner');
  b.innerHTML = `<b>${esc(text.trim())}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
  b.dataset.kind = kind;
  b.style.left = (playRect.x + playRect.w / 2) + 'px'; b.style.top = (playRect.y + playRect.h * .3) + 'px';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 1350);
}
function pop(msg, art, kind) { banner(msg, kind || lastFlashKind || 'info'); }
let lastFlashKind = 'info';
function flash(kind, index = -1, msg = '') {
  const panel = $('panel'); panel.classList.remove('positive', 'negative', 'ability');
  void panel.offsetWidth; panel.classList.add(kind); clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => panel.classList.remove('positive', 'negative', 'ability'), 500);
  if (index >= 0) highlights[index] = {kind, end: performance.now() + 620};
  if (kind === 'ability' && index >= 0) casino.shieldUntil[index] = performance.now() + 700;
  if (index >= 0) burst(index, kind === 'negative' ? 0xff5a45 : kind === 'ability' ? 0x86ddff : 0xffd16b, kind === 'negative' ? 14 : 24);
  if (kind === 'positive' || kind === 'negative') casino.dealerUntil = performance.now() + 650;
  if (kind === 'negative') kick(.12); if (kind === 'positive') kick(.03);
  lastFlashKind = kind;
  if (msg) pop(msg, null, kind);
}

/* ------------------------ bosses & music -------------------------- */
let bossEntryTimer, pendingBoss = null, entryGeneration = 0, bossBegin = null;
let musicOn = false, musicGain, musicVoices = [], currentTheme = -1;
function applyBossStyle(stage) {
  const theme = BOSS_PRESENTATION[stage - 1];
  document.body.dataset.boss = theme.id;
  if (currentTheme !== stage) {
    currentTheme = stage;
    walnutAmount.value = theme.id === 'toll' ? 1 : 0;
    const old = feltMat.map; feltMat.map = paintFelt(theme); feltMat.needsUpdate = true; old?.dispose();
    spot.color.setHex(theme.light); baseSpot.setHex(theme.light);
    artBoss = theme.id; backMat.map = backTextures[stage - 1]; backMat.needsUpdate = true;
    woodMat.color.setHex(theme.base);
    const [rc, rr_, rm] = theme.rail; leatherMat.color.setHex(rc); leatherMat.roughness = rr_; leatherMat.metalness = rm;
    trimMat.color.setHex(theme.trim[0]); trimMat.roughness = theme.trim[1]; trimMat.metalness = theme.trim[2];
    brassMat.color.setHex(theme.band[0]); brassMat.roughness = theme.band[1];
    chipMats = chipMatSets[stage - 1]; chips.forEach((c, k) => c.material = chipMats[k % 3]);
  }
  $('bossName').textContent = theme.name; $('bossEmblem').innerHTML = suitSVG(theme.mark);
  tuneBossMusic(stage);
}
function tuneBossMusic(stage) {
  if (!audioContext) return;
  const notes = BOSS_PRESENTATION[stage - 1].notes;
  musicVoices.forEach((voice, i) => voice.frequency.setTargetAtTime(notes[i], audioContext.currentTime, .3));
}
function startBossMusic() {
  if (musicGain) return;
  musicGain = audioContext.createGain(); musicGain.gain.value = 0; musicGain.connect(audioBus);
  for (let i = 0; i < 3; i++) {
    const voice = audioContext.createOscillator(), level = audioContext.createGain();
    voice.type = i === 0 ? 'sine' : 'triangle'; level.gain.value = i === 0 ? .45 : .13;
    voice.connect(level).connect(musicGain); voice.start(); musicVoices.push(voice);
  }
  tuneBossMusic(G?.stage || 1);
}
function cancelBossEntry() { clearTimeout(bossEntryTimer); pendingBoss = null; bossBegin = null; entryGeneration++; }
function enterBoss(stage) {
  cancelBossEntry();
  const generation = entryGeneration;
  pendingBoss = stage;
  applyBossStyle(stage);
  const theme = BOSS_PRESENTATION[stage - 1];
  const begin = () => {
    if (generation !== entryGeneration || pendingBoss !== stage) return;
    cancelBossEntry(); hideDialog(); setupStage(stage);
  };
  bossBegin = begin;
  const wait = reduced ? 1800 : 4200;
  const node = html(`<div class="bossIntro" style="--wait:${wait}ms">
    <div class="biBars"><i></i><i></i></div>
    <div class="biStage">Boss ${stage} of ${FINAL}</div>
    <div class="biEmblem">${suitSVG(theme.mark)}</div>
    <div class="biKicker">The house sends</div>
    <h2 class="biName">${esc(theme.name)}</h2>
    <p class="biRule">${esc(BOSSES[stage - 1].desc)}</p>
    <button class="btn primary big" data-a="deal" data-autofocus>${icon('play')} Deal the cards <kbd>Enter</kbd></button>
    <div class="biTimer"><i></i></div>
  </div>`);
  node.querySelector('[data-a=deal]').onclick = begin;
  openScreen('entrance', node);
  sound('entrance-' + theme.id);
  bossEntryTimer = setTimeout(begin, wait);
}

/* --------------------------- game logic --------------------------- */
const has = id => G?.artifacts.includes(id);
const bossId = () => BOSSES[(G?.stage || 1) - 1]?.id;
function frontOfLane(col) {
  for (let i=col+6;i>=0;i-=3) if (G.board[i]) return i;
  return -1;
}
function playable(i) {
  if (!G?.board[i]) return false;
  if (bossId() !== 'elevator' || lesson) return true;
  return i === frontOfLane(i % 3);
}
const isDoubleNext = () => bossId() === 'sharp' && !lesson && (G.stageGuesses + 1) % 4 === 0;
function neighbors(i) { const r = Math.floor(i / 3), c = i % 3, n = []; if (r > 0) n.push(i - 3); if (r < 2) n.push(i + 3); if (c > 0) n.push(i - 1); if (c < 2) n.push(i + 1); return n; }
function pickStake() {
  G.stake = -1; G.stakeMate = -1;
  const cands = [];
  for (let i = 0; i < 9; i++) if (G.board[i]) { const ns = neighbors(i).filter(j => G.board[j]); if (ns.length) cands.push([i, ns]); }
  if (!cands.length) return;
  const [i, ns] = cands[Math.floor(Math.random() * cands.length)];
  G.stake = i; G.stakeMate = ns[Math.floor(Math.random() * ns.length)];
}
function ensureStake(played = -1) {
  if (bossId() !== 'roller' || lesson) { if (G) { G.stake = -1; G.stakeMate = -1; } return; }
  const ok = G.stake >= 0 && G.board[G.stake] && G.stakeMate >= 0 && G.board[G.stakeMate] && played !== G.stake;
  if (!ok) pickStake();
}
const cardsLeft = () => G?.board.filter(Boolean).length || 0;
const rank = c => c ? R[c.v] + c.s : 'empty';
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const normalDeck=()=>S.flatMap(s=>R.map((_,v)=>({v,s})));
function draw(){let jokers=0;while(G.deck.length){const c=G.deck.pop();if(c.joker){G.deck.push(...shuffle(normalDeck()).slice(0,5));shuffle(G.deck);G.stageTotal+=5;jokers++;continue}if(jokers){revealJoker(jokers);sound(bossId()==='driver'?'rev':'joker');flash('negative');}return c}return null}
function creditTokens(n){const paid=Math.min(n,G.tollDebt);G.tollDebt-=paid;G.credits+=n-paid;return n-paid}
function grantTokens(n){const give=Math.max(0,Math.min(n,100-G.stageEarned));G.stageEarned+=give;return creditTokens(give)}
function lineState(){return LINES.map(l=>l.every(i=>G.board[i]))}
function scoreLines(before){for(let j=0;j<LINES.length;j++)if(!before[j]&&LINES[j].every(i=>G.board[i])){const pts=j<3?250:j<6?300:400;casino.lineUntil[j]=performance.now()+1100;for(const index of LINES[j])burst(index,0xffd16b,12);G.score+=pts;grantTokens(6+(has('collector')?6:0));banner('LINE COMPLETE','positive','+'+pts+' points');sound('line')}}
function refill(){const i=G.board.findIndex((c,k)=>!c&&!G.locked[k]);if(i<0)return;const before=lineState(),c=draw();if(c){G.board[i]=c;meshCard(c,i,true);scoreLines(before)}}

function shop(stage,fresh=false){
 G.phase='shop';
 // A Pit Stop shows precisely four offers: two Artifacts and two board upgrades.
 // Purchased offers disappear until the player pays to reroll the whole selection.
 if(fresh||!shopOffers||!shopOffers.artifacts){
  shopOffers={
   artifacts:shuffle(ARTIFACTS.filter(a=>!G.artifacts.includes(a.id))).slice(0,2).map(a=>a.id),
   upgrades:shuffle([...UPGRADES]).slice(0,2).map(u=>u.id)
  };
 }
 refresh();
 renderShop(stage);
}
function setupStage(stage){
 cancelBossEntry();
 applyBossStyle(stage);
 resetCasino();
 clearPile();
 G.stage=stage;G.stageCorrect=0;G.stageEarned=0;G.streak=0;G.phase='playing';G.locked=Array(9).fill(false);G.wardUsed=Array(9).fill(false);G.slotHits=Array(9).fill(0);G.mirrorUsed=false;G.salvageUsed=false;G.cloverUsed=false;G.protected=Array(9).fill(false);G.board=Array(9).fill(null);G.selected=0;G.deck=shuffle([...normalDeck(),...Array.from({length:BOSSES[stage-1].jokers},()=>({joker:true}))]);G.stageTotal=G.deck.length;G.push=0;G.stageGuesses=0;G.stamps={};G.stake=-1;G.stakeMate=-1;
 G.shields=1;
 if(G.ticket==='lucky')G.swaps++;
 sound('shuffle');
 animations=[];for(let i=0;i<9;i++)meshCard(null,i);
 const openingCount = BOSSES[stage - 1].start + (has('anchor') ? 1 : 0);
 // Pair the first two Elevator cards in one lane. Iron Anchor fills the third lane.
 const elevatorOpening = [0, 3, 1, 2];
 for (let deal = 0; deal < openingCount; deal++) {
   const slot = bossId() === 'elevator' ? elevatorOpening[deal] : deal;
   const card = draw();
   if (card) { G.board[slot] = card; meshCard(card, slot, true); }
 }
 if (bossId() === 'elevator') G.selected = frontOfLane(0);
 ensureStake();
 G.message='Choose a card';G.detail=BOSSES[stage-1].name+' · '+BOSSES[stage-1].desc;refresh();
}
function finishStage(){
 if(cardsLeft()===0){endRun(false,'You lost every card on the board.');return}
 if(G.deck.length)return;
 if(bossId()==='house'&&Object.keys(G.stamps).length<4){endRun(false,'The House needed all four suits stamped before the deck ran out.');return}
 if(G.stage===FINAL){endRun(cardsLeft()>=2,cardsLeft()<2?'The Final Driver required two remaining cards.':'');return}
 const cleared=G.stage;creditTokens(50);G.score+=500*cleared;G.phase='shop';
 banner('DECK CLEARED','positive','+'+(500*cleared)+' points · +50 tokens');
 setTimeout(()=>{if(G.phase==='shop'&&G.stage===cleared)shop(cleared+1,true)},reduced?200:1300);
}
const bestKey='hilo-3d-rogue-best';
function endRun(win,reason){
 G.phase='ended';G.message=win?'THE FINAL DRIVER DEFEATED!':'END OF THE ROAD';
 G.detail=reason||'Run completed.';refresh();let prior=0;try{prior=Number(localStorage.getItem(bestKey))||0;if(G.score>prior)localStorage.setItem(bestKey,String(G.score))}catch(e){}
 setTimeout(()=>showRunResult(win,reason,Math.max(prior,G.score),G.score>prior),reduced?100:900);
}
function newRun(){
 cancelBossEntry();
 applyBossStyle(1);
 resetCasino();
 clearPile();
 G={deck:[],board:Array(9).fill(null),selected:0,correct:0,stageCorrect:0,streak:0,best:0,turns:0,score:0,stage:1,stageTotal:54,credits:65,tollDebt:0,stageEarned:0,shields:0,peeks:0,swaps:0,protected:Array(9).fill(false),locked:Array(9).fill(false),wardUsed:Array(9).fill(false),slotHits:Array(9).fill(0),artifacts:[],upgrades:Array(9).fill(null),ticket:'',cloverUsed:false,phase:'ticket',message:'Choose your Ticket',detail:'',push:0};
 for(let i=0;i<9;i++)meshCard(null,i);
 hud.score=0;hud.credits=G.credits;
 refresh();chooseTicket();
}
function chance(card,dir){const a=G.deck.filter(c=>!c.joker);return a.length?a.filter(c=>dir==='higher'?c.v>card.v:c.v<card.v).length/a.length:0}
function guess(dir){
 if(lesson){lessonGuess(dir);return}
 if(G.phase!=='playing'||!G.board[G.selected]||!playable(G.selected))return;
 swapFrom=null;
 const run=G,boss=bossId();
 const dbl=isDoubleNext();
 const i=G.selected,old=G.board[i];let p=chance(old,dir);const c=draw();
 if(!c){finishStage();return}
 // The Cardsharp: every fourth guess draws two cards; both must beat your card.
 const c2=dbl?draw():null;
 if(boss==='sharp')G.stageGuesses++;
 if(c2)p=p*p;
 const beats=x=>dir==='higher'?x.v>old.v:x.v<old.v;
 const win=c2||c,shown=c2?rank(c)+' + '+rank(c2):rank(c);
 const isStake=boss==='roller'&&i===G.stake;
 G.phase='busy';G.message=c2?'Double Draw…':'Revealing…';refresh();G.turns++;const good=beats(c)&&(!c2||beats(c2));
 pressGuess(dir);
 const resolve=()=>{
  if(G!==run)return;
  let info='';
  if(good){
   const streakBefore=G.streak;
   const wasFull=G.board.every(Boolean);
   G.board[i]=win;meshCard(win,i,false,{tossOld:true,from:c2?revealPos2:revealPos});if(c2)tossCard(c,revealPos);G.correct++;G.stageCorrect++;G.streak++;
   let pts=Math.max(10,Math.round(100/Math.max(.1,p)));
   if(G.streak>=9)pts*=3;
   if(G.ticket==='risk'&&p<=.4){const earned=grantTokens(6);if(earned)info+=' · Risk +'+earned+' tokens'}
   if(has('clover')&&p<=.35&&!G.cloverUsed&&G.board.some((card,k)=>!card&&!G.locked[k])&&G.deck.length){G.cloverUsed=true;refill();info+=' · Clover refill'}
   const up=G.upgrades[i];
   if(old.v>=4&&old.v<=8){pts+=Math.round(100/Math.max(.1,p)*.35);grantTokens(2)}
   if(up==='mint')grantTokens(3);if(up==='kindle')G.streak++;
   const fireMilestone=Math.floor(G.streak/3)>Math.floor(streakBefore/3);
   if(has('storm')&&fireMilestone){G.swaps++;info+=' · Storm +Swap'}
   if(G.ticket==='fire'&&Math.floor(G.streak/7)>Math.floor(streakBefore/7)){G.peeks++;info+=' · Fire +Peek'}
   if(has('ember')&&streakBefore<5&&G.streak>=5){G.peeks++;info+=' · Ember +Peek'}
   if(has('timekeeper')&&G.correct%10===0)G.peeks++;
   if(has('compass')&&G.correct%5===0)G.swaps++;
   if(up==='amp'){G.slotHits[i]++;if(G.slotHits[i]%3===0){const earned=grantTokens(12);if(earned)info+=' · Amplifier +'+earned+' tokens'}}
   if(up==='seed'){G.slotHits[i]++;if(G.slotHits[i]%3===0)refill()}
   if(up==='scout'){G.slotHits[i]++;if(G.slotHits[i]%4===0)G.peeks++}
   grantTokens(2);G.score+=pts;floatLabel('+'+pts,i,p<=.35?'#ffb3ff':'#ffe3a1');
   if(c2)banner('DOUBLE DRAW WON','positive','+'+pts+' points');
   if(boss==='house'&&!G.stamps[old.s]){G.stamps[old.s]=true;info+=' · '+old.s+' stamped';banner(old.s+' STAMPED','positive',Object.keys(G.stamps).length+' of 4 suits')}
   if(isStake){refill();bossMachines.ring(performance.now());sound('service-bell');info+=' · Stake won: refill';banner('STAKE WON','positive','A slot refills')}
   if(up==='mint'||up==='kindle'||up==='amp'&&G.slotHits[i]%3===0||up==='seed'&&G.slotHits[i]%3===0||up==='scout'&&G.slotHits[i]%4===0)upgradeTrigger(up,i);
   if(G.push===1){G.push=2;info+=' · Push 1/2: stay on this position'}
   else if(G.push===2){G.peeks++;G.push=0;info+=' · Push +Peek'}
   if(fireMilestone){refill();if(has('phoenix'))refill();if(streakBefore<6&&G.streak>=6){G.peeks++;info+=' · Super Fire +Peek'}banner(G.streak>=9?'INFERNO':G.streak>=6?'SUPER FIRE':'ON FIRE','fire',G.streak+' in a row'+(G.streak>=9?' · 3× points':''))}
   else if(G.stage <= 2 ? G.correct % 2 === 0 : G.stageCorrect % 4 === 0)refill();
   if(!wasFull&&G.board.every(Boolean)){
    G.peeks++;
    if(has('twin'))G.swaps++;
    info+=' · Full board +Peek';
    pop('FULL BOARD · +1 Peek'+(has('twin')?' +1 Swap':''),null,'positive');
   }
   G.best=Math.max(G.best,G.streak);
   G.message='✓ '+rank(old)+' → '+shown+info;sound('good');flash('positive',i);
  }else{
   G.streak=0;
   const up=G.upgrades[i],pushing=G.push>0;
   if(!pushing&&has('mirror')&&!G.mirrorUsed){G.mirrorUsed=true;info=' Mirror saved card';sound('shield');flash('ability',i,' MIRROR SAVED')}
   else if(!pushing&&up==='ward'&&!G.wardUsed[i]){G.wardUsed[i]=true;upgradeTrigger('ward',i);info=' Ward saved card';sound('shield');flash('ability',i,' WARD BLOCK')}
   else if(!pushing&&G.protected[i]){G.protected[i]=false;info='Shield used · card saved';sound('shield');flash('ability',i,' SHIELD BLOCK')}
   else{
    G.board[i]=null;discardCard(i);info='Position lost';
    // The High Roller: an unblocked miss on the stake also takes its marked neighbor.
    if(isStake&&G.stakeMate>=0&&G.board[G.stakeMate]){const m=G.stakeMate;if(G.protected[m]){G.protected[m]=false;info+=' · Shield saved the neighbor';flash('ability',m)}else{G.board[m]=null;discardCard(m);info+=' · Stake neighbor lost';banner('STAKE LOST','negative','Two cards gone')}}
    if(boss==='collector'&&G.locked.filter(Boolean).length<3){G.locked[i]=true;sound('lock');info+=' ·  Collector locked it'}
    if(has('salvage')&&!G.salvageUsed){G.salvageUsed=true;refill()}
   }
   G.push=0;
   const saved=G.board[i]!==null;
   if(!saved&&boss==='toll'){const paid=Math.min(10,G.credits);G.credits-=paid;G.tollDebt+=10-paid;register.collect(performance.now(),paid);sound('toll');info+=' · Tollkeeper -10 tokens'}
   G.message=saved?info:rank(old)+' → '+shown+' · Card lost'+(boss==='toll'?' · Toll -10 tokens'+(G.tollDebt?' ('+G.tollDebt+' owed)':''):'')+(info.includes('neighbor')?' · '+info.split(' · ').pop():'');
   if(!saved){sound('bad');flash('negative',i);floatLabel('MISS',i,'#ff8a7a')}
   tossCard(c,revealPos);if(c2)tossCard(c2,revealPos2);
  }
  drawnCard.visible=false;drawnCard2.visible=false;revealPos=null;revealPos2=null;
  if(boss==='roller')ensureStake(i);
  G.detail=info||('Streak '+G.streak+' · '+G.deck.length+' cards remaining');
  if(cardsLeft()===0){endRun(false,'All board positions lost.');return}
  if(!G.deck.length){finishStage();return}
  G.phase='playing';refresh();
 };
 beginDraw(c,resolve,c2);
}
function selectSlot(i){
 if(!G||G.phase!=='playing'||G.push===2)return;if(i<0||!G.board[i])return;
 if(swapFrom===null&&!playable(i)){banner('NOT THE FRONT CARD','info','Only lit cards can be played');return}
 if(swapFrom!==null){if(i!==swapFrom){[G.board[i],G.board[swapFrom]]=[G.board[swapFrom],G.board[i]];[G.protected[i],G.protected[swapFrom]]=[G.protected[swapFrom],G.protected[i]];const a=cardMeshes[i]?.position.clone(),b=cardMeshes[swapFrom]?.position.clone();meshCard(G.board[i],i,false,{from:b});meshCard(G.board[swapFrom],swapFrom,false,{from:a});G.swaps--;ensureStake();G.message='⇄ Swapped two cards';sound('swap');flash('ability',i,'⇄ SWAPPED')}swapFrom=null}
 G.selected=i;refresh();sound('select');flash('ability',i);
 if(lesson){if(lesson.step===0)lesson.step=1;renderLesson()}
}

/* ----------------------------- HUD -------------------------------- */
const hud = {score: 0, credits: 65, loadoutKey: '', lastCredits: null};
function fmt(text) {
  return esc(String(text || '').trim()).replace(/([♥♦])/g, '<span class="sr">$1&#xFE0E;</span>').replace(/([♠♣])/g, '<span class="sb">$1&#xFE0E;</span>');
}
function tokenDelta(n) {
  const host = $('tokensStat'); if (!host || !n) return;
  const d = document.createElement('span'); d.className = 'delta ' + (n > 0 ? 'up' : 'down'); d.textContent = (n > 0 ? '+' : '') + n;
  host.append(d); setTimeout(() => d.remove(), 1200);
}
function renderLoadout() {
  const key = G.ticket + '|' + G.artifacts.join(',');
  if (key === hud.loadoutKey) return; hud.loadoutKey = key;
  const t = TICKETS.find(x => x.id === G.ticket);
  $('ticketBadge').innerHTML = t ? icon(t.icon) : icon('star');
  $('ticketBadge').title = t ? t.name + ' — ' + t.desc : 'No ticket yet';
  $('ticketBadge').className = 'ticketBadge ' + (t ? 't-' + t.id : 'empty');
  $('artifacts').innerHTML = Array.from({length: 4}, (_, k) => {
    const a = ARTIFACTS.find(x => x.id === G.artifacts[k]);
    return a ? `<span class="art" title="${esc(a.name + ' — ' + a.desc)}">${icon(a.icon)}</span>` : '<span class="art empty" title="Empty artifact slot"></span>';
  }).join('');
}
function refresh(){
 if(!G)return;syncSlotEffects();if(!G.board[G.selected]||!playable(G.selected)){const k=G.board.findIndex((c,j)=>c&&playable(j));G.selected=k>=0?k:G.board.findIndex(Boolean)}
 $('stageLabel').textContent='Boss '+G.stage+' / '+FINAL;
 document.querySelectorAll('#bossChip .pips i').forEach((p,k)=>p.classList.toggle('on',k<G.stage));
 if(hud.lastCredits!==null&&G.credits!==hud.lastCredits&&!lesson)tokenDelta(G.credits-hud.lastCredits);
 hud.lastCredits=G.credits;
 $('tokens').textContent=G.credits;
 $('debt').textContent=G.tollDebt?G.tollDebt+' owed':'';
 $('deck').textContent=G.deck.length;
 $('deckBar').style.width=Math.max(0,Math.min(100,G.deck.length/Math.max(1,G.stageTotal)*100))+'%';
 $('streak').textContent=G.streak;
 const tier=G.streak>=9?3:G.streak>=6?2:G.streak>=3?1:0;
 $('streakMeter').dataset.tier=tier;
 $('streakLabel').textContent=['Streak','On fire','Super fire','Inferno · 3×'][tier];
 document.querySelectorAll('#streakMeter .segs i').forEach((s,k)=>s.classList.toggle('on',k<Math.min(9,G.streak)));
 $('boardCount').textContent=cardsLeft()+'/9';
 const lockedN=G.locked?.filter(Boolean).length||0;document.querySelectorAll('#locks .lk').forEach((l,k)=>l.classList.toggle('on',k<lockedN));
 $('needle').style.transform='rotate('+(-110+Math.min(9,G.streak)/9*220)+'deg)';
 renderLoadout();
 renderMech();
 $('message').innerHTML=fmt(G.message||((G.board[G.selected]?'Selected: '+rank(G.board[G.selected]):'Select a card')));
 $('detail').innerHTML=fmt(G.detail);
 const ready=G.phase==='playing'&&!!G.board[G.selected];$('higher').disabled=!ready;$('lower').disabled=!ready;
 for(const [id,active] of [['push',ready&&G.push===0],['shield',ready&&G.shields>0&&!G.protected[G.selected]],['peek',ready&&G.peeks>0],['swap',ready&&G.swaps>0],['cashout',ready&&G.streak>=3]])$(id).disabled=!active;
 const setTool=(id,label,badge)=>{$(id).querySelector('.tl').textContent=label;const b=$(id).querySelector('.badge');b.textContent=badge??'';b.hidden=badge==null};
 setTool('push',G.push===1?'Push 2/2':G.push===2?'Push 2/2':'Push',null);
 $('push').classList.toggle('armed',G.push>0);
 setTool('shield',G.protected[G.selected]?'Armed':'Shield',G.shields);
 $('shield').classList.toggle('armed',Boolean(G.protected[G.selected]));
 $('shield').title=G.protected[G.selected]?'Blocks one miss on this card. Push bypasses shields.':'One Shield per boss. Protect this card from one miss. Push bypasses shields.';
 setTool('peek','Peek',G.peeks);
 setTool('swap',swapFrom!==null?'Pick card':'Swap',G.swaps);
 $('swap').classList.toggle('armed',swapFrom!==null);
 setTool('cashout','Cash out',null);
 syncChips(Math.max(0,Math.min(30,Math.ceil(G.credits/6))));
}
function renderMech(){
 const id=bossId(),el=$('mech');let h='';
 if(lesson||!['sharp','elevator','roller','house'].includes(id)){el.innerHTML='';el.hidden=true;return}
 if(id==='sharp'){const n=G.stageGuesses%4,next=isDoubleNext();h=`<span class="mTray ${next?'lit':''}"><b>${next?'Double Draw next':'Double Draw'}</b><span class="mPips">${[0,1,2,3].map(k=>`<i class="${k<n||next&&k<3?'on':''}${k===3?' dd':''}"></i>`).join('')}</span></span>`}
 else if(id==='house'){h=`<span class="mStamps">${['♠','♥','♦','♣'].map(x=>`<i class="${G.stamps?.[x]?'on':''} ${x==='♥'||x==='♦'?'red':''}" title="${G.stamps?.[x]?'Stamped':'Not stamped yet'}">${suitSVG(x)}</i>`).join('')}</span>`}
 else if(id==='roller'){const st=G.board[G.stake],mt=G.board[G.stakeMate];h=st?`<span class="mStake"><b>Stake</b> ${fmt(rank(st))}${mt?` <em>risks ${fmt(rank(mt))}</em>`:''}</span>`:'<span class="mStake"><b>Stake</b> waiting for two cards</span>'}
 else if(id==='elevator'){h='<span class="mLanes"><b>3 lanes</b> front cards only</span>'}
 el.innerHTML=h;el.hidden=false;
}
function pressGuess(dir){const b=$(dir);b.classList.remove('fired');void b.offsetWidth;b.classList.add('fired');}

/* ---------------------------- audio ------------------------------- */
let audioContext, audioBus;
const foley = {
 deal: {clips:['deal-1','deal-2','deal-3'], gain:.37, gap:.055},
 land: {clips:['land-1','land-2'], gain:.38, gap:.055},
 flip: {clips:['flip'], gain:.32, rate:1.12},
 discard: {clips:['discard'], gain:.43},
 shuffle: {clips:['shuffle'], gain:.36},
 select: {clips:['deal-2'], gain:.16, rate:1.4},
 purchase: {clips:['purchase'], gain:.45},
 cashout: {clips:['tokens'], gain:.44},
 toll: {clips:['chip'], gain:.58, rate:.76},
 lock: {clips:['latch'], gain:.65},
 'floor-relay': {clips:['latch'],gain:.28,rate:1.48,gap:.12},
 'stamp-feed': {clips:['register'],gain:.24,rate:1.45,gap:.12},
 joker: {clips:['shuffle'], gain:.45, rate:.7},
 rev: {clips:['rev'], gain:.68},
 'entrance-toll': {clips:['register'], gain:.67},
 'entrance-collector': {clips:['latch'], gain:.78, rate:.83},
 'entrance-sharp': {clips:['shuffle'], gain:.55, rate:1.25},
 'entrance-elevator': {clips:['latch'], gain:.6, rate:1.35},
 'entrance-roller': {clips:['tokens'], gain:.6},
 'entrance-house': {clips:['register'], gain:.67, rate:.8},
 'entrance-driver': {clips:['ignition'], gain:.72},
 ui: {clips:['chip'], gain:.22, rate:1.5, gap:.04}
};
const assetNames = new Set(Object.values(foley).flatMap(cue => cue.clips));
const soundBytes = new Map([...assetNames].map(name => [name, fetch('./sfx/' + name + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)]));
const soundBuffers = new Map(), soundLoading = new Map(), cueLastPlayed = new Map(), cueVariant = new Map();
function openAudio() {
 if(!soundOn)return false;
 if(!audioContext){
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(!Audio)return false;
  audioContext = new Audio(); audioBus = audioContext.createGain(); audioBus.gain.value = .76; audioBus.connect(audioContext.destination);
  startBossMusic();
  for(const name of assetNames)loadSound(name);
 }
 if(audioContext.state!=='running')audioContext.resume().catch(()=>{});
 return true;
}
function loadSound(name) {
 if(!soundLoading.has(name)){
  const task = soundBytes.get(name).then(bytes => bytes ? audioContext.decodeAudioData(bytes.slice(0)) : null).then(buffer => { if(buffer)soundBuffers.set(name,buffer); return buffer; }).catch(()=>null);
  soundLoading.set(name,task);
 }
 return soundLoading.get(name);
}
function playSample(kind, cue) {
 const now=performance.now();
 if(now-(cueLastPlayed.get(kind)??-Infinity)<(cue.gap??0)*1000)return;
 cueLastPlayed.set(kind,now);
 const index=cueVariant.get(kind)??0, name=cue.clips[index%cue.clips.length];
 cueVariant.set(kind,index+1);
 const play=buffer=>{
  if(!buffer||!soundOn||performance.now()-now>500)return;
  const source=audioContext.createBufferSource(), level=audioContext.createGain();
  source.buffer=buffer; source.playbackRate.value=cue.rate??1; level.gain.value=cue.gain;
  source.connect(level).connect(audioBus); source.start();
 };
 const buffer=soundBuffers.get(name);
 if(buffer)play(buffer); else loadSound(name).then(play).catch(()=>{});
}
function toggleSound() { soundOn=!soundOn; if(audioBus)audioBus.gain.setTargetAtTime(soundOn?.76:0,audioContext.currentTime,.014); if(soundOn)sound('select'); }
function sound(kind) {
 try {
  if(!openAudio())return;
  if(Object.hasOwn(foley,kind)){playSample(kind,foley[kind]);return}
  const cues={good:[540,740,.10],bad:[220,150,.09],shield:[420,660,.15],peek:[740,990,.11],swap:[400,630,.11],push:[260,430,.09],line:[580,900,.14]};
  const t=audioContext.currentTime;
  if(kind==='service-bell'){
   for(const [frequency,length,volume] of [[1035,.55,.078],[2630,.24,.025],[3910,.12,.014]])playTone(t,frequency,frequency*.998,length,volume);
  }else if(kind==='victory'||kind==='defeat'){
   const notes=kind==='victory'?[220,277.18,329.63,440]:[146.83,110,82.41];
   notes.forEach((note,i)=>playTone(t+i*.12,note,note,.45,.075));
  }else if(Object.hasOwn(cues,kind)){const [from,to,volume]=cues[kind];playTone(t,from,to,.12,volume);}
 }catch(error){console.debug('HiLo audio unavailable',error);}
}
function playTone(at, from, to, duration, volume) {
 const voice=audioContext.createOscillator(), gain=audioContext.createGain();
 voice.type='sine'; voice.frequency.setValueAtTime(from,at); voice.frequency.exponentialRampToValueAtTime(to,at+duration);
 gain.gain.setValueAtTime(.0001,at); gain.gain.linearRampToValueAtTime(volume,at+.014); gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 voice.connect(gain).connect(audioBus); voice.start(at); voice.stop(at+duration+.01);
}

/* ---------------------------- screens ----------------------------- */
let screenName = '';
function openScreen(name, node) {
  const s = $('screen'); s.dataset.screen = name; s.className = 'screen' + (reduced ? ' still' : '');
  s.replaceChildren(node); s.scrollTop = 0; screenName = name; document.body.dataset.screen = name;
  s.querySelectorAll('button:not([data-silent])').forEach(b => b.addEventListener('pointerdown', () => sound('ui')));
  requestAnimationFrame(() => (node.querySelector('[data-autofocus]') || node.querySelector('button:not(:disabled)'))?.focus({preventScroll: true}));
}
function hideDialog() { const s = $('screen'); s.className = 'screen hidden'; s.replaceChildren(); screenName = ''; document.body.dataset.screen = ''; }
const cardImgCache = new Map();
function cardImage(card) {
  const key = card.joker ? 'J' : artBoss + ':' + card.v + card.s;
  if (!cardImgCache.has(key)) { const c = document.createElement('canvas'); c.width = CARD_W; c.height = CARD_H; cardFace(c.getContext('2d'), card); cardImgCache.set(key, c.toDataURL('image/png')); }
  return cardImgCache.get(key);
}
function readBest() { try { return Number(localStorage.getItem(bestKey)) || 0; } catch (e) { return 0; } }
function showTitle() {
  const best = readBest();
  let seen = false; try { seen = localStorage.getItem('hilo-tutorial-v1') === 'done'; } catch (e) {}
  const fan = [{v: 0, s: '♠'}, {v: 12, s: '♥'}, {joker: true}, {v: 11, s: '♦'}, {v: 10, s: '♣'}];
  const node = html(`<div class="title">
    <div class="fan">${fan.map((c, i) => `<img class="fanCard f${i}" src="${cardImage(c)}" alt="">`).join('')}</div>
    <h1 class="logo"><span class="hi">HI</span><span class="mid">${suitSVG('♠')}</span><span class="lo">LO</span></h1>
    <p class="tagline">Beat the deck. Break the house.</p>
    <div class="titleBtns">
      <button class="btn primary big" data-a="start" data-autofocus>${icon('play')} Start run</button>
      <div class="titleRow">
        <button class="btn ghost" data-a="learn">${icon('book')} How to play${seen ? '' : ' <em class="new">New</em>'}</button>
        <a class="btn ghost" href="../table-battle/">${icon('vs')} Table Battle</a>
      </div>
    </div>
    ${best ? `<div class="bestScore">${icon('trophy')} Best run <b>${best.toLocaleString()}</b></div>` : ''}
    ${document.body.dataset.tablePreview ? `<details class="boss-preview"><summary>Try a boss table</summary><div>${[4,3,5,6].map(stage => `<button class="btn ghost" data-preview-stage="${stage}">${esc(BOSSES[stage-1].name)}</button>`).join('')}</div></details>` : ''}
    <div class="titleFoot">Higher or lower · 7 bosses · 9 positions · Ace is low, ties lose</div>
  </div>`);
  node.querySelector('[data-a=start]').onclick = () => { sound('purchase'); chooseTicket(); };
  node.querySelector('[data-a=learn]').onclick = startLesson;
  node.querySelectorAll('[data-preview-stage]').forEach(button => {
    button.onclick = () => chooseTicket(Number(button.dataset.previewStage));
  });
  openScreen('title', node);
}
function chooseTicket(firstStage = 1) {
  const node = html(`<div class="sheet ticketSheet">
    <div class="kicker">New run · Choose a perk</div>
    <h2>Pick your ticket</h2>
    <p class="sub">Your ticket rides with you for all seven bosses.</p>
    <div class="tickets">${TICKETS.map(t => `<button class="ticket t-${t.id}" data-id="${t.id}">
      <span class="stub">${icon(t.icon)}<small>No. ${t.id === 'lucky' ? '007' : t.id === 'fire' ? '333' : '040'}</small></span>
      <span class="tbody"><span class="tname">${esc(t.name)}</span><span class="tbrief">${esc(brief[t.name])}</span><span class="tdesc">${esc(t.desc)}</span><span class="tfoot">Admit one · Midnight Table</span></span>
    </button>`).join('')}</div>
  </div>`);
  node.querySelectorAll('.ticket').forEach(b => b.onclick = () => { sound('purchase'); G.ticket = b.dataset.id; shop(firstStage, true); });
  openScreen('ticket', node);
}
function renderShop(stage) {
  const boss = BOSS_PRESENTATION[stage - 1];
  const offers = [];
  for (const id of shopOffers.artifacts) {
    const a = ARTIFACTS.find(x => x.id === id); if (!a) continue;
    const price = a.cost + 15 * G.artifacts.length;
    const full = G.artifacts.length >= 4, poor = G.credits < price;
    offers.push({kind: 'artifact', item: a, price, disabled: poor || full, why: full ? 'Artifact slots full' : poor ? 'Need ' + (price - G.credits) + ' more' : '',
      click: () => { if (G.credits < price || G.artifacts.length >= 4) return; sound('purchase'); G.credits -= price; G.artifacts.push(id); shopOffers.artifacts = shopOffers.artifacts.filter(x => x !== id); shop(stage); }});
  }
  const ups = [];
  for (const id of shopOffers.upgrades) {
    const up = UPGRADES.find(x => x.id === id); if (!up) continue;
    const price = up.cost + 10 * G.upgrades.filter(Boolean).length;
    const full = G.upgrades.every(Boolean), poor = G.credits < price;
    ups.push({kind: 'board', item: up, price, disabled: poor || full, why: full ? 'Every position upgraded' : poor ? 'Need ' + (price - G.credits) + ' more' : '', click: () => chooseSlot(stage, up)});
  }
  const offerHTML = (o, k) => `<button class="offer o-${o.kind}" data-k="${k}" ${o.disabled ? 'disabled' : ''} style="--c:${o.kind === 'board' ? hex(UPGRADE_COLORS[o.item.id]) : 'var(--gold)'}">
      <span class="medal">${icon(o.item.icon)}</span>
      <span class="otext"><span class="otype">${o.kind === 'board' ? 'Table upgrade' : 'Artifact'}</span><b>${esc(o.item.name)}</b><strong>${esc(brief[o.item.name] || '')}</strong><small>${esc(o.item.desc)}</small></span>
      <span class="price">${icon('chip')} ${o.price}</span>${o.why ? `<span class="why">${esc(o.why)}</span>` : ''}
    </button>`;
  const sold = label => `<div class="offer sold"><span>${label}</span></div>`;
  const all = [...offers, ...ups];
  const aHTML = offers.map(o => offerHTML(o, all.indexOf(o))).join('') + sold('Sold').repeat(Math.max(0, 2 - offers.length));
  const uHTML = ups.map(o => offerHTML(o, all.indexOf(o))).join('') + sold('Installed').repeat(Math.max(0, 2 - ups.length));
  const t = TICKETS.find(x => x.id === G.ticket);
  const node = html(`<div class="sheet shopSheet">
    <div class="shopHead">
      <div><div class="kicker">Before boss ${stage} of ${FINAL}</div><h2>The Pit Stop</h2></div>
      <div class="wallet">${icon('chip')}<b>${G.credits}</b><small>tokens${G.tollDebt ? ' · ' + G.tollDebt + ' owed' : ''}</small></div>
    </div>
    <div class="shopCols">
      <section><h3>Artifacts <small>${G.artifacts.length}/4 equipped</small></h3><div class="offers">${aHTML}</div></section>
      <section><h3>Table upgrades <small>one per position</small></h3><div class="offers">${uHTML}</div></section>
    </div>
    <div class="owned"><span class="ownedLabel">Loadout</span>
      ${t ? `<span class="chipTag t-${t.id}" title="${esc(t.desc)}">${icon(t.icon)} ${esc(t.name)}</span>` : ''}
      ${G.artifacts.map(id => { const a = ARTIFACTS.find(x => x.id === id); return `<span class="chipTag" title="${esc(a.desc)}">${icon(a.icon)} ${esc(a.name)}</span>`; }).join('') || '<span class="none">No artifacts yet</span>'}
    </div>
    <div class="shopFoot">
      <button class="btn ghost reroll" data-a="reroll" ${G.credits < 15 ? 'disabled' : ''}>${icon('reroll')} Reroll <span class="price">${icon('chip')} 15</span></button>
      <div class="nextBoss"><span class="emblem">${suitSVG(boss.mark)}</span><div><small>Next up</small><b>${esc(boss.name)}</b><span>${esc(boss.rule)}</span></div></div>
      <button class="btn primary big" data-a="go" data-autofocus>Face ${esc(boss.name)} ${icon('arrow')}</button>
    </div>
  </div>`);
  node.querySelectorAll('.offer[data-k]').forEach(b => b.onclick = all[+b.dataset.k].click);
  node.querySelector('[data-a=reroll]').onclick = () => { if (G.credits < 15) return; sound('purchase'); G.credits -= 15; shop(stage, true); };
  node.querySelector('[data-a=go]').onclick = () => enterBoss(stage);
  openScreen('shop', node);
}
function chooseSlot(stage, up) {
  const price = up.cost + 10 * G.upgrades.filter(Boolean).length;
  const node = html(`<div class="sheet slotSheet" style="--c:${hex(UPGRADE_COLORS[up.id])}">
    <div class="kicker">Table upgrade · ${icon('chip')} ${price} tokens</div>
    <h2><span class="medal">${icon(up.icon)}</span> Place ${esc(up.name)}</h2>
    <p class="sub">${esc(up.desc)} Each position holds one permanent upgrade.</p>
    <div class="miniBoard">${Array.from({length: 9}, (_, i) => {
      const cur = UPGRADES.find(u => u.id === G.upgrades[i]);
      const dis = !!G.upgrades[i] || G.credits < price;
      return `<button class="mini" data-i="${i}" ${dis ? 'disabled' : ''} ${cur ? `style="--u:${hex(UPGRADE_COLORS[cur.id])}"` : ''}>${cur ? icon(cur.icon) + `<small>${esc(cur.name)}</small>` : `<span class="n">${i + 1}</span><small>Place here</small>`}</button>`;
    }).join('')}</div>
    <button class="btn ghost" data-a="back">${icon('back')} Back to Pit Stop</button>
  </div>`);
  node.querySelectorAll('.mini').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (G.upgrades[i] || G.credits < price) return; sound('purchase'); G.credits -= price; G.upgrades[i] = up.id; shopOffers.upgrades = shopOffers.upgrades.filter(x => x !== up.id); shop(stage); });
  node.querySelector('[data-a=back]').onclick = () => shop(stage);
  openScreen('slot', node);
}
function confetti() {
  if (reduced) return;
  const host = $('fxLayer'), colors = ['#f3c45f', '#ff7d5c', '#7fe3d6', '#c18aff', '#fff3d6'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i'); p.className = 'confetti';
    p.style.left = (crand() * 100) + 'vw'; p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', ((crand() - .5) * 240) + 'px'); p.style.setProperty('--r', (crand() * 1080 - 540) + 'deg');
    p.style.animationDelay = (crand() * .6) + 's'; p.style.animationDuration = (2.2 + crand() * 1.6) + 's';
    host.append(p); setTimeout(() => p.remove(), 4600);
  }
}
function showRunResult(win, reason, best, isNew) {
  const stats = [['Correct', G.correct], ['Best streak', G.best], ['Boss', G.stage + ' / ' + FINAL], ['Tokens', G.credits]];
  const node = html(`<div class="sheet resultSheet ${win ? 'win' : 'lose'}">
    <div class="resultIcon">${icon(win ? 'trophy' : 'bust')}</div>
    <div class="kicker">${win ? 'The Final Driver is defeated' : 'End of the road'}</div>
    <h2>${win ? 'House beaten' : 'Run over'}</h2>
    ${reason ? `<p class="sub">${esc(reason)}</p>` : ''}
    <div class="resultScore" data-to="${G.score}">0</div>
    <div class="resultCaption">points${isNew && G.score > 0 ? ' <em class="newBest">New best</em>' : ''}</div>
    <div class="statGrid">${stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <div class="bestLine">${icon('trophy')} Best run ${best.toLocaleString()}</div>
    <button class="btn primary big" data-a="again" data-autofocus>${icon('restart')} Play again</button>
  </div>`);
  node.querySelector('[data-a=again]').onclick = () => { hideDialog(); newRun(); };
  openScreen(win ? 'victory' : 'defeat', node);
  const el = node.querySelector('.resultScore'), to = G.score, t0 = performance.now(), dur = reduced ? 1 : 1400;
  const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3; el.textContent = Math.round(to * e).toLocaleString(); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  sound(win ? 'victory' : 'defeat');
  if (win) confetti();
}
function showRunInfo() {
  const boss = BOSS_PRESENTATION[G.stage - 1];
  const t = TICKETS.find(x => x.id === G.ticket);
  const upgrades = G.upgrades.map((id, i) => id ? {i, up: UPGRADES.find(u => u.id === id)} : null).filter(Boolean);
  const node = html(`<div class="sheet infoSheet">
    <button class="closeX" data-a="close" aria-label="Close">${icon('close')}</button>
    <div class="infoBoss"><span class="emblem">${suitSVG(boss.mark)}</span><div><div class="kicker">Boss ${G.stage} of ${FINAL}</div><h2>${esc(boss.name)}</h2><p class="sub">${esc(BOSSES[G.stage - 1].desc)}</p></div></div>
    <div class="infoGrid">
      <section><h3>How it works</h3><ul class="rules">
        <li><b>Pick a card</b> on the table, then call the next card <b>Higher</b> or <b>Lower</b>.</li>
        <li><b>Ace is low. Ties lose.</b> A miss removes that position.</li>
        <li>Riskier calls pay more points. Middle cards (5–9) pay a bonus.</li>
        <li>Regular refills come every 2 correct calls in bosses 1–2, then every 4 correct calls within each boss. Every 3 wins in a row also earns a refill. When both milestones coincide, they share one refill.</li>
        <li>Each <b>Joker</b> shuffles five extra cards into the deck.</li>
        <li>Clear the deck to beat the boss. Lose every card and the run ends.</li>
      </ul></section>
      <section><h3>Your run</h3>
        <div class="statGrid small"><div><small>Score</small><b>${G.score.toLocaleString()}</b></div><div><small>Correct</small><b>${G.correct}</b></div><div><small>Streak</small><b>${G.streak}</b></div><div><small>Board</small><b>${cardsLeft()}/9</b></div></div>
        <div class="loadList">
          ${t ? `<div class="loadItem">${icon(t.icon)}<div><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></div></div>` : ''}
          ${G.artifacts.map(id => { const a = ARTIFACTS.find(x => x.id === id); return `<div class="loadItem">${icon(a.icon)}<div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div></div>`; }).join('')}
          ${upgrades.map(({i, up}) => `<div class="loadItem" style="--c:${hex(UPGRADE_COLORS[up.id])}">${icon(up.icon)}<div><b>${esc(up.name)} · position ${i + 1}</b><span>${esc(up.desc)}</span></div></div>`).join('')}
          ${!t && !G.artifacts.length && !upgrades.length ? '<p class="sub">Nothing collected yet.</p>' : ''}
        </div>
      </section>
    </div>
    <div class="keys"><kbd>H</kbd> Higher <kbd>L</kbd> Lower <kbd>1</kbd>–<kbd>9</kbd> Pick a position</div>
  </div>`);
  node.querySelector('[data-a=close]').onclick = hideDialog;
  openScreen('info', node);
}
function showSettings() {
  const node = html(`<div class="sheet settingsSheet">
    <button class="closeX" data-a="close" aria-label="Close settings">${icon('close')}</button>
    <div class="kicker">Options</div><h2>Settings</h2>
    <div class="settingRows"></div>
    <button class="btn ghost" data-a="practice" ${G.phase === 'busy' || lesson ? 'disabled' : ''}>${icon('book')} Practice tutorial</button>
  </div>`);
  const rows = node.querySelector('.settingRows');
  for (const [label, sub, checked, change] of [
    ['Sound effects', 'Cards, chips and boss cues', soundOn, () => toggleSound()],
    ['Ambient music', 'A low drone that rises with your streak', musicOn, () => { musicOn = !musicOn; openAudio(); }],
    ['Reduced motion', 'Instant cards, no shake or particles', reduced, () => { reduced = !reduced; }],
    ['High quality graphics', 'Sharper rendering and soft shadows', quality, () => { quality = !quality; try { localStorage.setItem('hilo-quality', quality ? 'high' : 'low'); } catch (e) {} resizeScene(); }]
  ]) {
    const row = html(`<label class="settingRow"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" role="switch" ${checked ? 'checked' : ''}></label>`);
    row.querySelector('input').onchange = change; rows.append(row);
  }
  node.querySelector('[data-a=close]').onclick = hideDialog;
  node.querySelector('[data-a=practice]').onclick = startLesson;
  openScreen('settings', node);
}
function confirmRestart() {
  const node = html(`<div class="sheet confirmSheet"><div class="kicker">Restart</div><h2>Start a new run?</h2><p class="sub">Your current run will be lost.</p>
    <div class="row"><button class="btn ghost" data-a="no" data-autofocus>Keep playing</button><button class="btn danger" data-a="yes">${icon('restart')} Restart</button></div></div>`);
  node.querySelector('[data-a=no]').onclick = hideDialog;
  node.querySelector('[data-a=yes]').onclick = () => { hideDialog(); newRun(); };
  openScreen('confirm', node);
}

/* ---------------------------- lesson ------------------------------ */
let lesson=null;
function rememberLesson(){try{localStorage.setItem('hilo-tutorial-v1','done')}catch(e){}}
function startLesson(){
 if(lesson||G.phase==='busy')return;
 lesson={saved:G,step:0};hideDialog();cancelBossEntry();resetCasino();animations=[];
 G={...G,board:[{v:3,s:'♥'},null,null,null,null,null,null,null,null],deck:[{v:12,s:'♠'},{v:8,s:'♦'}],selected:0,phase:'playing',score:0,streak:0,credits:0,shields:1,protected:Array(9).fill(false),upgrades:Array(9).fill(null),locked:Array(9).fill(false),artifacts:[],push:0,message:'Practice table',detail:''};
 hud.score=0;
 for(let i=0;i<9;i++)meshCard(G.board[i],i);refresh();$('lesson').hidden=false;document.body.dataset.lesson='true';renderLesson();
}
function renderLesson(){
 if(!lesson)return;
 const steps=[
 ['Pick your card','Tap the 4 of hearts on the table. The glow marks the card you are playing.'],
 ['Higher or lower?','Will the next card beat 4? Press Higher. Aces are low; ties lose.'],
 ['Protect your position','The 9 replaced your card. Press Shield to protect it from one miss.'],
 ['Try a protected miss','Press Lower. This practice draw is a King, so your shield will block the miss.'],
 ['You’re ready','Without protection, a miss removes that position. Clear seven decks to win; keep two cards for the final boss. Each boss gives you one Shield. Streaks refill slots. Fill all nine slots to earn a Peek.']
 ];
 const [title,copy]=steps[lesson.step];$('lessonStep').textContent='Practice · '+(lesson.step+1)+' / 5';$('lessonTitle').textContent=title;$('lessonCopy').textContent=copy;
 $('lessonDots').innerHTML=steps.map((_,k)=>`<i class="${k<=lesson.step?'on':''}"></i>`).join('');
 $('lessonNext').hidden=lesson.step!==4;$('lessonNext').textContent='Play';
 for(const id of ['higher','lower','shield'])$(id).classList.remove('lessonTarget');
 const target=[null,'higher','shield','lower',null][lesson.step];if(target)$(target).classList.add('lessonTarget');
 for(const id of ['push','peek','swap','cashout','restart','settings','runInfo'])$(id).disabled=true;
 $('higher').disabled=lesson.step!==1;$('lower').disabled=lesson.step!==3;$('shield').disabled=lesson.step!==2;
}
function finishLesson(){
 if(!lesson)return;const saved=lesson.saved;lesson=null;G=saved;animations=[];resetCasino();
 $('lesson').hidden=true;document.body.dataset.lesson='';for(const id of ['higher','lower','shield'])$(id).classList.remove('lessonTarget');
 for(const id of ['restart','settings','runInfo'])$(id).disabled=false;
 hud.score=G.score;hud.lastCredits=G.credits;
 for(let i=0;i<9;i++)meshCard(G.board[i],i);refresh();rememberLesson();
 if(G.phase==='ticket')chooseTicket();else hideDialog();
}
function lessonGuess(dir){
 if(lesson.step===1&&dir==='higher'){
  G.board[0]={v:8,s:'♦'};meshCard(G.board[0],0,true);G.score=100;G.deck.pop();floatLabel('+100',0);sound('good');flash('positive',0);lesson.step=2;
 }else if(lesson.step===3&&dir==='lower'){
  G.protected[0]=false;showDrawnCard(G.deck.pop());sound('shield');flash('ability',0,'SHIELD BLOCK');lesson.step=4;
 }else return;
 refresh();renderLesson();
}
$('lessonSkip').onclick=finishLesson;$('lessonNext').onclick=finishLesson;

/* ----------------------------- input ------------------------------ */
$('higher').onclick=()=>guess('higher');$('lower').onclick=()=>guess('lower');
$('restart').onclick=confirmRestart;
$('push').onclick=()=>{if(G.phase!=='playing'||G.push)return;G.push=1;G.message='Push: win twice on this card for a Peek · misses bypass protection';sound('push');flash('ability',G.selected,'PUSH YOUR LUCK');refresh()};
$('shield').onclick=()=>{if(lesson){if(lesson.step!==2)return;G.shields=0;G.protected[0]=true;lesson.step=3;refresh();sound('shield');flash('ability',0);renderLesson();return}if(!G.shields||G.phase!=='playing'||!G.board[G.selected]||G.protected[G.selected])return;G.shields--;G.protected[G.selected]=true;G.message=rank(G.board[G.selected])+' protected · one miss';sound('shield');flash('ability',G.selected,'PROTECTED');refresh()};
$('peek').onclick=()=>{if(!G.peeks||G.phase!=='playing')return;G.peeks--;const c=[...G.deck].reverse().find(x=>!x.joker);G.message=c?'Next regular card: '+rank(c):'No regular card left';sound('peek');flash('ability',G.selected,c?'NEXT: '+rank(c):'NO REGULAR CARD');refresh()};
$('swap').onclick=()=>{if(!G.swaps||G.phase!=='playing')return;swapFrom=G.selected;G.message='⇄ Select another occupied card to swap';sound('swap');flash('ability',G.selected,'⇄ SELECT SECOND CARD');refresh()};
$('cashout').onclick=()=>{if(G.phase!=='playing'||G.streak<3)return;G.streak=0;const earned=grantTokens(8);G.message='Streak cashed out · '+(earned?'+'+earned+' tokens':'No spendable tokens gained');sound('cashout');flash('ability',G.selected,'STREAK CASHED OUT');refresh()};
$('runInfo').onclick=showRunInfo; $('bossChip').onclick=()=>{if(!lesson)showRunInfo()};
$('settings').onclick=showSettings;
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
function hitCard(e) {
  pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = 1 - e.clientY / innerHeight * 2;
  ray.setFromCamera(pointer, camera);
  let o = ray.intersectObjects(cardMeshes.filter(Boolean), true)[0]?.object;
  while (o && o.userData.index === undefined) o = o.parent;
  return o ? o.userData.index : -1;
}
$('scene').addEventListener('pointermove', e => { hovered = hitCard(e); $('scene').style.cursor = hovered >= 0 && G?.phase === 'playing' ? 'pointer' : 'default'; });
$('scene').addEventListener('pointerleave', () => { hovered = -1; });
$('scene').addEventListener('click', e => { if (G.phase !== 'playing' || G.push === 2) return; const i = hitCard(e); if (i < 0) return; selectSlot(i); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ['settings', 'info', 'confirm'].includes(screenName)) { hideDialog(); return; }
  if (pendingBoss !== null && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); bossBegin?.(); return; }
  if (screenName || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'h' || k === 'arrowup') { e.preventDefault(); guess('higher'); }
  else if (k === 'l' || k === 'arrowdown') { e.preventDefault(); guess('lower'); }
  else if (/^[1-9]$/.test(k)) selectSlot(+k - 1);
});
const layoutObserver = new ResizeObserver(positionCamera);
layoutObserver.observe($('topbar')); layoutObserver.observe($('panel'));
addEventListener('resize', resizeScene);

/* ---------------------------- render loop ------------------------- */
const baseSpot = new THREE.Color(0xffd9a8), fireSpot = new THREE.Color(0xffa060);
const tmpV = new THREE.Vector3();
let lastTime = 0, orbit = 0;
const clamp01 = x => THREE.MathUtils.clamp(x,0,1);
function animateCasino(now, dt) {
  animateSparks(dt);
  const active = G?.phase === 'playing' || G?.phase === 'busy';
  const target = active ? Math.min(1, Math.floor(G.streak / 3) / 3) : 0;
  casino.heat = THREE.MathUtils.damp(casino.heat, target, 2.5, dt);
  const joker = now < casino.jokerUntil;
  document.body.dataset.joker = String(joker);
  document.body.style.setProperty('--heat', casino.heat.toFixed(3));
  warmLight.intensity = casino.heat * 26;
  trimMat.emissiveIntensity = casino.heat * 2.2;
  spot.color.copy(baseSpot).lerp(fireSpot, casino.heat * .6);
  spot.intensity = THREE.MathUtils.damp(spot.intensity, joker ? 70 : 160, 7, dt);
  jokerLight.intensity = THREE.MathUtils.damp(jokerLight.intensity, joker ? 40 : 0, 8, dt);
  // streak fire rising off the active card
  if (!reduced && casino.heat > .05 && active && cardMeshes[G.selected]) {
    const m = cardMeshes[G.selected], rate = casino.heat * 70 * dt;
    for (let k = 0; k < rate + (crand() < rate % 1 ? 1 : 0); k++) {
      const side = crand() < .5, ex = side ? (crand() - .5) * CW : (crand() < .5 ? -1 : 1) * CW / 2, ez = side ? (crand() < .5 ? -1 : 1) * CH / 2 : (crand() - .5) * CH;
      spawnSpark(m.position.x + ex, m.position.y + .02, m.position.z + ez, crand() < .4 ? 0xffe08a : 0xff7a2c, (crand() - .5) * .2, .3 + crand() * .5, (crand() - .5) * .2, .6 + crand() * .5, .08 + crand() * .09, true);
    }
  }
  // joker reveal
  jokerMesh.visible = joker;
  if (joker) {
    const total = reduced ? 650 : 1500, k = Math.max(0, 1 - (casino.jokerUntil - now) / total);
    const rise = Math.min(1, k * 3.2), e = 1 - (1 - rise) ** 3;
    jokerMesh.scale.setScalar(reduced ? 1.3 : 1 + e * .9);
    jokerMesh.position.set(THREE.MathUtils.lerp(deckX, 1.4, e), deckTopY() + e * 2.2 - Math.max(0, k - .8) * 4, THREE.MathUtils.lerp(deckZ, -.4, e));
    jokerMesh.rotation.set(-.5 * e, Math.sin(k * Math.PI * 2) * .12, reduced ? 0 : Math.PI * (1 - Math.min(1, k * 2.4)));
    jokerLight.position.copy(jokerMesh.position).y += .8;
  }
  // draw reveal
  if (revealMotion && now >= revealMotion.start) {
    const r = revealMotion, dest = slots[r.slot];
    if (!r.started) { r.started = true; sound('deal'); }
    const fly = (card, t, ox) => {
      const slide = Math.min(1, t / .42), flip = Math.max(0, Math.min(1, (t - .42) / .3));
      const ease = 1 - (1 - slide) ** 3, fe = flip * flip * (3 - 2 * flip);
      card.position.set(THREE.MathUtils.lerp(deckX, dest.x + ox, ease), THREE.MathUtils.lerp(deckTopY(), CARD_Y + .62, ease) + Math.sin(Math.PI * slide) * .5 + Math.sin(Math.PI * flip) * .35, THREE.MathUtils.lerp(deckZ, dest.z + .32, ease));
      card.rotation.set(-.32 * ease, ox * -.15 * ease, Math.PI * (1 - fe));
      // Lift the leading corner just before the main flip and let it fall flat on reveal.
      const bend = clamp01((t-.28)/.17) * (1-clamp01((t-.51)/.20));
      for (const layer of card.children) layer.morphTargetInfluences[0] = reduced ? 0 : bend;
      return {slide, flip};
    };
    const t = Math.min(1, (now - r.start) / r.duration);
    const a1 = fly(drawnCard, t, r.two ? -(CW + .12)/2 : 0);
    let done = t >= 1;
    if (r.two) { const t2 = Math.min(1, (now - r.start - 260) / r.duration); fly(drawnCard2, Math.max(0, t2), (CW + .12)/2); done = t2 >= 1; if (!r.second && t2 > .45) { r.second = true; sound('land'); } }
    if (!r.slid && a1.slide >= 1) { r.slid = true; sound('land'); }
    if (!r.flipped && a1.flip > .5) { r.flipped = true; sound('flip'); }
    if (done) { revealMotion = null; drawRevealUntil = 0; revealPos = drawnCard.position.clone(); revealPos2 = drawnCard2.position.clone(); r.resolve(); }
  }
  drawnCard2.visible = !!(revealMotion && revealMotion.two && now >= revealMotion.start + 260);
  drawnCard.visible = !joker && (revealMotion ? now >= revealMotion.start : now < drawRevealUntil);
  drawnFace.opacity = revealMotion || reduced ? 1 : Math.min(1, Math.max(0, (drawRevealUntil - now) / 300));
  if (!revealMotion && now < drawRevealUntil) drawnCard.rotation.set(-.32, 0, 0);
  // glows
  const ready = G?.phase === 'playing';
  for (let i = 0; i < 9; i++) {
    const fx = highlights[i], alive = fx && now < fx.end;
    const sel = G?.selected === i && (ready || G?.phase === 'busy') && !!G.board[i];
    const hov = hovered === i && ready && !!G?.board[i];
    const m = selGlows[i].material;
    let color = 0xffd36b, op = sel ? .95 : hov ? .35 : 0;
    if (swapFrom !== null && swapFrom === i) { color = 0x86ddff; op = .9; }
    if (alive) { color = fx.kind === 'negative' ? 0xff4a3a : fx.kind === 'positive' ? 0x8dff6a : 0x6fd3ff; op = Math.max(op, 1.4 * (fx.end - now) / 620); }
    m.color.setHex(color); m.opacity = THREE.MathUtils.damp(m.opacity, op, 14, dt);
    if (sel && !alive) m.opacity *= .85 + Math.sin(now * .005) * .15;
    upRings[i].material.opacity = .55 + Math.sin(now * .003 + i) * .2;
    lockMeshes[i].material.opacity = .75 + Math.sin(now * .004) * .2;
    const card = cardMeshes[i];
    if (card) {
      const impact = Math.max(0, (casino.shieldUntil[i] - now) / 700);
      const prot = G?.protected[i];
      if ((prot || impact) && !card.userData.shield) { const s = new THREE.Mesh(shieldRingGeo, additive(0x8ae8ff, ringTex)); s.position.y = CT / 2 + .004; s.renderOrder = 4; card.add(s); card.userData.shield = s; }
      const s = card.userData.shield;
      if (s) { s.visible = !!(prot || impact); s.material.opacity = impact ? Math.min(1, impact * 1.4) : .55 + Math.sin(now * .006) * .25; s.scale.setScalar(1 + (impact ? (1 - impact) * .18 : 0)); }
    }
  }
  lineGlows.forEach((line, i) => { line.material.opacity = Math.max(0, (casino.lineUntil[i] - now) / 1100) * 1.1; });
  if (musicGain) {
    const pulse = reduced ? 1 : .85 + Math.sin(now * .0018) * .15;
    const volume = musicOn && active && !joker ? .034 * pulse + casino.heat * .014 : 0;
    musicGain.gain.setTargetAtTime(volume, audioContext.currentTime, .2);
  }
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(.05, (now - lastTime) / 1000 || .016); lastTime = now;
  for (let i = animations.length - 1; i >= 0; i--) {
    const a = animations[i]; if (!a.m.parent) { animations.splice(i, 1); continue; }
    const t = Math.min(1, (now - a.start) / a.duration), q = 1 - (1 - t) ** 3;
    a.m.position.set(THREE.MathUtils.lerp(deckX, a.p.x, q), THREE.MathUtils.lerp(deckTopY(), CARD_Y, q) + Math.sin(Math.PI * t) * .7, THREE.MathUtils.lerp(deckZ, a.p.z, q));
    a.m.rotation.set(0, (1 - q) * .3, Math.PI * (1 - Math.min(1, t * 1.3)));
    if (t >= 1) { animations.splice(i, 1); a.m.rotation.set(0, 0, 0); sound('land'); }
  }
  for (let i = discards.length - 1; i >= 0; i--) {
    const d = discards[i], t = Math.min(1, (now - d.start) / d.duration), q = t * t * (3 - 2 * t);
    d.m.position.set(THREE.MathUtils.lerp(d.from.x, d.target.pos.x, q), THREE.MathUtils.lerp(d.from.y, d.target.pos.y, q) + Math.sin(Math.PI * t) * .55, THREE.MathUtils.lerp(d.from.z, d.target.pos.z, q));
    d.m.rotation.set(0, THREE.MathUtils.lerp(d.ry, d.target.rotY + Math.PI * 2, q), d.rz * (1 - q));
    if (t >= 1) { discards.splice(i, 1); d.m.rotation.set(0, d.target.rotY, 0); addToPile(d.m); }
  }
  for (const m of cardMeshes) if (m && !animations.some(a => a.m === m)) {
    const i = m.userData.index, p = slots[i];
    const chosen = i === G?.selected && G?.phase === 'playing';
    const hover = i === hovered && G?.phase === 'playing';
    const ty = CARD_Y + (chosen ? .3 : hover ? .14 : 0);
    if (reduced) { m.position.set(p.x, ty, p.z); m.rotation.set(0, 0, 0); continue; }
    m.position.x = THREE.MathUtils.damp(m.position.x, p.x, 12, dt);
    m.position.z = THREE.MathUtils.damp(m.position.z, p.z, 12, dt);
    m.position.y = THREE.MathUtils.damp(m.position.y, ty, 13, dt);
    m.rotation.x = THREE.MathUtils.damp(m.rotation.x, chosen ? -.16 : hover ? -.07 : 0, 10, dt);
    m.rotation.y = THREE.MathUtils.damp(m.rotation.y, hover && !chosen ? .03 : 0, 10, dt);
    m.rotation.z = THREE.MathUtils.damp(m.rotation.z, 0, 14, dt);
  }
  for (let i = chipsLeaving.length - 1; i >= 0; i--) {
    const c = chipsLeaving[i], t = Math.min(1, (now - c.start) / 500);
    c.m.position.y += dt * 3; c.m.scale.setScalar(1 - t);
    if (t >= 1) { scene.remove(c.m); chipsLeaving.splice(i, 1); }
  }
  for (const c of chips) c.position.y = THREE.MathUtils.damp(c.position.y, c.userData.rest.y, 9, dt);
  syncDeck(now, dt);
  animateCasino(now, dt);
  animateBossProps(now, dt);
  // score count-up
  if (G) {
    hud.score += (G.score - hud.score) * Math.min(1, dt * 7);
    if (Math.abs(G.score - hud.score) < 1) hud.score = G.score;
    const shown = Math.round(hud.score).toLocaleString();
    if ($('score').textContent !== shown) $('score').textContent = shown;
  }
  // camera: idle sway on the title, shake on misses
  const titleOn = screenName === 'title' || screenName === 'ticket';
  orbit = THREE.MathUtils.damp(orbit, titleOn && !reduced ? Math.sin(now * .00025) * .22 : 0, 2, dt);
  tmpV.copy(camBase).sub(lookTarget).applyAxisAngle(THREE.Object3D.DEFAULT_UP, orbit).add(lookTarget);
  camera.position.copy(tmpV); camera.lookAt(lookTarget);
  if (shake > .001) { camera.position.x += (crand() - .5) * shake; camera.position.y += (crand() - .5) * shake; shake *= Math.pow(.004, dt); }
  renderer.render(scene, camera);
}

/* ------------------------------ boot ------------------------------ */
document.querySelectorAll('[data-icon]').forEach(n => n.insertAdjacentHTML('afterbegin', icon(n.dataset.icon)));
document.querySelectorAll('#streakMeter .segs').forEach(n => n.innerHTML = '<i></i>'.repeat(9));
document.querySelector('#bossChip .pips').innerHTML = '<i></i>'.repeat(FINAL);
$('locks').innerHTML = ('<span class="lk">' + icon('lock') + '</span>').repeat(3);
$('gaugeTicks').innerHTML = Array.from({length: 10}, (_, k) => { const a = (-110 + k / 9 * 220 - 90) * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a); return `<line x1="${100 + c * 70}" y1="${100 + s2 * 70}" x2="${100 + c * 82}" y2="${100 + s2 * 82}" class="${k >= 6 ? 'red' : ''}"/><text x="${100 + c * 56}" y="${104 + s2 * 56}">${k}</text>`; }).join('');
resizeScene();
newRun();
showTitle();
if (/[?&]debug/.test(location.search)) window.hilo = {enterBoss, setupStage, state: () => G, setBoard: b => { G.board = b; b.forEach((c, i) => meshCard(c, i)); ensureStake(); refresh(); }, face: (card, id) => { const prev = artBoss; artBoss = id; const c = document.createElement('canvas'); c.width = CARD_W; c.height = CARD_H; cardFace(c.getContext('2d'), card); artBoss = prev; return c.toDataURL(); }, back: id => backTextures[BOSS_PRESENTATION.findIndex(t => t.id === id)].image.toDataURL()};
requestAnimationFrame(animate);
requestAnimationFrame(() => { positionCamera(); $('loading').classList.add('hidden'); });
