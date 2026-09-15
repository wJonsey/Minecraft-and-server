'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const DEFAULT_PORT = 3000;
const MAX_PLAYERS = 8;
const MAX_MESSAGE_BYTES = 16 * 1024;
const CLIENT_FILE = 'minecraft_survival (1).html';

// ── HTTP server (serves the game client) ────────────────────
const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relativePath = requestPath === '/' ? CLIENT_FILE : requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(__dirname, relativePath);
  if (filePath !== __dirname && !filePath.startsWith(`${__dirname}${path.sep}`)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

// ── World state (server-authoritative block changes) ─────────
const blockChanges = {}; // "x,y,z" -> blockId
const players = new Map(); // ws -> player state

function broadcast(data, playersMap, except = null) {
  const msg = JSON.stringify(data);
  for (const [ws] of playersMap) {
    if (ws !== except && ws.readyState === 1) ws.send(msg);
  }
}

function createGameServer(httpServer = server) {
  const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_BYTES });
  let nextId = 1;

  wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', msg: 'Server full' }));
    ws.close();
    return;
  }

  const id = nextId++;
  const color = `hsl(${(id * 137.5) % 360},70%,60%)`;
  const player = {
    id, color,
    name: `Player${id}`,
    x: 8, y: 75, z: 8,
    yaw: 0, pitch: 0,
    flying: false,
  };
  players.set(ws, player);
  console.log(`[+] Player${id} connected (${players.size} online)`);

  // Send welcome: your id, existing players, world changes
  ws.send(JSON.stringify({
    type: 'welcome',
    id,
    color,
    players: [...players.values()].filter(p => p.id !== id),
    worldChanges: blockChanges,
  }));

  // Notify others
  broadcast({ type: 'playerJoin', player }, players, ws);

  ws.on('message', (raw) => {
    if (raw.length > MAX_MESSAGE_BYTES) return ws.close(1009, 'Message too large');
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = players.get(ws);
    if (!p) return;

    switch (msg.type) {
      case 'move':
        if (![msg.x, msg.y, msg.z, msg.yaw, msg.pitch].every(Number.isFinite)) break;
        if (Math.abs(msg.x) > 100000 || Math.abs(msg.y) > 100000 || Math.abs(msg.z) > 100000) break;
        p.x = msg.x; p.y = msg.y; p.z = msg.z;
        p.yaw = msg.yaw; p.pitch = msg.pitch;
        p.flying = msg.flying === true;
        broadcast({ type: 'playerMove', id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, flying: p.flying }, players, ws);
        break;

      case 'blockChange':
        if (![msg.x, msg.y, msg.z, msg.id].every(Number.isInteger) || Math.abs(msg.x) > 100000 || Math.abs(msg.z) > 100000 || msg.y < 0 || msg.y >= 80 || msg.id < 0 || msg.id > 255) break;
        const key = `${msg.x},${msg.y},${msg.z}`;
        if (msg.id === 0) delete blockChanges[key];
        else blockChanges[key] = msg.id;
        broadcast({ type: 'blockChange', x: msg.x, y: msg.y, z: msg.z, id: msg.id }, players, ws);
        break;

      case 'chat':
        const text = String(msg.text).slice(0, 120);
        console.log(`[Chat] ${p.name}: ${text}`);
        broadcast({ type: 'chat', from: p.name, color: p.color, text }, players);
        break;

      case 'name':
        p.name = String(msg.name).slice(0, 20).replace(/[<>]/g, '') || p.name;
        broadcast({ type: 'playerName', id: p.id, name: p.name }, players);
        break;
    }
  });

  ws.on('close', () => {
    players.delete(ws);
    broadcast({ type: 'playerLeave', id: player.id }, players);
    console.log(`[-] Player${id} disconnected (${players.size} online)`);
  });

  ws.on('error', () => ws.terminate());
  });
  return wss;
}

function start(port = Number(process.env.PORT) || DEFAULT_PORT) {
  createGameServer(server);
  server.listen(port, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   Minecraft Browser — Local Server   ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  Open in browser:                    ║`);
  console.log(`  ║  http://localhost:${port}               ║`);
  console.log(`  ║                                      ║`);
  console.log(`  ║  Share on LAN:                       ║`);
  console.log(`  ║  http://<your-local-ip>:${port}          ║`);
  console.log(`  ║                                      ║`);
  console.log(`  ║  Max players: ${MAX_PLAYERS}                      ║`);
  console.log(`  ║  Press Ctrl+C to stop                ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  });
  return server;
}

if (require.main === module) start();

module.exports = { createGameServer, start, server, blockChanges, players };
