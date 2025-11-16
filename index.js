// --- Funciones del Modal ---
function abrirModal(id) {
  document.getElementById(id).style.display = "flex";
  
  if (id === 'configModal') {
    cargarConfiguracion();
  }
  // --- 1. MODIFICACIÓN ---
  // Si abrimos el modal de scores, cargamos los datos
  if (id === 'scoreModal') {
    cargarPuntuaciones();
  }
}

function cerrarModal(id) {
  document.getElementById(id).style.display = "none";
}

// --- 2. NUEVA FUNCIÓN ---
// Esta función buscará los scores en el servidor
async function cargarPuntuaciones() {
    const listaUl = document.querySelector('#scoreModal .lista-puntuaciones');
    if (!listaUl) return;

    listaUl.innerHTML = '<li>Cargando...</li>'; // Feedback para el usuario

    try {
        // Hacemos un fetch a la ruta que creamos en server.js
        const response = await fetch('/getHighScores');
        if (!response.ok) {
            throw new Error('No se pudo conectar al servidor');
        }
        
        const scores = await response.json();

        if (scores.length === 0) {
            listaUl.innerHTML = '<li>No hay puntuaciones todavía. ¡Juega una partida!</li>';
            return;
        }

        // Limpiar la lista y poblarla con los datos reales
        listaUl.innerHTML = '';
        scores.forEach(score => {
            const li = document.createElement('li');
            li.textContent = `${score.playerName} - ${score.score}`;
            listaUl.appendChild(li);
        });

    } catch (error) {
        console.error('Error al cargar puntuaciones:', error);
        listaUl.innerHTML = '<li>Error al cargar las puntuaciones.</li>';
    }
}
// --- FIN DE NUEVA FUNCIÓN ---


// --- Lógica de Configuración (Tu código existente) ---
const volumenSlider = document.getElementById('volumenSlider');
const sfxMuted = document.getElementById('sfxMuted');
const invertY = document.getElementById('invertY');
const languageSelect = document.getElementById('languageSelect');
const menuMusic = document.getElementById('menuMusic'); 

function cargarConfiguracion() {
  const volGuardado = localStorage.getItem('gameVolume');
  const volFinal = volGuardado !== null ? parseFloat(volGuardado) : 0.5;
  volumenSlider.value = volFinal * 100;
  if(menuMusic) menuMusic.volume = volFinal;

  sfxMuted.checked = (localStorage.getItem('sfxMuted') === 'true');
  invertY.checked = (localStorage.getItem('invertY') === 'true');
  languageSelect.value = localStorage.getItem('language') || 'es';
}

volumenSlider.addEventListener('input', (e) => {
  const vol = e.target.value / 100;
  localStorage.setItem('gameVolume', vol);
  if(menuMusic) menuMusic.volume = vol;
});

sfxMuted.addEventListener('change', (e) => {
  localStorage.setItem('sfxMuted', e.target.checked);
});

invertY.addEventListener('change', (e) => {
  localStorage.setItem('invertY', e.target.checked);
});

languageSelect.addEventListener('change', (e) => {
  const lang = e.target.value;
  localStorage.setItem('language', lang);
  window.location.reload(); 
});