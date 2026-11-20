export const abilities = {
  shield: 'Keep your streak through one miss this turn.',
  peek: 'Privately see the next card before guessing.',
  swap: 'Trade your face-up card with another player.',
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
  return {
    players: players.map(({name, ability}) => ({
      name, ability, card: deck.pop(), score: 0, streak: 0, best: 0, used: false
    })),
    deck, turn: 0, active: 0, armed: null, last: null, winners: null
  };
}

export function play(match, seat, action, value) {
  if (match.winners || seat !== match.active) throw new Error('Wait for your turn.');
  const player = match.players[seat];
  if (action === 'ability') {
    if (player.used) throw new Error('You already used your ability.');
    if (player.ability === 'swap') {
      if (!Number.isInteger(value) || value < 0 || value >= 4 || value === seat)
        throw new Error('Choose another player to swap with.');
      const other = match.players[value];
      [player.card, other.card] = [other.card, player.card];
      match.last = { seat, swap: value };
    } else {
      match.armed = player.ability;
    }
    player.used = true;
    return;
  }
  if (action !== 'guess' || (value !== 'higher' && value !== 'lower'))
    throw new Error('Choose Higher or Lower.');
  const old = player.card;
  const card = match.deck.pop();
  const hit = value === 'higher' ? card.rank > old.rank : card.rank < old.rank;
  let points = 0;
  if (hit) {
    player.streak++;
    player.best = Math.max(player.best, player.streak);
    points = Math.min(3, player.streak) * (match.armed === 'double' ? 2 : 1);
  } else {
    if (match.armed !== 'shield') player.streak = 0;
    if (match.armed === 'double') points = -2;
  }
  player.score += points;
  player.card = card;
  match.last = { seat, old, card, hit, points, shielded: !hit && match.armed === 'shield' };
  match.armed = null;
  match.turn++;
  // Rotate the first seat each round. Each player goes first three times.
  match.active = (Math.floor(match.turn / 4) + match.turn % 4) % 4;
  if (!match.deck.length) {
    const top = [...match.players].sort((a,b) => b.score - a.score || b.best - a.best)[0];
    match.winners = match.players.flatMap((p,i) => p.score === top.score && p.best === top.best ? [i] : []);
  }
}

export function view(match, seat) {
  const {deck, ...visible} = match;
  return {
    ...visible,
    remaining: deck.length,
    peek: seat === match.active && match.armed === 'peek' ? deck.at(-1) : null
  };
}
