// Importar la biblioteca Three.js para gráficos 3D
import * as THREE from 'three';
// Importar el cargador de modelos 3D en formato OBJ
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
// Importar el cargador de materiales en formato MTL (Material Template Library)
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
// NUEVO CAMBIO: Importar OrbitControls para el modo local, si se desea, o para depuración.
// Por ahora, implementaremos el control de mouse manual.

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
const fuelContainer = document.getElementById('fuelContainer'); // NUEVO CAMBIO: Referencia al contenedor

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
// NUEVO CAMBIO: Almacén de monedas activas
let activeCoins = {};

// Variables de Control (MODO LOCAL)
const velocidadAvance = 0.2; // Solo local
const playerSpeed = 0.4; // Velocidad de movimiento WASD local
const LIMITE_X_POS = 70;  
const LIMITE_X_NEG = -70; 
const LIMITE_Y_POS = 50;  
const LIMITE_Y_NEG = -30; 
const obstacleSpawnZ = -150; 
const BOMB_AGGRO_RANGE = 50; 
const BOMB_HOMING_SPEED = 0.3; //Velocidad bomba 
const STOP_SPAWN_ZONE = 150;

//Variables de Control (MODO ONLINE)
const keyStates = {}; // Para un movimiento más suave
let playerYaw = 0; // Rotación horizontal (mouse)
let playerPitch = 0; // Rotación vertical (mouse)
const mouseSensitivity = 0.002;
let arenaBounds = new THREE.Vector3(100, 100, 100); // Límites del cubo

// Variables de Estado (para ambos modos)
let vidas = 3;
let distanciaRecorrida = 0;
let gameOver = false;
let maxFuel = 100;
let fuel = maxFuel;
const fuelDepletionRate = 0.01; 
const fuelDepletionRateBoost = 0.05; // NUEVO CAMBIO: Gasto de boost
const fuelRefillAmount = 30; 
let localCoinScore = 0; // Para el conteo local de monedas (solo local)

// ===================================
// LÓGICA DE DIFICULTAD Y SPAWNEO
// ===================================
let distanciaMeta;
let obstacleSpawnRate;
let spawnableModels = [];

const baseModels = [
    { path: 'models/bird', name: 'Bird', scale: new THREE.Vector3(0.5, 0.5, 0.5), type: 'obstacle' },
    { path: 'models/cloud', name: 'Cloud', scale: new THREE.Vector3(1, 1, 1), type: 'obstacle' },
    { path: 'models/dogballon', name: 'DogBallon', scale: new THREE.Vector3(1, 1, 1), type: 'obstacle' },
    { path: 'models/dron', name: 'Dron', scale: new THREE.Vector3(0.6, 0.6, 0.6), type: 'obstacle' },
    { path: 'models/kite', name: 'Kite', scale: new THREE.Vector3(1.2, 1.2, 1.2), type: 'obstacle' },
    { path: 'models/gascan', name: 'Gascan', scale: new THREE.Vector3(2, 2, 2), type: 'fuel' },
];


spawnableModels = [...baseModels];

if (gameMode === 'local') {
    // --- Lógica de Modo Local ---
    spawnableModels.push(
        { path: 'models/oxygen', name: 'Oxygen', scale: new THREE.Vector3(3, 3, 3), type: 'life' } 
    );

    if (gameDifficulty === 'dificil') {
        distanciaMeta = 1620; 
        obstacleSpawnRate = 0.1; 
        spawnableModels.push(
            { path: 'models/bomb', name: 'Bomb', scale: new THREE.Vector3(5, 5, 5), type: 'homing_obstacle' }
        );
    } else {
        distanciaMeta = 1080; 
        obstacleSpawnRate = 0.05; 
    }
    
    player1ScoreUI.classList.add('hidden');
    player2ScoreUI.classList.add('hidden');
    instructionsLocal.classList.remove('hidden');
    instructionsOnline.classList.add('hidden');
    if(vidasContainer) vidasContainer.style.display = 'block';
    
} else {
    // --- Lógica de Modo Online ---
    //La dificultad no afecta la meta, solo spawneo
    obstacleSpawnRate = (gameDifficulty === 'dificil') ? 0.025 : 0.015;

    spawnableModels.push(
        { path: 'models/bomb', name: 'Bomb', scale: new THREE.Vector3(1, 1, 1), type: 'homing_obstacle' }
    );
    // Las monedas (coin) se manejarán por el servidor.
    
    player1ScoreUI.classList.remove('hidden');
    player2ScoreUI.classList.remove('hidden');
    instructionsLocal.classList.add('hidden');
    instructionsOnline.classList.remove('hidden');
    
    //Ocultar vidas en modo online
    if(vidasContainer) vidasContainer.style.display = 'none';
}

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

    // Definir ruta del mapa
    let mapModelPath = 'models/desierto'; // Default
    if (gameMap === 'Bosque') mapModelPath = 'models/bosque';
    else if (gameMap === 'Montañas Nevadas') mapModelPath = 'models/nieve';

    if (gameMode === 'local') {
        // MODO LOCAL: Skybox y pista lineal
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
        cargarModeloEstatico(mapModelPath, gameMap, new THREE.Vector3(7, 7, 7), metaPosition); //Escala mapa final 
    
    } else {
        // MODO ONLINE: Cubo de arena y mapa como suelo
        // NUEVO CAMBIO: Crear la arena
        const arenaSize = 200;
        arenaBounds = new THREE.Vector3(arenaSize/2, arenaSize/2, arenaSize/2);
        
        // Usamos un skybox simple para el fondo
        const skyboxPath = 'skybox/';
        const skyboxExt = '.png';
        const cubeTextureLoader = new THREE.CubeTextureLoader();
        const texture = cubeTextureLoader.load([
            skyboxPath + 'px' + skyboxExt, skyboxPath + 'nx' + skyboxExt,
            skyboxPath + 'py' + skyboxExt, skyboxPath + 'ny' + skyboxExt,
            skyboxPath + 'pz' + skyboxExt, skyboxPath + 'nz' + skyboxExt,
        ]);
        scene.background = texture;

        // Opcional: añadir un 'suelo' visual o usar el modelo del mapa
        cargarModeloEstatico(
            mapModelPath, 
            gameMap, 
            new THREE.Vector3(7, 7, 7), // Más grande
            new THREE.Vector3(0, -arenaBounds.y + 10, 0) // En el fondo
        );

        // Caja invisible o con wireframe para ver límites
        // const arenaGeo = new THREE.BoxGeometry(arenaSize, arenaSize, arenaSize);
        // const arenaMat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.BackSide, wireframe: true, opacity: 0.2, transparent: true });
        // const arena = new THREE.Mesh(arenaGeo, arenaMat);
        // scene.add(arena);
    }
    
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
                    object.position.set(0, 0, 0); // Posición inicial
                    objAxolote = object;
                    object.rotation.y = Math.PI; // Mirando hacia adelante
                    
                    if (gameMode === 'local') {
                        camera.position.set(0, 1, objAxolote.position.z + 5); 
                        camera.lookAt(objAxolote.position);
                    } else {
                        //Configuración cámara online
                        actualizarCamaraOnline();
                    }
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

// NUEVO CAMBIO: Cargar item ahora acepta ID único (para monedas)
function cargarItem(path, nombre, vectorEscala, posicion, tipo, uniqueId = null) {
    const itemMtlLoader = new MTLLoader();
    const itemObjLoader = new OBJLoader();

    itemMtlLoader.load(path + '.mtl', function (materials) {
        materials.preload();
        itemObjLoader.setMaterials(materials);
        
        itemObjLoader.load(path + '.obj',
            function (object) {
                // Usar ID único si se provee (para monedas), si no, nombre genérico
                object.name = uniqueId || (nombre + '_' + Math.random());
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

                if (tipo === 'coin') {
                    // Guardar en el almacén de monedas
                    activeCoins[object.name] = item;
                } else {
                    obstaculos.push(item);
                }
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
        console.log("Socket: 'StartCountdown' RECIBIDO. Iniciando cuenta...");
        initAudioAndStartCountdown();
    });

    socket.on('UpdateScores', (scores) => {
        // NUEVO CAMBIO: Asegurarse de que el score se muestre correctamente
        const myScoreData = scores.find(s => s.name === nombreJugador1);
        const otherPlayerData = scores.find(s => s.name !== nombreJugador1);

        if (myScoreData) {
            player1ScoreText.textContent = myScoreData.score;
        } else {
             player1ScoreText.textContent = "0"; // Asegurar que mi score se muestre
        }

        if (otherPlayerData) {
            player2ScoreText.textContent = otherPlayerData.score;
        } else {
            player2ScoreText.textContent = "0";
        }
    });

    // NUEVO CAMBIO: Recibir posición Y ROTACIÓN
    socket.on('Posicion', (data) => {
        if (data.name !== nombreJugador1) {
            const remoteNameKey = `RemotePlayer_${data.name}`;
            const playerEntry = jugadoresRemotos[remoteNameKey];
            if (playerEntry && playerEntry.object3d) {
                playerEntry.object3d.position.set(data.x, data.y, data.z);
                // Aplicar rotación
                playerEntry.object3d.rotation.set(data.rot._x, data.rot._y, data.rot._z);
            }
        }
    });

    // NUEVO CAMBIO: Listeners para monedas
    socket.on('SpawnCoin', (coinData) => {
        cargarItem(
            'models/coin',
            'Coin',
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(coinData.position.x, coinData.position.y, coinData.position.z),
            'coin',
            coinData.id
        );
    });

    socket.on('RemoveCoin', (coinId) => {
        const coin = activeCoins[coinId];
        if (coin && coin.object3d) {
            scene.remove(coin.object3d);
            delete activeCoins[coinId];
        }
    });
    
    // NUEVO CAMBIO: Listener para respawn por penalización
    socket.on('RespawnPlayer', () => {
        if (objAxolote) {
            // Respawn en un lugar aleatorio dentro de la arena
            objAxolote.position.set(
                (Math.random() - 0.5) * arenaBounds.x * 0.8,
                Math.random() * arenaBounds.y * 0.5, // Mitad superior
                (Math.random() - 0.5) * arenaBounds.z * 0.8
            );
            playerYaw = 0;
            playerPitch = 0;
            fuel = maxFuel; // Rellenar combustible
            actualizarUIFuel();
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
    
    socket.on('GameOver', (data) => {
        if (gameOver) return; // Evitar doble ejecución
        
        gameOver = true;
        paused = true;
        if (gameMusic) gameMusic.pause();
        
        // NUEVO CAMBIO: Salir del Pointer Lock si está activo
        document.exitPointerLock();

        gameOverScreen.classList.remove('hidden');
        restartBtn.style.display = 'none'; // No reiniciar en online
        
        const translations = window.translations || {};
        const winnerName = data.winner;
        let message = "";

        if (winnerName === "EMPATE") {
            message = translations['game_over_online_tie'] || "IT'S A TIE!";
        // NUEVO CAMBIO: Nuevas razones de Game Over
        } else if (data.reason === 'coins_finished') {
             message = (translations['game_over_online_score'] || "{winner} WINS BY COINS!")
                      .replace('{winner}', winnerName);
        } else if (data.reason === 'disconnect') {
            message = (translations['game_over_online_disconnect'] || "{winner} WINS! Opponent disconnected.")
                      .replace('{winner}', winnerName);
        } else {
            // Fallback por si acaso
            message = (translations['game_over_online_win'] || "{winner} WINS!")
                      .replace('{winner}', winnerName);
        }
        
        gameOverMessage.textContent = message;
    });
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
        // NUEVO CAMBIO: Detener el mouse lock si pausamos
        if (gameMode === 'online' && document.pointerLockElement === canvas) {
            document.exitPointerLock();
        }
        renderer.render(scene, camera); // Renderizar escena pausada
        return; 
    }

    // NUEVO CAMBIO: Asegurarse que el mouse esté bloqueado en online
    if (gameMode === 'online' && document.pointerLockElement !== canvas) {
        // Mostrar un mensaje para hacer clic si es necesario
    }


    if (objAxolote) {

        if (gameMode === 'local') {
            // --- LÓGICA DE MOVIMIENTO LOCAL (SIN CAMBIOS) ---
            objAxolote.position.z -= velocidadAvance;
            distanciaRecorrida += velocidadAvance;
            fuel -= fuelDepletionRate;
            actualizarUIFuel(); 

            camera.position.z = objAxolote.position.z + 5;
            camera.position.y = objAxolote.position.y + 1;
            camera.position.x = objAxolote.position.x;
            camera.lookAt(objAxolote.position);
            
            const stopSpawningZ = -distanciaMeta + STOP_SPAWN_ZONE; 
            if (objAxolote.position.z > stopSpawningZ && Math.random() < obstacleSpawnRate) { 
                spawnItemLocal();
            }

        } else {
            // --- NUEVO CAMBIO: LÓGICA DE MOVIMIENTO ONLINE ---
            actualizarMovimientoOnline();
            actualizarCamaraOnline();
            
            // Spawneo de obstáculos (combustible, etc.)
            if (Math.random() < obstacleSpawnRate * 0.1) { // Menos frecuente
                spawnItemOnline();
            }
        }

        // --- LÓGICA DE COLISIÓN (AMBOS MODOS) ---
        AxoloteBB.setFromObject(objAxolote);

        // Colisión con Obstáculos (y combustible, etc.)
        for (let i = obstaculos.length - 1; i >= 0; i--) {
            const obs = obstaculos[i];
            if (!obs || !obs.object3d) {
                obstaculos.splice(i, 1);
                continue;
            }

            // Limpieza de objetos lejanos (distinto para local y online)
            if (gameMode === 'local') {
                if (obs.object3d.position.z > objAxolote.position.z + 10) {
                    scene.remove(obs.object3d);
                    obstaculos.splice(i, 1);
                    continue;
                }
            } else {
                // En online, los objetos no se mueven, así que no los borramos por Z
                // Podríamos borrarlos por distancia si se acumulan muchos
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
                handleCollision(i, obs.type, null); 
            }
        }
        
        // NUEVO CAMBIO: Colisión con Monedas (Solo Online)
        if (gameMode === 'online') {
            const coinIds = Object.keys(activeCoins);
            for (const coinId of coinIds) {
                const coin = activeCoins[coinId];
                if (coin && coin.object3d) {
                    coin.boundingBox.setFromObject(coin.object3d);
                    if (AxoloteBB.intersectsBox(coin.boundingBox)) {
                        handleCollision(null, coin.type, coinId);
                    }
                }
            }
        }
        
        // --- FIN DE PARTIDA ---
        if (gameMode === 'local' && !gameOver) {
            if (vidas <= 0 || fuel <= 0) {
                triggerGameOver(false); // Pierde local
            }
            if (Math.abs(distanciaRecorrida) >= distanciaMeta) {
                triggerGameOver(true); // Gana local
            }
        } 
        else if (gameMode === 'online' && !gameOver) {
            // NUEVO CAMBIO: Penalización por combustible
            if (fuel <= 0) {
                if (socket) {
                    socket.emit('PlayerHitPenalty'); // Avisar al servidor
                }
                // El servidor nos enviará 'RespawnPlayer'
            }
        }
    }
    
    renderer.render(scene, camera);
}

// NUEVO CAMBIO: Lógica de movimiento online
function actualizarMovimientoOnline() {
    if (!objAxolote) return;

    const isBoosting = keyStates['ShiftLeft'] || false;
    const moveSpeed = isBoosting ? 0.3 : 0.15;
    
    // Gasto de combustible
    let fuelSpent = fuelDepletionRate;
    if (keyStates['KeyW'] || keyStates['KeyS']) {
        if (isBoosting) {
            fuelSpent = fuelDepletionRateBoost;
        }
    }
    fuel -= fuelSpent;
    actualizarUIFuel();

    // Calcular vector de dirección basado en la rotación (Yaw/Pitch)
    const forward = new THREE.Vector3(0, 0, -1);
    // Aplicar rotaciones
    forward.applyAxisAngle(new THREE.Vector3(1, 0, 0), playerPitch);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);

    // Mover
    if (keyStates['KeyW'] && fuel > 0) {
        objAxolote.position.add(forward.clone().multiplyScalar(moveSpeed));
    }
    if (keyStates['KeyS'] && fuel > 0) {
        objAxolote.position.add(forward.clone().multiplyScalar(-moveSpeed));
    }
    
    // Aplicar rotación al modelo
    // Reseteamos la rotación y la aplicamos desde cero
    objAxolote.rotation.set(0, 0, 0);
    objAxolote.rotation.y = playerYaw + Math.PI; // +PI porque el modelo mira hacia atrás
    objAxolote.rotateOnAxis(new THREE.Vector3(1, 0, 0), playerPitch);


    // Límites de la arena
    objAxolote.position.x = Math.max(-arenaBounds.x, Math.min(arenaBounds.x, objAxolote.position.x));
    objAxolote.position.y = Math.max(-arenaBounds.y, Math.min(arenaBounds.y, objAxolote.position.y));
    objAxolote.position.z = Math.max(-arenaBounds.z, Math.min(arenaBounds.z, objAxolote.position.z));

    // Emitir posición Y rotación
    if (socket) {
        socket.emit('Posicion', objAxolote.position, objAxolote.rotation, nombreJugador1);
    }
}

// NUEVO CAMBIO: Lógica de cámara online
function actualizarCamaraOnline() {
    if (!objAxolote) return;
    
    // Offset detrás y arriba del jugador
    const offset = new THREE.Vector3(0, 1, 5); 

    // Aplicar rotaciones del mouse al offset
    offset.applyAxisAngle(new THREE.Vector3(1, 0, 0), playerPitch);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);

    // Posicionar la cámara
    camera.position.copy(objAxolote.position).add(offset);
    
    // Mirar al jugador
    camera.lookAt(objAxolote.position);
}


function spawnItemLocal() {
    const modelInfo = spawnableModels[Math.floor(Math.random() * spawnableModels.length)];
    if (!modelInfo) return; 

    const randomX = (Math.random() - 0.5) * 150; 
    const randomY = (Math.random() - 0.5) * 80 + 10; 
    const spawnZ = objAxolote.position.z + obstacleSpawnZ; 
    const randomPos = new THREE.Vector3(randomX, randomY, spawnZ);
    
    cargarItem(
        modelInfo.path,
        modelInfo.name,
        modelInfo.scale,
        randomPos,
        modelInfo.type
    );
}

// NUEVO CAMBIO: Spawneo de items en online (solo combustible y bombas)
function spawnItemOnline() {
    // Filtrar solo combustible y obstáculos
    const onlineSpawnable = spawnableModels.filter(m => m.type === 'fuel' || m.type === 'obstacle' || m.type === 'homing_obstacle');
    const modelInfo = onlineSpawnable[Math.floor(Math.random() * onlineSpawnable.length)];
    if (!modelInfo) return;

    // Posición aleatoria dentro de la arena
    const randomPos = new THREE.Vector3(
        (Math.random() - 0.5) * arenaBounds.x * 1.8, // * 1.8 para usar casi todo el espacio
        (Math.random() - 0.5) * arenaBounds.y * 1.8,
        (Math.random() - 0.5) * arenaBounds.z * 1.8
    );
    
    cargarItem(
        modelInfo.path,
        modelInfo.name,
        modelInfo.scale,
        randomPos,
        modelInfo.type
    );
}

// NUEVO CAMBIO: handleCollision modificado
function handleCollision(obstacleIndex, type, coinId = null) {
    
    switch (type) {
        case 'coin':
            // Es una moneda (solo online)
            if (gameMode === 'online' && socket && coinId) {
                const coin = activeCoins[coinId];
                if (!coin) return; // Ya fue recolectada

                // Borrar localmente y notificar al servidor
                scene.remove(coin.object3d);
                delete activeCoins[coinId];
                socket.emit('CoinCollected', { coinId: coinId });
                
                if(coinSound && !sfxMuted) {
                    coinSound.currentTime = 0; 
                    coinSound.play().catch(e => {});
                }
            }
            break;
            
        case 'homing_obstacle':
        case 'obstacle':
            // Es un obstáculo (Diferente lógica para local/online)
            if (obstacleIndex === null) return;
            const itemToRemoveObs = obstaculos.splice(obstacleIndex, 1)[0];
            if (itemToRemoveObs) {
                scene.remove(itemToRemoveObs.object3d);
            }
            
            if (gameMode === 'local') {
                vidas--;
                actualizarUIVidas();
            } else {
                // MODO ONLINE: Penalización
                if (socket) {
                    socket.emit('PlayerHitPenalty');
                }
                // El servidor enviará 'RespawnPlayer'
            }

            if(collisionSound && !sfxMuted) {
                collisionSound.currentTime = 0; 
                collisionSound.play().catch(e => {});
            }
            break;
            
        case 'fuel':
            // Combustible (Igual en ambos modos)
            if (obstacleIndex === null) return;
            const itemToRemoveFuel = obstaculos.splice(obstacleIndex, 1)[0];
            if (itemToRemoveFuel) {
                scene.remove(itemToRemoveFuel.object3d);
            }
            
            fuel = Math.min(maxFuel, fuel + fuelRefillAmount);
            actualizarUIFuel();
            break;
            
        case 'life':
            // Vidas (Solo Local)
            if (gameMode === 'local') {
                if (obstacleIndex === null) return;
                const itemToRemoveLife = obstaculos.splice(obstacleIndex, 1)[0];
                if (itemToRemoveLife) {
                    scene.remove(itemToRemoveLife.object3d);
                }
            
                if (vidas < 3) {
                    vidas++;
                    actualizarUIVidas();
                }
            }
            break;
    }
}

// --- FUNCIONES DE UI ---
function actualizarUIVidas() {
    if (!vidasContainer || gameMode === 'online') return; // No mostrar vidas en online
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
    
    if (paused) {
        gameMusic.pause();
        // NUEVO CAMBIO: Liberar mouse si pausamos en online
        if (gameMode === 'online') {
            document.exitPointerLock();
        }
    } else {
        gameMusic.play().catch(e => {});
        // NUEVO CAMBIO: Bloquear mouse si reanudamos en online
        if (gameMode === 'online') {
            canvas.requestPointerLock();
        }
    }
});

// Botones Menú Pausa
document.getElementById('resumeBtn').addEventListener('click', () => {
    paused = false;
    pauseMenu.classList.add('hidden');
    gameMusic.play().catch(e => {});
    // NUEVO CAMBIO: Bloquear mouse si reanudamos en online
    if (gameMode === 'online') {
        canvas.requestPointerLock();
    }
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

// ===================================
// NUEVO CAMBIO: SISTEMA DE CONTROL REFACTORIZADO
// ===================================

// Control MODO LOCAL (Teclado Simple)
document.addEventListener('keydown', (event) => {
    if (gameMode !== 'local' || paused || gameOver || !objAxolote || instructions.style.display !== 'none') { 
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

// Control MODO ONLINE (Teclado + Mouse)
if (gameMode === 'online') {
    // Listeners para estado de teclas
    document.addEventListener('keydown', (e) => {
        if (paused || gameOver) return;
        keyStates[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
        keyStates[e.code] = false;
    });

    // Listener para movimiento del mouse
    document.addEventListener('mousemove', (event) => {
        if (paused || gameOver || document.pointerLockElement !== canvas) {
            return;
        }

        // Calcular rotación
        playerYaw -= event.movementX * mouseSensitivity;
        let pitchChange = event.movementY * mouseSensitivity;
        
        // Aplicar inversión si está activada
        if (invertY) {
            playerPitch += pitchChange;
        } else {
            playerPitch -= pitchChange;
        }

        // Limitar pitch (para no dar vueltas)
        playerPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, playerPitch));
    });
    
    // Bloquear mouse al hacer clic
    canvas.addEventListener('click', () => {
        if (!paused && !gameOver) {
            canvas.requestPointerLock();
        }
    });
}


// --- LÓGICA DE INICIO DE JUEGO ---

closeInstructions.addEventListener('click', handleInstructionsClose);

function handleInstructionsClose() {
    console.log("handleInstructionsClose: Clic detectado.");
    instructions.style.display = 'none';

    if (gameMode === 'online' && socket) {
        console.log("handleInstructionsClose: Modo ONLINE. Enviando 'PlayerReady'...");
        socket.emit('PlayerReady');
        // NUEVO CAMBIO: Bloquear mouse al inicio
        canvas.requestPointerLock();
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