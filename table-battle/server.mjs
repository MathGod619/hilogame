import { createServer } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { abilities, newMatch, play, view } from './rules.mjs';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const origins = new Set(['https://mathgod619.github.io']);
const rooms = new Map();
const ttl = 2 * 60 * 60 * 1000;
const staticFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/battle.css', ['battle.css', 'text/css']],
  ['/battle.mjs', ['battle.mjs', 'text/javascript']],
  ['/rules.mjs', ['rules.mjs', 'text/javascript']]
]);

const fault = (status, message) => Object.assign(new Error(message), { status });

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2048) throw fault(413, 'Request is too large.');
  }
  try {
    const value = JSON.parse(body);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch {
    throw fault(400, 'Invalid request.');
  }
}

function addSeat(room, name) {
  const player = {
    name: typeof name === 'string' && name.trim() ? name.trim().slice(0,18) : 'Player ' + (room.members.length + 1),
    ability: null,
    token: randomBytes(24).toString('hex')
  };
  room.members.push(player);
  room.revision++;
  room.updated = Date.now();
  return player;
}

function snapshot(room, player) {
  const seat = room.members.indexOf(player);
  return {
    code: room.code, revision: room.revision, seat,
    players: room.members.map(({name, ability}) => ({name, ability})),
    match: room.match ? view(room.match, seat) : null
  };
}

function pruneRooms() {
  const cutoff = Date.now() - ttl;
  for (const [code, room] of rooms) if (room.updated < cutoff) rooms.delete(code);
}
const cleanup = setInterval(pruneRooms, 60000);
cleanup.unref();

createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, data) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify(data));
  };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') return send(200, { service: 'hilo-table-battle', ok: true });
    if (req.method === 'GET' && staticFiles.has(path)) {
      const [file, type] = staticFiles.get(path);
      const body = await readFile(new URL(file, import.meta.url));
      res.writeHead(200, {'Content-Type': type + '; charset=utf-8'});
      return res.end(body);
    }
    if (origin && !origins.has(origin) && origin !== 'https://' + req.headers.host &&
        !(process.env.NODE_ENV !== 'production' && origin === 'http://' + req.headers.host))
      throw fault(403, 'This site cannot access HiLo rooms.');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Max-Age': '600'
      });
      return res.end();
    }

    if (path === '/api/rooms' && req.method === 'POST') {
      const {name} = await readBody(req);
      pruneRooms();
      if (rooms.size >= 500) throw fault(503, 'All tables are busy. Try again later.');
      let code;
      do {
        code = Array.from({length: 6}, () => alphabet[randomInt(alphabet.length)]).join('');
      } while (rooms.has(code));
      const room = { code, members: [], revision: 0, match: null };
      const player = addSeat(room, name);
      rooms.set(code, room);
      return send(201, { ...snapshot(room, player), token: player.token });
    }

    const route = path.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|move))?$/);
    if (!route) throw fault(404, 'Page not found.');
    const [, code, command] = route;
    const room = rooms.get(code);
    if (!room || Date.now() - room.updated > ttl) throw fault(404, 'Room expired or code not found.');
    if (command === 'join' && req.method === 'POST') {
      const {name} = await readBody(req);
      if (room.match || room.members.length >= 4) throw fault(409, 'This table is full or has started.');
      const player = addSeat(room, name);
      return send(201, { ...snapshot(room, player), token: player.token });
    }
    const player = room.members.find(member => req.headers.authorization === 'Bearer ' + member.token);
    if (!player) throw fault(401, 'Your seat could not be restored.');
    if (!command && req.method === 'GET') return send(200, snapshot(room, player));
    if (command !== 'move' || req.method !== 'POST') throw fault(405, 'Action unavailable.');

    const {action, value, revision} = await readBody(req);
    const seat = room.members.indexOf(player);
    if (action === 'leave' && !room.match) {
      room.members.splice(seat, 1);
      if (!room.members.length) rooms.delete(code);
      room.revision++;
      room.updated = Date.now();
      return send(200, { ok: true });
    }
    if (action === 'pick' && !room.match) {
      if (!Object.hasOwn(abilities, value) || room.members.some(m => m !== player && m.ability === value))
        throw fault(409, 'That ability is already taken. Choose another.');
      player.ability = value;
    } else if (action === 'start' && !room.match && seat === 0) {
      if (room.members.length !== 4 || room.members.some(m => !m.ability))
        throw fault(409, 'Wait for four players to choose abilities.');
      room.match = newMatch(room.members, () => randomInt(2 ** 32) / 2 ** 32);
    } else if (action === 'rematch' && room.match?.winners && seat === 0) {
      room.match = newMatch(room.members, () => randomInt(2 ** 32) / 2 ** 32);
    } else if (room.match && ['ability', 'guess'].includes(action)) {
      if (revision !== room.revision) throw fault(409, 'The table has moved. Check the current turn.');
      try { play(room.match, seat, action, value); }
      catch (error) { throw fault(409, error.message); }
    } else throw fault(409, 'That action is unavailable.');
    room.revision++;
    room.updated = Date.now();
    return send(200, snapshot(room, player));
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (!error.status) console.error(error);
    send(error.status || 500, { error: error.status ? error.message : 'Table server error.' });
  }
}).listen(Number(process.env.PORT || 8000), '0.0.0.0');
