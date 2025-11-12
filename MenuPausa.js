// Importar la biblioteca Three.js para gráficos 3D
import * as THREE from 'three';
// Importar el cargador de modelos 3D en formato OBJ
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// Importar el cargador de materiales en formato MTL (Material Template Library)
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

// ===================================
// UTILERÍAS
// ===================================
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function obtenerRutaModelo(modelIndex) {
    if (modelIndex === 1) return 'models/AJOLOTE';
    if (modelIndex === 2) return 'models/AJOLOTE2';
    return 'models/AJ0LOTE';
}

const gameMode = getUrlParameter('modo'); // 'local' o 'online'
const playerName = getUrlParameter('nombre');
const gameDifficulty = getUrlParameter('dificultad');
const gameMap = getUrlParameter('map');

// ===================================
// LEER CONFIGURACIÓN GUARDADA
// ===================================
const gameVolume = parseFloat(localStorage.getItem('gameVolume') || '0.5');
const sfxMuted = (localStorage.getItem('sfxMuted') === 'true');
const invertY = (localStorage.getItem('invertY') === 'true');
const pauseVolumenSlider = document.getElementById('pauseVolumenSlider');
if(pauseVolumenSlider) pauseVolumenSlider.value = gameVolume * 100;

// ===================================
// VARIABLES DE JUEGO Y RED
// ===================================
const socket = (gameMode === 'online') ? io() : null; 
const canvas = document.getElementById('gameCanvas');
const pauseMenu = document.getElementById('pauseMenu');
const instructions = document.getElementById('instructions');
const closeInstructions = document.getElementById('closeInstructions');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');

// UI (Ambos Modos)
const vidasContainer = document.getElementById('vidasContainer');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameOverMessage = document.getElementById('gameOverMessage');
const restartBtn = document.getElementById('restartBtn');
const exitBtnGameOver = document.getElementById('exitBtnGameOver');
const fuelBar = document.getElementById('fuelBar');

// UI Modo Online
const waitingOverlay = document.getElementById('waitingOverlay');
const player1ScoreUI = document.getElementById('player1Score');
const player2ScoreUI = document.getElementById('player2Score');
const player1ScoreText = player1ScoreUI.querySelector('span');
const player2ScoreText = player2ScoreUI.querySelector('span');

// Párrafos de instrucciones
const instructionsLocal = document.getElementById('instructions_local');
const instructionsOnline = document.getElementById('instructions_online');


// Aplicar volumen guardado a los audios
const countdownSound = document.getElementById('countdownSound');
if(countdownSound) countdownSound.volume = gameVolume;
const gameMusic = document.getElementById('gameMusic');
if(gameMusic) gameMusic.volume = gameVolume;
const collisionSound = document.getElementById('collisionSound');
if(collisionSound) collisionSound.volume = gameVolume;
const coinSound = document.getElementById('coinSound');
if(coinSound) coinSound.volume = gameVolume;

let nombreJugador1 = playerName || "JugadorLocal";
let localModelIndex = 0;
let nombreJugador2 = "";
let paused = true; 
const jugadoresRemotos = {}; 
let obstaculos = []; 

// Variables de Control
const velocidadAvance = 0.1; 
const playerSpeed = 0.2; 
const LIMITE_X_POS = 70;  
const LIMITE_X_NEG = -70; 
const LIMITE_Y_POS = 50;  
const LIMITE_Y_NEG = -30; 
const obstacleSpawnZ = -150; 
const BOMB_AGGRO_RANGE = 50; 
const BOMB_HOMING_SPEED = 0.11; 
const STOP_SPAWN_ZONE = 150;

// Variables de Estado (para ambos modos)
let vidas = 3;
let distanciaRecorrida = 0;
let gameOver = false;
let maxFuel = 100;
let fuel = maxFuel;
const fuelDepletionRate = 0.01; 
const fuelRefillAmount = 30; 
let localCoinScore = 0; // Para el conteo local de monedas

// ===================================
// LÓGICA DE DIFICULTAD Y SPAWNEO
// ===================================
let distanciaMeta;
let obstacleSpawnRate;
let spawnableModels = [];

const baseModels = [
    { path: 'models/bird', name: 'Bird', scale: new THREE.Vector3(0.3, 0.3, 0.3), type: 'obstacle' },
    { path: 'models/cloud', name: 'Cloud', scale: new THREE.Vector3(1, 1, 1), type: 'obstacle' },
    { path: 'models/dogballon', name: 'DogBallon', scale: new THREE.Vector3(1, 1, 1), type: 'obstacle' },
    { path: 'models/dron', name: 'Dron', scale: new THREE.Vector3(0.6, 0.6, 0.6), type: 'obstacle' },
    { path: 'models/kite', name: 'Kite', scale: new THREE.Vector3(1.2, 1.2, 1.2), type: 'obstacle' },
    { path: 'models/gascan', name: 'Gascan', scale: new THREE.Vector3(2, 2, 2), type: 'fuel' },
    { path: 'models/oxygen', name: 'Oxygen', scale: new THREE.Vector3(1, 1, 1), type: 'life' } 
];

spawnableModels = [...baseModels];

if (gameDifficulty === 'dificil') {
    distanciaMeta = 1620; 
    obstacleSpawnRate = 0.025; 
    spawnableModels.push(
        { path: 'models/bomb', name: 'Bomb', scale: new THREE.Vector3(1, 1, 1), type: 'homing_obstacle' }
    );
} else {
    distanciaMeta = 1080; 
    obstacleSpawnRate = 0.015; 
}

if (gameMode === 'online') {
    spawnableModels.push(
        { path: 'models/coin', name: 'Coin', scale: new THREE.Vector3(1, 1, 1), type: 'coin' }
    );
    player1ScoreUI.classList.remove('hidden');
    player2ScoreUI.classList.remove('hidden');
    instructionsLocal.classList.add('hidden');
    instructionsOnline.classList.remove('hidden');

} else {
    player1ScoreUI.classList.add('hidden');
    player2ScoreUI.classList.add('hidden');
    instructionsLocal.classList.remove('hidden');
    instructionsOnline.classList.add('hidden');
}

if(vidasContainer) vidasContainer.style.display = 'block';
if(fuelContainer) fuelContainer.style.display = 'block';
// ===================================
// CONFIGURACIÓN THREE.JS
// ===================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); 

let objAxolote = null;
let AxoloteBB = new THREE.Box3();

function initThree() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(15, 5, 5);
    scene.add(dl);
    
    camera.position.z = 5; 

    const skyboxPath = 'skybox/';
    const skyboxExt = '.png';
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const texture = cubeTextureLoader.load([
        skyboxPath + 'px' + skyboxExt, skyboxPath + 'nx' + skyboxExt,
        skyboxPath + 'py' + skyboxExt, skyboxPath + 'ny' + skyboxExt,
        skyboxPath + 'pz' + skyboxExt, skyboxPath + 'nz' + skyboxExt,
    ]);
    scene.background = texture;

    const metaPosition = new THREE.Vector3(0, -40, -distanciaMeta);
    let mapModelPath = 'models/desierto'; // Default
    if (gameMap === 'Bosque') mapModelPath = 'models/bosque';
    else if (gameMap === 'Montañas Nevadas') mapModelPath = 'models/nieve';
    
    cargarModeloEstatico(mapModelPath, gameMap, new THREE.Vector3(1, 1, 1), metaPosition);
    
    actualizarUIVidas();
    actualizarUIFuel();
}
// ===================================
// CARGA DE MODELOS 3D
// ===================================
const loadingManager = new THREE.LoadingManager();
const mtlLoader = new MTLLoader(loadingManager);
const objLoader = new OBJLoader(loadingManager);

function Modelos3D(path, nombre, vectorEscala, isLocal = false) { 
    mtlLoader.load(path + '.mtl', function (materials) {
        materials.preload();
        objLoader.setMaterials(materials);
        
        objLoader.load(path + '.obj',
            function (object) {
                object.name = nombre;
                object.scale.copy(vectorEscala);
                
                if (isLocal) {
                    object.position.set(0, 0, 0);
                    objAxolote = object;
                    object.rotation.y = Math.PI;
                    camera.position.set(0, 1, objAxolote.position.z + 5); 
                    camera.lookAt(objAxolote.position);
                } else if (nombre.startsWith('RemotePlayer_')) {
                    const remoteNameKey = nombre; 
                    if (jugadoresRemotos[remoteNameKey]) {
                        jugadoresRemotos[remoteNameKey].object3d = object;
                    }
                }
                scene.add(object);
            },
            undefined,
            function (error) {
                console.error(`Error al cargar ${nombre}:`, error);
            }
        );
    });
}

function cargarModeloEstatico(path, nombre, vectorEscala, posicion) {
    mtlLoader.load(path + '.mtl', function (materials) {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.load(path + '.obj',
            function (object) {
                object.name = nombre;
                object.scale.copy(vectorEscala);
                object.position.copy(posicion);
                scene.add(object);
            }
        );
    });
}

function cargarItem(path, nombre, vectorEscala, posicion, tipo) {
    const itemMtlLoader = new MTLLoader();
    const itemObjLoader = new OBJLoader();

    itemMtlLoader.load(path + '.mtl', function (materials) {
        materials.preload();
        itemObjLoader.setMaterials(materials);
        
        itemObjLoader.load(path + '.obj',
            function (object) {
                object.name = nombre;
                object.scale.copy(vectorEscala);
                object.position.copy(posicion);
                scene.add(object);
                
                const boundingBox = new THREE.Box3().setFromObject(object);
                const item = { 
                    object3d: object, 
                    boundingBox: boundingBox, 
                    type: tipo 
                };

                if (tipo === 'homing_obstacle') {
                    item.isHoming = false; 
                }
                obstaculos.push(item);
            }
        );
    });
}
// ===================================
// LÓGICA SOCKET.IO / MULTIJUGADOR
// ===================================
function iniciarConexionAutomatica() {
    if (gameMode === 'online' && socket) {
        console.log("Iniciando Conexión ONLINE...");
        waitingOverlay.classList.remove('hidden');
        socket.emit('Iniciar', nombreJugador1);
        
    } else { // MODO LOCAL
        console.log("Iniciando Modo LOCAL.");
        waitingOverlay.classList.add('hidden');
        instructions.style.display = 'block'; // Mostrar instrucciones en local
        
        localModelIndex = 1; 
        if (!objAxolote) {
            Modelos3D(
                obtenerRutaModelo(localModelIndex),
                `Axolote_${nombreJugador1}`,
                new THREE.Vector3(0.5, 0.5, 0.5),
                true
            );
        }
    }
}

if (socket) {
    socket.on('Iniciar', (listaJugadoresInfo) => { 
        console.log("Socket 'Iniciar' RECIBIDO. Jugadores:", listaJugadoresInfo);
        listaJugadoresInfo.forEach(playerInfo => {
            if (playerInfo.name === nombreJugador1) {
                localModelIndex = playerInfo.modelIndex;
                if (!objAxolote) {
                    Modelos3D(
                        obtenerRutaModelo(localModelIndex),
                        `Axolote_${nombreJugador1}`,
                        new THREE.Vector3(0.5, 0.5, 0.5),
                        true
                    );
                }
            } else {
                nombreJugador2 = playerInfo.name;
                const remoteNameKey = `RemotePlayer_${playerInfo.name}`;
                if (!jugadoresRemotos[remoteNameKey]) {
                    jugadoresRemotos[remoteNameKey] = { object3d: null };
                    Modelos3D(
                        obtenerRutaModelo(playerInfo.modelIndex),
                        remoteNameKey,
                        new THREE.Vector3(0.5, 0.5, 0.5),
                        false
                    );
                }
            }
        });
    });

    socket.on('JuegoLleno', () => {
        console.error("Socket 'JuegoLleno' RECIBIDO.");
        alert("El juego está lleno. Redirigiendo al menú.");
        window.location.href = 'index.html';
    });

    socket.on('JuegoListo', () => {
        console.log("Socket 'JuegoListo' RECIBIDO. Mostrando instrucciones.");
        waitingOverlay.classList.add('hidden');
        instructions.style.display = 'block'; // Forzar muestra de instrucciones
    });

    socket.on('StartCountdown', () => {
        // DEBUGGING PARA PROBLEMA 2
        console.log("Socket: 'StartCountdown' RECIBIDO. Iniciando cuenta...");
        initAudioAndStartCountdown();
    });

    socket.on('UpdateScores', (scores) => {
        const myScoreData = scores.find(s => s.name === nombreJugador1);
        const otherPlayerData = scores.find(s => s.name !== nombreJugador1);

        if (myScoreData) player1ScoreText.textContent = myScoreData.score;
        if (otherPlayerData) player2ScoreText.textContent = otherPlayerData.score;
        else player2ScoreText.textContent = "0";
    });

    socket.on('Posicion', (data) => {
        if (data.name !== nombreJugador1) {
            const remoteNameKey = `RemotePlayer_${data.name}`;
            const playerEntry = jugadoresRemotos[remoteNameKey];
            if (playerEntry && playerEntry.object3d) {
                playerEntry.object3d.position.set(data.x, data.y, data.z);
            }
        }
    });

    socket.on('JugadorDesconectado', (nombre) => {
        console.log(`Socket 'JugadorDesconectado' RECIBIDO: ${nombre}`);
        const remoteNameKey = `RemotePlayer_${nombre}`;
        const playerToRemove = jugadoresRemotos[remoteNameKey]?.object3d;
        
        if (playerToRemove) {
            scene.remove(playerToRemove);
            delete jugadoresRemotos[remoteNameKey];
        }
    });
    
    // ===================================
    // == 🚨 INICIO DE LA REPARACIÓN (BUG 1) 🚨 ==
    // ===================================
    socket.on('GameOver', (data) => {
        // Se quitó el "if (gameOver) return;".
        // Ese era el bug. El cliente que perdía se bloqueaba a sí mismo
        // para recibir este mensaje.
        
        if (gameOver) {
            // Si el juego ya terminó, solo nos aseguramos de que el mensaje
            // de 'Game Over' esté visible.
            console.log("Servidor confirma Game Over. Mostrando mensaje final.");
        } else {
            // Si es la primera vez que recibimos este evento, pausamos todo.
            console.log("Recibiendo 'GameOver' del servidor POR PRIMERA VEZ.");
            gameOver = true;
            paused = true;
            if (gameMusic) gameMusic.pause();
        }
        
        gameOverScreen.classList.remove('hidden');
        restartBtn.style.display = 'none'; // No reiniciar en online
        
        const translations = window.translations || {};
        const winnerName = data.winner;
        let message = "";

        if (winnerName === "EMPATE") {
            message = translations['game_over_online_tie'] || "IT'S A TIE!";
        } else if (data.reason === 'death') {
            message = (translations['game_over_online_death'] || "{winner} WINS! Opponent eliminated.")
                      .replace('{winner}', winnerName);
        } else if (data.reason === 'score') {
            message = (translations['game_over_online_score'] || "{winner} WINS BY COINS!")
                      .replace('{winner}', winnerName);
        } else if (data.reason === 'disconnect') {
            message = (translations['game_over_online_disconnect'] || "{winner} WINS! Opponent disconnected.")
                      .replace('{winner}', winnerName);
        } else {
            message = (translations['game_over_online_win'] || "{winner} WINS!")
                      .replace('{winner}', winnerName);
        }
        
        gameOverMessage.textContent = message;
    });
    // ===================================
    // == 🚨 FIN DE LA REPARACIÓN (BUG 1) 🚨 ==
    // ===================================
}
// ===================================
// LÓGICA DE JUEGO, ANIMACIÓN Y EVENTOS
// ===================================

function animate() {
    requestAnimationFrame(animate);

    if (gameMode === 'online' && !waitingOverlay.classList.contains('hidden')) {
        return; // Esperando jugador
    }

    if (paused) {
        renderer.render(scene, camera); // Renderizar escena pausada
        return; 
    }

    if (objAxolote) {
        objAxolote.position.z -= velocidadAvance;
        distanciaRecorrida += velocidadAvance;
        fuel -= fuelDepletionRate;
        actualizarUIFuel(); 

        camera.position.z = objAxolote.position.z + 5;
        camera.position.y = objAxolote.position.y + 1;
        camera.position.x = objAxolote.position.x;
        camera.lookAt(objAxolote.position);

        AxoloteBB.setFromObject(objAxolote);

        const stopSpawningZ = -distanciaMeta + STOP_SPAWN_ZONE; 
        if (objAxolote.position.z > stopSpawningZ && Math.random() < obstacleSpawnRate) { 
            spawnItem();
        }

        for (let i = obstaculos.length - 1; i >= 0; i--) {
            const obs = obstaculos[i];
            if (!obs || !obs.object3d) {
                obstaculos.splice(i, 1);
                continue;
            }

            if (obs.object3d.position.z > objAxolote.position.z + 10) {
                scene.remove(obs.object3d);
                obstaculos.splice(i, 1);
                continue;
            }

            if (obs.type === 'homing_obstacle') {
                const distance = obs.object3d.position.distanceTo(objAxolote.position);
                if (obs.isHoming) {
                    const direction = new THREE.Vector3().subVectors(objAxolote.position, obs.object3d.position).normalize(); 
                    obs.object3d.position.add(direction.multiplyScalar(BOMB_HOMING_SPEED));
                } 
                else if (distance < BOMB_AGGRO_RANGE) {
                    obs.isHoming = true; 
                }
            }

            obs.boundingBox.setFromObject(obs.object3d);
            if (AxoloteBB.intersectsBox(obs.boundingBox)) {
                handleCollision(i, obs.type); 
            }
        }
        
        if (gameMode === 'online' && socket) {
            socket.emit('Posicion', objAxolote.position, nombreJugador1);
        }

        // Lógica de Fin de Partida
        if (gameMode === 'local' && !gameOver) {
            if (vidas <= 0 || fuel <= 0) {
                triggerGameOver(false); // Pierde local
            }
            if (Math.abs(distanciaRecorrida) >= distanciaMeta) {
                triggerGameOver(true); // Gana local
            }
        } 
        else if (gameMode === 'online' && !gameOver) {
            // Revisar si perdimos
            if (vidas <= 0 || fuel <= 0) {
                // Solo enviamos el evento UNA VEZ
                if (!gameOver) {
                    console.log("GAME OVER (LOCAL): Sin vidas/combustible. Avisando al servidor.");
                    gameOver = true;
                    paused = true;
                    socket.emit('PlayerLost', nombreJugador1);
                }
            }
            // Revisar si llegamos a la meta
            if (Math.abs(distanciaRecorrida) >= distanciaMeta) {
                // Solo enviamos el evento UNA VEZ
                if (!gameOver) {
                    console.log("GAME OVER (LOCAL): Meta alcanzada. Avisando al servidor.");
                    gameOver = true;
                    paused = true;
                    socket.emit('PlayerFinished', { name: nombreJugador1, score: localCoinScore });
                }
            }
        }
    }
    
    renderer.render(scene, camera);
}


function spawnItem() {
    const modelInfo = spawnableModels[Math.floor(Math.random() * spawnableModels.length)];
    if (!modelInfo) return; 

    const randomX = (Math.random() - 0.5) * 150; 
    const randomY = (Math.random() - 0.5) * 80 + 10; 
    const spawnZ = objAxolote.position.z + obstacleSpawnZ; 
    const randomPos = new THREE.Vector3(randomX, randomY, spawnZ);
    
    cargarItem(
        modelInfo.path,
        modelInfo.name + '_' + Math.random(),
        modelInfo.scale,
        randomPos,
        modelInfo.type
    );
}

function handleCollision(obstacleIndex, type) {
    if (!obstaculos[obstacleIndex]) return; 

    const itemToRemove = obstaculos.splice(obstacleIndex, 1)[0];
    if (itemToRemove) {
        scene.remove(itemToRemove.object3d);
    }
    
    switch (type) {
        case 'coin':
            if (gameMode === 'online' && socket) {
                localCoinScore++;
                socket.emit('CoinCollected');
            }
            if(coinSound && !sfxMuted) {
                coinSound.currentTime = 0; 
                coinSound.play().catch(e => {});
            }
            break;
            
        case 'homing_obstacle':
        case 'obstacle':
            vidas--;
            actualizarUIVidas();
            if(collisionSound && !sfxMuted) {
                collisionSound.currentTime = 0; 
                collisionSound.play().catch(e => {});
            }
            break;
        case 'fuel':
            fuel = Math.min(maxFuel, fuel + fuelRefillAmount);
            actualizarUIFuel();
            break;
        case 'life':
            if (vidas < 3) {
                vidas++;
                actualizarUIVidas();
            }
            break;
    }
}

// --- FUNCIONES DE UI ---
function actualizarUIVidas() {
    if (!vidasContainer) return;
    vidasContainer.innerHTML = '';
    for (let i = 0; i < vidas; i++) {
        vidasContainer.innerHTML += '<img src="vida.png" alt="Vida">';
    }
}

function actualizarUIFuel() {
    if (!fuelBar) return;
    const fuelPercentage = (fuel / maxFuel) * 100;
    fuelBar.style.width = fuelPercentage + '%';
    
    if (fuelPercentage < 25) fuelBar.style.backgroundColor = '#f44336';
    else if (fuelPercentage < 50) fuelBar.style.backgroundColor = '#ffeb3b';
    else fuelBar.style.backgroundColor = '#4CAF50';
}

// (Solo Modo Local)
function triggerGameOver(isWin) {
    if (gameMode !== 'local' || gameOver) return;
    
    gameOver = true;
    paused = true; 
    if (gameMusic) gameMusic.pause();

    gameOverScreen.classList.remove('hidden');
    const translations = window.translations || {}; 
    
    if (isWin) {
        gameOverMessage.textContent = translations['game_over_win'] || "YOU MADE IT!";
    } else {
        gameOverMessage.textContent = translations['game_over_lose_life'] || "YOU KILLED THE AXOLOTL";
        if (fuel <= 0) {
             gameOverMessage.textContent = translations['game_over_lose_fuel'] || "YOU RAN OUT OF FUEL";
        }
    }
}

// (Solo Modo Local)
function reiniciarJuego() {
    if (gameMode !== 'local') return;
    window.location.reload(); // La forma más simple de reiniciar todo
}


function resizeCanvas() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resizeCanvas);


// Evento de Pausa (ESC)
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!waitingOverlay.classList.contains('hidden')) return;
    if (gameOver) return;
    if (instructions.style.display !== 'none') return;
    if (!countdownOverlay.classList.contains('hidden')) return;

    paused = !paused;
    pauseMenu.classList.toggle('hidden', !paused);
    
    if (paused) gameMusic.pause();
    else gameMusic.play().catch(e => {});
});

// Botones Menú Pausa
document.getElementById('resumeBtn').addEventListener('click', () => {
    paused = false;
    pauseMenu.classList.add('hidden');
    gameMusic.play().catch(e => {});
});

document.getElementById('exitBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Botones Game Over
restartBtn.addEventListener('click', reiniciarJuego); // Solo local
exitBtnGameOver.addEventListener('click', () => {
    window.location.href = 'index.html'; // Ambos modos
});

// Slider Volumen Pausa
pauseVolumenSlider.addEventListener('input', (e) => {
    const vol = e.target.value / 100;
    localStorage.setItem('gameVolume', vol);
    if(gameMusic) gameMusic.volume = vol;
    if(countdownSound) countdownSound.volume = vol;
    if(collisionSound) collisionSound.volume = vol;
    if(coinSound) coinSound.volume = vol;
});

// SISTEMA DE CONTROL
document.addEventListener('keydown', (event) => {
    if (paused || gameOver || !objAxolote || instructions.style.display !== 'none') { 
        return;
    } 

    let newX = objAxolote.position.x;
    let newY = objAxolote.position.y;

    if(event.key.toLowerCase() === 'a') newX -= playerSpeed;
    else if(event.key.toLowerCase() === 'd') newX += playerSpeed;
    else if(event.key.toLowerCase() === 'w') newY += (invertY ? -playerSpeed : playerSpeed);
    else if(event.key.toLowerCase() === 's') newY -= (invertY ? -playerSpeed : playerSpeed);
    
    objAxolote.position.x = Math.max(LIMITE_X_NEG, Math.min(LIMITE_X_POS, newX));
    objAxolote.position.y = Math.max(LIMITE_Y_NEG, Math.min(LIMITE_Y_POS, newY));
});


// --- LÓGICA DE INICIO DE JUEGO (CON DEBUGGING) ---

closeInstructions.addEventListener('click', handleInstructionsClose);

function handleInstructionsClose() {
    console.log("handleInstructionsClose: Clic detectado.");
    instructions.style.display = 'none';

    if (gameMode === 'online' && socket) {
        console.log("handleInstructionsClose: Modo ONLINE. Enviando 'PlayerReady'...");
        socket.emit('PlayerReady');
    } else {
        console.log("handleInstructionsClose: Modo LOCAL. Iniciando cuenta...");
        initAudioAndStartCountdown();
    }
}

function initAudioAndStartCountdown() {
    console.log("initAudioAndStartCountdown: Iniciando pre-calentado de audio...");

    const prewarmAudio = (audio) => {
        if (!audio) return Promise.resolve();
        const promise = audio.play();
        if (promise !== undefined) {
            return promise.then(() => { audio.pause(); audio.currentTime = 0; }).catch(e => {});
        }
        return Promise.resolve();
    };

    Promise.all([
        prewarmAudio(countdownSound),
        prewarmAudio(gameMusic),
        prewarmAudio(collisionSound),
        prewarmAudio(coinSound)
    ]).finally(() => {
        console.log("initAudioAndStartCountdown: Pre-calentado finalizado. Llamando a startGameCountdown.");
        setTimeout(startGameCountdown, 100); 
    });
}

function startGameCountdown() {
    console.log("startGameCountdown: MOSTRANDO OVERLAY DE CUENTA REGRESIVA.");
    countdownOverlay.classList.remove('hidden');
    paused = true; 
    gameOver = false;
    
    const translations = window.translations || {};
    let count = 3;
    countdownText.textContent = count;

    if (countdownSound && !sfxMuted) {
        countdownSound.currentTime = 0;
        countdownSound.play().catch(e => {});
    }

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.textContent = count;
        } else if (count === 0) {
            countdownText.textContent = translations['game_countdown_go'] || "GO!";
        } else {
            clearInterval(interval);
            console.log("startGameCountdown: ¡JUEGO INICIADO! Ocultando overlay.");
            countdownOverlay.classList.add('hidden');
            paused = false; 
            
            if (gameMusic) {
                gameMusic.currentTime = 0;
                gameMusic.play().catch(e => {});
            }
        }
    }, 1000); 
}

// ===================================
// INICIALIZACIÓN
// ===================================
initThree(); 
iniciarConexionAutomatica(); 
animate();