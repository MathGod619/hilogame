export const abilities = {
  shield: 'Keep your streak through one miss this turn.',
  peek: 'Privately see the next card before guessing.',
  swap: 'Trade an occupied slot with the top discard before guessing.',
  double: 'Double the points on a hit. A miss costs 2 points.'
};
export const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export function newMatch(players, random = Math.random) {
  if (players.length !== 4) throw new Error('Table Battle needs four players.');
  const deck = ['♠','♥','♣','♦'].flatMap(suit => ranks.map((_, rank) => ({ suit, rank })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const first = Math.floor(random() * players.length);
  const board = Array(9).fill(null);
  for (const slot of [0, 1, 2]) board[slot] = deck.pop();
  return {
    players: players.map(({name, ability}) => ({
      name, ability, score: 0, streak: 0, best: 0, used: false
    })),
    board, deck, first, turn: 0, active: first, discard: null,
    armed: null, last: null, winners: null
  };
}

function isOccupied(match, slot) {
  return Number.isInteger(slot) && Boolean(match.board[slot]);
}

export function play(match, seat, action, value) {
  if (match.winners || seat !== match.active) throw new Error('Wait for your turn.');
  const player = match.players[seat];
  if (action === 'ability') {
    if (player.used) throw new Error('You already used your ability.');
    if (player.ability === 'swap') {
      if (!match.discard || !isOccupied(match, value)) throw new Error('Choose a card when a discard is available.');
      const old = match.board[value];
      match.board[value] = match.discard;
      match.discard = old;
      match.last = { seat, type: 'swap', old, card: match.board[value] };
    } else {
      match.armed = player.ability;
    }
    player.used = true;
    return;
  }

  const {slot, direction} = value ?? {};
  if (action !== 'guess' || (direction !== 'higher' && direction !== 'lower'))
    throw new Error('Choose Higher or Lower.');
  if (!isOccupied(match, slot)) throw new Error('Choose a face-up card.');

  const old = match.board[slot];
  const card = match.deck.pop();
  const hit = direction === 'higher' ? card.rank > old.rank : card.rank < old.rank;
  const shielded = !hit && match.armed === 'shield';
  let points = 0;
  let rebuilt = false;
  let wiped = false;

  if (hit) {
    player.streak++;
    player.best = Math.max(player.best, player.streak);
    points = Math.min(3, player.streak) * (match.armed === 'double' ? 2 : 1);
    const empty = match.board.indexOf(null);
    if (player.streak === 3 && empty !== -1) {
      match.board[empty] = card;
      rebuilt = true;
    } else {
      match.board[slot] = card;
      match.discard = old;
    }
  } else {
    if (!shielded) player.streak = 0;
    if (match.armed === 'double') points = -2;
    match.board[slot] = null;
    wiped = !match.board.some(Boolean);
    if (wiped && match.deck.length) {
      match.board[slot] = card;
      match.discard = old;
    } else {
      match.discard = card;
    }
  }
  player.score += points;
  match.last = { seat, type: 'guess', old, card, hit, points, shielded, rebuilt, wiped };
  match.armed = null;
  match.turn++;

  if (!match.deck.length) {
    const top = [...match.players].sort((a,b) => b.score - a.score || b.best - a.best)[0];
    match.winners = match.players.flatMap((p,i) => p.score === top.score && p.best === top.best ? [i] : []);
    return;
  }
  // Rotate the first seat each round. The randomly selected opener gets the 49th guess.
  match.active = (match.first + Math.floor(match.turn / 4) + match.turn % 4) % 4;
}

export function view(match, seat) {
  const {deck, ...visible} = match;
  return {
    ...visible,
    remaining: deck.length,
    peek: seat === match.active && match.armed === 'peek' ? deck.at(-1) : null
  };
}
