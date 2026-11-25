// Servidor de salas para Duelos del 115.
// Solo conecta a dos jugadores con un código de 5 números y les pasa los mensajes entre sí.
// Uso:  npm install   y luego   node servidor.js

const http = require('http');
const WebSocket = require('ws');

const PUERTO = process.env.PORT || 8080;

const servidor = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Servidor de Duelos del 115 funcionando');
});
const wss = new WebSocket.Server({ server: servidor });

// codigo -> { codigo, host, invitado }
const salas = new Map();

function codigoNuevo() {
  let c;
  do {
    c = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  } while (salas.has(c));
  return c;
}

function enviar(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function salir(ws) {
  const sala = ws.sala;
  if (!sala) return;
  ws.sala = null;
  const otro = sala.host === ws ? sala.invitado : sala.host;
  salas.delete(sala.codigo);
  if (otro) {
    otro.sala = null;
    enviar(otro, { t: 'rival_salio' });
  }
}

function manejar(ws, texto) {
  let m;
  try { m = JSON.parse(texto); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;

  if (m.t === 'crear') {
    if (ws.sala) return;
    const codigo = codigoNuevo();
    const sala = { codigo, host: ws, invitado: null };
    salas.set(codigo, sala);
    ws.sala = sala;
    enviar(ws, { t: 'sala', codigo });
  } else if (m.t === 'unir') {
    if (ws.sala) return;
    const sala = salas.get(String(m.codigo || ''));
    if (!sala) return enviar(ws, { t: 'error', msg: 'No existe una sala con ese código.' });
    if (sala.invitado) return enviar(ws, { t: 'error', msg: 'La sala ya está llena.' });
    sala.invitado = ws;
    ws.sala = sala;
    const seed = Math.floor(Math.random() * 1000000) + 1;
    enviar(sala.host, { t: 'inicio', asiento: 0, seed });
    enviar(ws, { t: 'inicio', asiento: 1, seed });
  } else if (m.t === 'm') {
    const sala = ws.sala;
    if (!sala) return;
    const otro = sala.host === ws ? sala.invitado : sala.host;
    enviar(otro, m);
  }
}

wss.on('connection', (ws) => {
  ws.sala = null;
  ws.on('message', (datos) => manejar(ws, datos.toString()));
  ws.on('close', () => salir(ws));
  ws.on('error', () => {});
});

// Mantiene viva la conexión en servicios de hosting que cierran las conexiones inactivas.
setInterval(() => {
  wss.clients.forEach((ws) => { try { ws.ping(); } catch (e) {} });
}, 25000);

if (require.main === module) {
  servidor.listen(PUERTO, () => console.log('Servidor listo en el puerto ' + PUERTO));
} else {
  module.exports = { manejar, salir, salas };
}
