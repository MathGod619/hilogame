import { abilities, ranks, newMatch, play, view } from './rules.mjs?v=shared1';

const labels = { shield: 'Shield', peek: 'Peek', swap: 'Swap', double: 'Double Down' };
const screen = document.getElementById('screen');
const notice = document.getElementById('notice');
const onlineOrigin = location.hostname === 'mathgod619.github.io'
  ? document.querySelector('meta[name="room-server"]').content
  : location.origin;
const sessionKey = 'hilo-table-battle-seat';
const linkCode = new URLSearchParams(location.search).get('room');
let mode = 'home';
let room = null;
let token = '';
let localMatch = null;
let practice = false;
let botTimer;
let selectedSlot = null;
let selectionTurn = -1;
let busy = false;
let polling = false;
let failures = 0;

function el(tag, value, className) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  if (className) node.className = className;
  return node;
}
function button(label, action, className, disabled = false) {
  const node = el('button', label, className);
  node.disabled = disabled;
  node.addEventListener('click', action);
  return node;
}
function lobby(title) {
  const panel = el('section', null, 'lobby');
  panel.append(el('h1', title));
  screen.replaceChildren(panel);
  return panel;
}

async function api(path, data, auth = '') {
  const headers = {};
  if (auth) headers.Authorization = 'Bearer ' + auth;
  if (data) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(onlineOrigin + '/api/rooms' + path, {
      method: data ? 'POST' : 'GET', headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(auth ? 10000 : 80000)
    });
  } catch {
    throw new Error('Could not reach the room server. Try again in a moment.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || 'Room server is unavailable.'), { status: response.status });
  return result;
}

function stash() {
  try {
    if (room && token) sessionStorage.setItem(sessionKey, JSON.stringify({ code: room.code, token }));
    else sessionStorage.removeItem(sessionKey);
  } catch { /* The current tab can still play without storage. */ }
}

async function perform(action, waitingText = '') {
  if (busy) return;
  busy = true;
  notice.textContent = waitingText;
  try {
    await action();
    notice.textContent = '';
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    busy = false;
  }
}
function showHome() {
  mode = 'home';
  clearTimeout(botTimer);
  screen.replaceChildren(document.getElementById('home').content.cloneNode(true));
  const local = document.getElementById('local');
  local.onclick = localSetup;
  document.getElementById('practice').onclick = () => {
    if (busy) return;
    startLocal([
      {name: 'You', ability: 'shield'}, {name: 'Mara', ability: 'peek'},
      {name: 'Jules', ability: 'swap'}, {name: 'Vic', ability: 'double'}
    ], true);
  };
  if (room && token) local.before(button('Resume ' + room.code, () => {
    mode = 'online';
    renderRoom();
    poll();
  }));
  if (!onlineOrigin) {
    screen.querySelector('.online').replaceChildren(el('p', 'Online rooms are awaiting deployment.'));
    return;
  }
  const name = document.getElementById('name');
  const code = document.getElementById('code');
  if (linkCode) code.value = linkCode.slice(0,6).toUpperCase();
  document.getElementById('host').onclick = () => connect('', name.value);
  document.getElementById('join').onsubmit = event => {
    event.preventDefault();
    const value = code.value.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(value)) {
      notice.textContent = 'Enter the six-character room code.';
      return;
    }
    connect(value, name.value);
  };
}

function connect(code, name) {
  perform(async () => {
    const response = await api(code ? '/' + code + '/join' : '', {name});
    token = response.token;
    delete response.token;
    room = response;
    selectionTurn = -1;
    stash();
    mode = 'online';
    failures = 0;
    renderRoom();
  }, 'Connecting… The room server may take a minute to wake up.');
}

function localSetup() {
  if (busy) return;
  notice.textContent = '';
  mode = 'setup';
  const panel = lobby('Pass & Play');
  const seats = el('ol', null, 'seats');
  const inputs = Object.keys(abilities).map((ability, index) => {
    const row = el('li');
    const name = el('input');
    name.maxLength = 18;
    name.placeholder = 'Player ' + (index + 1);
    const select = el('select');
    for (const key of Object.keys(abilities)) {
      const option = el('option', labels[key]);
      option.value = key;
      select.append(option);
    }
    select.value = ability;
    const info = el('small', abilities[ability]);
    select.onchange = () => { info.textContent = abilities[select.value]; };
    const nameLabel = el('label', 'Seat ' + (index + 1));
    nameLabel.append(name);
    const abilityLabel = el('label', 'Ability');
    abilityLabel.append(select);
    row.append(nameLabel, abilityLabel, info);
    seats.append(row);
    return {name, select};
  });
  panel.append(seats, button('Deal', () => {
    const players = inputs.map(({name, select}, i) => ({
      name: name.value.trim() || 'Player ' + (i + 1), ability: select.value
    }));
    if (new Set(players.map(p => p.ability)).size !== 4) {
      notice.textContent = 'Give each player a different ability.';
      return;
    }
    startLocal(players, false);
  }, 'primary'), button('Back', showHome));
}

function onlineMove(action, value) {
  perform(async () => {
    const previous = room;
    const result = await api('/' + previous.code + '/move', {action, value, revision: previous.revision}, token);
    if (room === previous || result.revision > room.revision) room = result;
    renderRoom();
  });
}
function leave() {
  if (busy) return;
  room = null;
  token = '';
  stash();
  notice.textContent = '';
  showHome();
}
function renderRoom() {
  if (room.match) {
    renderMatch(room.match, room.seat, onlineMove, room.seat === 0 ? () => onlineMove('rematch') : null, renderRoom);
    return;
  }
  const panel = lobby('Waiting for players');
  const invite = el('div', null, 'invite');
  invite.append(el('strong', room.code), button('Copy invite', async () => {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', room.code);
    try {
      await navigator.clipboard.writeText(url.href);
      notice.textContent = 'Invite copied.';
    } catch {
      notice.textContent = 'Share room code ' + room.code + '.';
    }
  }));
  const seats = el('ol', null, 'seats');
  for (let i = 0; i < 4; i++) {
    const player = room.players[i];
    seats.append(el('li', player ? player.name + (i === room.seat ? ' (you)' : '') +
      ' · ' + (labels[player.ability] || 'Choosing ability') : 'Open seat'));
  }
  const picks = el('div', null, 'control-row');
  for (const key of Object.keys(labels)) {
    const pick = button(labels[key], () => onlineMove('pick', key),
      room.players[room.seat].ability === key ? 'primary' : '',
      room.players.some((p,i) => p.ability === key && i !== room.seat));
    pick.title = abilities[key];
    picks.append(pick);
  }
  const chosen = room.players[room.seat].ability;
  panel.append(invite, seats, el('p', chosen ? abilities[chosen] : 'Choose your ability.'), picks);
  if (room.seat === 0) panel.append(button('Deal', () => onlineMove('start'), 'primary',
    room.players.length < 4 || room.players.some(p => !p.ability)));
  panel.append(button('Leave room', () => {
    perform(async () => {
      await api('/' + room.code + '/move', {action: 'leave'}, token);
      room = null;
      token = '';
      stash();
      showHome();
    });
  }));
}

function startLocal(players, againstBots) {
  notice.textContent = '';
  mode = 'local';
  practice = againstBots;
  localMatch = newMatch(players);
  selectionTurn = -1;
  renderLocal();
}
function renderLocal() {
  clearTimeout(botTimer);
  const seat = localMatch.active;
  renderMatch(view(localMatch, practice ? 0 : seat), practice ? 0 : seat, (action, value) => {
    try {
      play(localMatch, seat, action, value);
      notice.textContent = '';
      renderLocal();
    } catch (error) { notice.textContent = error.message; }
  }, () => startLocal(localMatch.players, practice), renderLocal);
  if (practice && seat !== 0 && !localMatch.winners) {
    const match = localMatch;
    botTimer = setTimeout(() => {
      if (mode !== 'local' || match !== localMatch) return;
      botTurn(match, seat);
      renderLocal();
    }, 550);
  }
}

function cardOdds(card) {
  return Math.max(card.rank, 12 - card.rank) / 13;
}

function botTurn(match, seat) {
  const player = match.players[seat];
  const slots = match.board.flatMap((card, slot) => card ? [{card, slot}] : []);
  slots.sort((a, b) => cardOdds(b.card) - cardOdds(a.card));
  let {card, slot} = slots[0];
  if (!player.used) {
    const odds = cardOdds(card);
    if ((player.ability === 'peek' && odds < .86) ||
        (player.ability === 'double' && (odds >= .85 || match.deck.length <= 4))) {
      play(match, seat, 'ability');
    } else if (player.ability === 'swap' && match.discard && cardOdds(match.discard) > odds) {
      play(match, seat, 'ability', slot);
      card = match.board[slot];
    }
  }
  const peek = view(match, seat).peek;
  if (peek) {
    const choice = slots.find(candidate => candidate.card.rank !== peek.rank);
    if (choice) ({card, slot} = choice);
  }
  const direction = peek ? (peek.rank > card.rank ? 'higher' : 'lower')
    : card.rank < 6 ? 'higher' : 'lower';
  play(match, seat, 'guess', {slot, direction});
}

function cardName(card) {
  return ranks[card.rank] + card.suit;
}
function renderMatch(match, seat, move, rematch, redraw) {
  const table = el('section', null, 'table');
  const title = el('div', null, 'table-title');
  const winner = match.winners;
  const player = match.players[match.active];
  const heading = winner
    ? match.winners.map(i => match.players[i].name).join(' & ') + (winner.length === 1 ? ' wins' : ' tie')
    : player.name + '’s turn';
  title.append(el('h1', heading), el('span', match.remaining + ' in deck'));
  const canPlay = !winner && match.active === seat;
  if (selectionTurn !== match.turn) {
    selectionTurn = match.turn;
    selectedSlot = null;
  }
  const occupied = match.board.flatMap((card, i) => card ? [i] : []);
  if (!match.board[selectedSlot]) selectedSlot = occupied.length === 1 ? occupied[0] : null;
  const players = el('div', null, 'players');
  match.players.forEach((p,i) => {
    const highlight = winner ? winner.includes(i) : i === match.active;
    const tile = el('article', null, highlight ? 'player active' : 'player');
    tile.append(el('h2', p.name + (mode === 'online' && i === seat ? ' (you)' : '')),
      el('p', p.score + ' pts'), el('p', 'Streak ' + p.streak + ' · Best ' + p.best),
      el('small', labels[p.ability] + (p.used ? ' · used' : '')));
    players.append(tile);
  });
  const board = el('div', null, 'board');
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Shared board');
  match.board.forEach((card, slot) => {
    const tile = card && canPlay
      ? button(null, () => {
        selectedSlot = slot;
        redraw();
        screen.querySelector('.board-card[aria-pressed="true"]')?.focus();
      }, 'board-card')
      : el('div', null, card ? 'board-card' : 'empty-slot');
    if (card) {
      tile.append(el('strong', ranks[card.rank]), el('span', card.suit));
      tile.classList.toggle('red', '♥♦'.includes(card.suit));
      if (slot === selectedSlot && canPlay) tile.classList.add('selected');
      if (canPlay) {
        tile.setAttribute('aria-label', cardName(card) + ' · slot ' + (slot + 1));
        tile.setAttribute('aria-pressed', String(slot === selectedSlot));
      }
    } else tile.setAttribute('aria-label', 'Empty slot ' + (slot + 1));
    board.append(tile);
  });
  const controls = el('div', null, 'controls');
  let last = '';
  if (match.last) {
    const {seat: played, type, old, card, hit, points, shielded, rebuilt, wiped} = match.last;
    const name = match.players[played].name;
    const change = name + ' · ' + cardName(old) + ' → ' + cardName(card);
    if (type === 'swap') last = change + ' · swapped with discard';
    else if (hit) last = change + ' · +' + points + ' pts' + (rebuilt ? ' · slot rebuilt' : '');
    else {
      last = change + ' · miss' + (points < 0 ? ' · −2 pts' : '') +
        (shielded ? ' · streak saved' : '') + (wiped ? ' · board wiped' : ' · slot cleared');
    }
  }
  controls.append(el('p', last, 'moves'));
  if (winner) {
    if (rematch) controls.append(button('Rematch', rematch, 'primary'));
    else controls.append(el('p', 'Waiting for the host to start a rematch.'));
  } else if (canPlay) {
    if (match.peek) controls.append(el('p', 'Peek · ' + cardName(match.peek)));
    else if (match.armed) controls.append(el('p', labels[match.armed] + ' ready'));
    const guesses = el('div', null, 'guesses');
    guesses.append(button('▲ Higher', () => move('guess', {slot: selectedSlot, direction: 'higher'}), 'primary', selectedSlot === null),
      button('▼ Lower', () => move('guess', {slot: selectedSlot, direction: 'lower'}), 'lower', selectedSlot === null));
    if (selectedSlot === null) controls.append(el('p', 'Pick a face-up card.'));
    controls.append(guesses);
    if (!player.used) {
      if (player.ability === 'swap') {
        const label = match.discard ? 'Swap with discard · ' + cardName(match.discard) : 'Swap · no discard yet';
        controls.append(button(label, () => move('ability', selectedSlot), '', !match.discard || selectedSlot === null));
      } else controls.append(button('Use ' + labels[player.ability], () => move('ability')));
    }
  } else controls.append(el('p', 'Waiting for ' + player.name + '…'));
  controls.append(button('Back to menu', () => {
    if (mode === 'online' && !winner) {
      notice.textContent = '';
      showHome();
    } else leave();
  }));
  table.append(title, players, board, controls);
  screen.replaceChildren(table);
}

async function poll() {
  if (mode !== 'online' || !room || busy || polling) return;
  polling = true;
  const current = room;
  const currentToken = token;
  try {
    const next = await api('/' + current.code, null, currentToken);
    if (mode !== 'online' || token !== currentToken) return;
    if (failures) notice.textContent = '';
    failures = 0;
    if (next.revision > room.revision) {
      room = next;
      renderRoom();
    }
  } catch (error) {
    if (mode !== 'online' || token !== currentToken) return;
    if (error.status === 401 || error.status === 404) {
      leave();
      notice.textContent = error.message;
    } else if (++failures >= 2) notice.textContent = 'Reconnecting to the table…';
  } finally {
    polling = false;
  }
}

showHome();
setInterval(poll, 1500);
let saved;
try { saved = JSON.parse(sessionStorage.getItem(sessionKey)); } catch { /* Ignore unavailable storage. */ }
if (onlineOrigin && saved && (!linkCode || linkCode.toUpperCase() === saved.code)) {
  perform(async () => {
    try {
      room = await api('/' + saved.code, null, saved.token);
    } catch (error) {
      if (error.status === 401 || error.status === 404) stash();
      throw error;
    }
    token = saved.token;
    mode = 'online';
    renderRoom();
  }, 'Restoring your seat…');
}
