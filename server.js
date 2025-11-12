const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Almacén de jugadores. Usaremos un Objeto para acceso rápido por ID
const players = {}; 

// --- Funciones Helper ---
function getPlayerCount() {
  return Object.keys(players).length;
}

function getPlayerById(id) {
  return players[id];
}

function getOtherPlayer(id) {
  for (const playerId in players) {
    if (playerId !== id) {
      return players[playerId];
    }
  }
  return null;
}

function getScores() {
  return Object.values(players).map(p => ({ name: p.name, score: p.score }));
}

function checkAllReady() {
  if (getPlayerCount() < 2) return false;
  return Object.values(players).every(p => p.ready);
}

function resetGameState() {
    // Resetear el estado para una nueva partida si se reconectan
    Object.values(players).forEach(p => {
        p.score = 0;
        p.ready = false;
        p.status = 'playing'; // playing, finished, lost
    });
}
// --- Fin Helpers ---


app.use(express.static(join(__dirname, '')));
app.use('/models', express.static(join(__dirname, 'models')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('Iniciar', (nombre) => {
    if (getPlayerCount() >= 2) {
      socket.emit('JuegoLleno');
      return;
    }

    // Determinar índice de modelo
    const modelIndex = (getPlayerCount() === 0) ? 1 : 2;

    // Crear nuevo jugador
    players[socket.id] = {
      id: socket.id,
      name: nombre,
      modelIndex: modelIndex,
      score: 0,
      ready: false,
      status: 'playing' // playing, finished, lost
    };
    
    console.log('Jugador iniciado:', players[socket.id].name);

    if (getPlayerCount() === 2) {
      io.emit('JuegoListo');
    }

    // Enviar a todos la lista actual de jugadores
    const playerList = Object.values(players).map(p => ({ name: p.name, modelIndex: p.modelIndex }));
    io.emit('Iniciar', playerList);
  });

  socket.on('Posicion', (posicion, nombre) => {
    const player = getPlayerById(socket.id);
    if (player) {
      io.emit('Posicion', { 
        id: player.id, 
        name: player.name, 
        x: posicion.x, y: posicion.y, z: posicion.z,
        modelIndex: player.modelIndex
      });
    }
  });

  socket.on('PlayerReady', () => {
    const player = getPlayerById(socket.id);
    if (player) {
      player.ready = true;
      console.log(`Jugador ${player.name} está listo.`);
      
      if (checkAllReady()) {
        console.log("Ambos listos! Iniciando cuenta regresiva...");
        io.emit('StartCountdown');
      }
    }
  });

  socket.on('CoinCollected', () => {
    const player = getPlayerById(socket.id);
    if (player) {
      player.score += 1;
      io.emit('UpdateScores', getScores());
    }
  });

  // --- NUEVA LÓGICA DE VICTORIA ---

  socket.on('PlayerLost', (loserName) => {
    const loserPlayer = getPlayerById(socket.id);
    if (!loserPlayer || loserPlayer.status !== 'playing') return; // Evitar doble envío

    console.log(`Jugador ${loserName} ha perdido (vidas/combustible).`);
    loserPlayer.status = 'lost';

    const winnerPlayer = getOtherPlayer(socket.id);
    if (winnerPlayer) {
      io.emit('GameOver', { winner: winnerPlayer.name, reason: 'death' });
    }
  });

  socket.on('PlayerFinished', (data) => {
    const finisher = getPlayerById(socket.id);
    if (!finisher || finisher.status !== 'playing') return; // Evitar doble envío

    console.log(`Jugador ${data.name} ha terminado la carrera.`);
    finisher.status = 'finished';
    finisher.score = data.score; // Asegurar que el score final esté actualizado

    const otherPlayer = getOtherPlayer(socket.id);

    if (otherPlayer) {
      if (otherPlayer.status === 'finished') {
        // AMBOS TERMINARON: Comparar monedas
        console.log("Ambos terminaron. Comparando monedas.");
        let winnerName;
        if (finisher.score > otherPlayer.score) {
          winnerName = finisher.name;
        } else if (otherPlayer.score > finisher.score) {
          winnerName = otherPlayer.name;
        } else {
          winnerName = "EMPATE"; // Caso de empate
        }
        io.emit('GameOver', { winner: winnerName, reason: 'score' });

      } else if (otherPlayer.status === 'lost') {
        // EL OTRO YA HABÍA PERDIDO: Gana el que termina
        console.log("El oponente ya había perdido. Gana el que termina.");
        io.emit('GameOver', { winner: finisher.name, reason: 'default' });
      }
      // Si el 'otherPlayer' sigue 'playing', no hacemos nada.
      // Esperamos a que termine o pierda.
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const disconnectedPlayer = players[socket.id];
    
    if (disconnectedPlayer) {
      delete players[socket.id]; // Eliminar jugador
      
      // Notificar al otro jugador que se desconectó
      const remainingPlayer = getOtherPlayer(socket.id); // 'getOtherPlayer' ya no lo encontrará
      
      // Si el juego estaba en curso (ambos listos o jugando) y uno se va, el otro gana
      if (remainingPlayer && remainingPlayer.ready) { 
        io.emit('GameOver', { winner: remainingPlayer.name, reason: 'disconnect' });
      }
      
      // Notificar a todos que un jugador se fue (para UI)
      io.emit('JugadorDesconectado', disconnectedPlayer.name);
      
      // Si la sala se vacía, resetear
      if (getPlayerCount() === 0) {
        console.log("Sala vacía, reseteando estado.");
        resetGameState(); // Prepara para la próxima partida
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});