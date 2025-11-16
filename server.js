const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Almacén de jugadores. Usaremos un Objeto para acceso rápido por ID
const players = {}; 

// ===================================
// NUEVO CAMBIO: ESTADO DEL JUEGO ONLINE
// ===================================
let gameState = 'waiting'; // waiting, playing, finished
const TOTAL_COINS = 50;
const COINS_PER_BATCH = 10;
const COIN_SPAWN_INTERVAL = 10000; // 10 segundos
const ARENA_BOUNDS = 100; // Mitad del tamaño del cubo (ej. 200 de lado)

let coinsSpawnedCount = 0;
let coinsCollectedCount = 0;
let activeCoins = {}; // { id: 'coin_1', position: {x,y,z} }
let coinSpawnTimer = null;
// ===================================

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
  // Asegurarnos de que solo contamos jugadores válidos
  return Object.values(players)
    .filter(p => p.name) // Filtrar jugadores que podrían no haberse inicializado
    .map(p => ({ name: p.name, score: p.score }));
}

function checkAllReady() {
  if (getPlayerCount() < 2) return false;
  return Object.values(players).every(p => p.ready);
}

// NUEVO CAMBIO: Reseteo completo del estado del juego
function resetGameState() {
    console.log("--- RESETEANDO ESTADO DEL JUEGO ---");
    // Resetear jugadores
    Object.values(players).forEach(p => {
        p.score = 0;
        p.ready = false;
        p.status = 'playing';
    });
    
    // Resetear estado global
    gameState = 'waiting';
    coinsSpawnedCount = 0;
    coinsCollectedCount = 0;
    activeCoins = {};
    if (coinSpawnTimer) {
        clearInterval(coinSpawnTimer);
        coinSpawnTimer = null;
    }
}
// --- Fin Helpers ---


app.use(express.static(join(__dirname, '')));
app.use('/models', express.static(join(__dirname, 'models')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// ===================================
// NUEVO CAMBIO: LÓGICA DE INICIO Y SPAWN
// ===================================
function startGame() {
    if (gameState === 'playing') return; // Evitar doble inicio
    
    console.log("--- INICIANDO JUEGO ---");
    resetGameState(); // Asegurar que todo esté limpio
    gameState = 'playing';

    // Notificar a los clientes que la cuenta regresiva empieza
    io.emit('StartCountdown');
    
    // Empezar a spawnear monedas DESPUÉS de la cuenta regresiva (ej. 5 seg)
    setTimeout(startCoinSpawner, 5000); 
}

function startCoinSpawner() {
    console.log("Iniciando spawner de monedas...");
    if (coinSpawnTimer) clearInterval(coinSpawnTimer);

    // Función que spawnea un batch
    const spawnBatch = () => {
        if (gameState !== 'playing') {
            if(coinSpawnTimer) clearInterval(coinSpawnTimer);
            return;
        }

        let coinsToSpawn = Math.min(COINS_PER_BATCH, TOTAL_COINS - coinsSpawnedCount);
        console.log(`Spawneando ${coinsToSpawn} monedas...`);

        if (coinsToSpawn <= 0) {
            if(coinSpawnTimer) clearInterval(coinSpawnTimer);
            console.log("Todas las monedas spawneadas. Deteniendo timer.");
            return;
        }

        for (let i = 0; i < coinsToSpawn; i++) {
            coinsSpawnedCount++;
            const coinId = `coin_${coinsSpawnedCount}`;
            // Posición aleatoria dentro de la arena
            const position = { 
                x: (Math.random() - 0.5) * ARENA_BOUNDS * 1.8, // * 1.8 para usar casi todo el espacio
                y: (Math.random() - 0.5) * ARENA_BOUNDS * 1.8,
                z: (Math.random() - 0.5) * ARENA_BOUNDS * 1.8
            };
            
            activeCoins[coinId] = { id: coinId, position: position };
            
            // Enviar moneda a TODOS los clientes
            io.emit('SpawnCoin', activeCoins[coinId]);
        }
    };

    // Spawnear el primer batch inmediatamente
    spawnBatch();
    // Iniciar el intervalo para batches futuros
    coinSpawnTimer = setInterval(spawnBatch, COIN_SPAWN_INTERVAL);
}

// ===================================
// LÓGICA DE CONEXIÓN SOCKET.IO
// ===================================

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('Iniciar', (nombre) => {
    // NUEVO CAMBIO: Permitir reconexión si el juego terminó, pero no si está lleno
    if (getPlayerCount() >= 2 && gameState === 'playing') {
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
      status: 'playing' // playing, finished
    };
    
    console.log('Jugador iniciado:', players[socket.id].name);

    // Enviar a todos la lista actual de jugadores
    const playerList = Object.values(players).map(p => ({ name: p.name, modelIndex: p.modelIndex }));
    io.emit('Iniciar', playerList);

    // Si ya somos 2, avisar que estamos listos para 'PlayerReady'
    if (getPlayerCount() === 2) {
      io.emit('JuegoListo');
    }
  });

  // NUEVO CAMBIO: Recibir Posición Y Rotación
  socket.on('Posicion', (posicion, rotacion, nombre) => {
    const player = getPlayerById(socket.id);
    if (player) {
      // Re-transmitir a todos (incluido el emisor, para depuración si es necesario, o broadcast)
      socket.broadcast.emit('Posicion', { 
        id: player.id, 
        name: player.name, 
        x: posicion.x, y: posicion.y, z: posicion.z,
        rot: rotacion, // Enviar objeto de rotación
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
        console.log("Ambos listos! Iniciando juego...");
        startGame(); // Iniciar la lógica del juego
      }
    }
  });

  // ===================================
  // NUEVO CAMBIO: LÓGICA DE MONEDAS Y PENALIZACIÓN
  // ===================================

  socket.on('CoinCollected', (data) => {
    if (gameState !== 'playing') return;

    const player = getPlayerById(socket.id);
    const coin = activeCoins[data.coinId];

    // Verificar que el jugador y la moneda existan
    if (player && coin) {
      // Eliminar moneda del estado
      delete activeCoins[data.coinId];
      
      // Incrementar score
      player.score += 1;
      coinsCollectedCount++;

      // Notificar a TODOS los clientes que la moneda desapareció
      io.emit('RemoveCoin', data.coinId);
      // Actualizar marcadores
      io.emit('UpdateScores', getScores());

      // --- CHEQUEO DE FIN DE PARTIDA ---
      if (coinsCollectedCount >= TOTAL_COINS) {
        console.log("--- JUEGO TERMINADO: MONEDAS RECOLECTADAS ---");
        gameState = 'finished';
        if (coinSpawnTimer) clearInterval(coinSpawnTimer);
        
        const scores = getScores();
        let winnerName = "EMPATE";
        
        if (scores.length === 2) {
            if (scores[0].score > scores[1].score) {
                winnerName = scores[0].name;
            } else if (scores[1].score > scores[0].score) {
                winnerName = scores[1].name;
            }
        } else if (scores.length === 1) {
            winnerName = scores[0].name; // Gana por default si está solo
        }

        io.emit('GameOver', { winner: winnerName, reason: 'coins_finished' });
      }
    }
  });

  socket.on('PlayerHitPenalty', () => {
    if (gameState !== 'playing') return;
    
    const player = getPlayerById(socket.id);
    if (player) {
      // Aplicar penalización
      player.score -= 10;
      // El score puede ser negativo
      
      // Actualizar marcadores
      io.emit('UpdateScores', getScores());
      // Enviar orden de respawn SOLO a ese jugador
      socket.emit('RespawnPlayer');
    }
  });

  // --- LÓGICA ANTIGUA (ELIMINADA) ---
  // socket.on('PlayerLost', ...)
  // socket.on('PlayerFinished', ...)

  // ===================================
  // MANEJO DE DESCONEXIÓN
  // ===================================

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const disconnectedPlayer = players[socket.id];
    
    if (disconnectedPlayer) {
      delete players[socket.id]; // Eliminar jugador
      
      const remainingPlayer = getOtherPlayer(socket.id); // 'getOtherPlayer' ya no lo encontrará
      
      // NUEVO CAMBIO: Si el juego estaba en curso y uno se va, el otro gana
      if (remainingPlayer && gameState === 'playing') { 
        console.log("Jugador desconectado en plena partida. El otro gana.");
        io.emit('GameOver', { winner: remainingPlayer.name, reason: 'disconnect' });
        // Resetear el estado para la próxima
        resetGameState(); 
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