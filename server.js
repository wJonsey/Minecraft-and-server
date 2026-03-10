'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 3000;
const MAX_PLAYERS = 8;

// ── HTTP server (serves the game client) ────────────────────
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'minecraft.html' : req.url);
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

let nextId = 1;

// ── WebSocket server ─────────────────────────────────────────
const wss = new WebSocketServer({ server });

function broadcast(data, except = null) {
  const msg = JSON.stringify(data);
  for (const [ws] of players) {
    if (ws !== except && ws.readyState === 1) ws.send(msg);
  }
}

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
  broadcast({ type: 'playerJoin', player }, ws);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const p = players.get(ws);
    if (!p) return;

    switch (msg.type) {
      case 'move':
        p.x = msg.x; p.y = msg.y; p.z = msg.z;
        p.yaw = msg.yaw; p.pitch = msg.pitch;
        p.flying = msg.flying;
        broadcast({ type: 'playerMove', id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, flying: p.flying }, ws);
        break;

      case 'blockChange':
        const key = `${msg.x},${msg.y},${msg.z}`;
        if (msg.id === 0) delete blockChanges[key];
        else blockChanges[key] = msg.id;
        broadcast({ type: 'blockChange', x: msg.x, y: msg.y, z: msg.z, id: msg.id }, ws);
        break;

      case 'chat':
        const text = String(msg.text).slice(0, 120);
        console.log(`[Chat] ${p.name}: ${text}`);
        broadcast({ type: 'chat', from: p.name, color: p.color, text });
        ws.send(JSON.stringify({ type: 'chat', from: p.name, color: p.color, text }));
        break;

      case 'name':
        p.name = String(msg.name).slice(0, 20).replace(/[<>]/g, '') || p.name;
        broadcast({ type: 'playerName', id: p.id, name: p.name });
        break;
    }
  });

  ws.on('close', () => {
    players.delete(ws);
    broadcast({ type: 'playerLeave', id: player.id });
    console.log(`[-] Player${id} disconnected (${players.size} online)`);
  });

  ws.on('error', () => ws.terminate());
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   Minecraft Browser — Local Server   ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  Open in browser:                    ║`);
  console.log(`  ║  http://localhost:${PORT}               ║`);
  console.log(`  ║                                      ║`);
  console.log(`  ║  Share on LAN:                       ║`);
  console.log(`  ║  http://<your-local-ip>:${PORT}          ║`);
  console.log(`  ║                                      ║`);
  console.log(`  ║  Max players: ${MAX_PLAYERS}                      ║`);
  console.log(`  ║  Press Ctrl+C to stop                ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
