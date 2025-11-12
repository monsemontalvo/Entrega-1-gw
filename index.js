// --- Funciones del Modal ---
function abrirModal(id) {
  document.getElementById(id).style.display = "flex";
  if (id === 'configModal') {
    cargarConfiguracion();
  }
}

function cerrarModal(id) {
  document.getElementById(id).style.display = "none";
}

// --- Lógica de Configuración ---

// Referencias a los elementos
const volumenSlider = document.getElementById('volumenSlider');
const sfxMuted = document.getElementById('sfxMuted');
const invertY = document.getElementById('invertY');
const languageSelect = document.getElementById('languageSelect'); // NUEVO
const menuMusic = document.getElementById('menuMusic'); 

// 1. FUNCIÓN PARA CARGAR LA CONFIGURACIÓN GUARDADA
function cargarConfiguracion() {
  // Cargar Volumen
  const volGuardado = localStorage.getItem('gameVolume');
  const volFinal = volGuardado !== null ? parseFloat(volGuardado) : 0.5;
  volumenSlider.value = volFinal * 100;
  if(menuMusic) menuMusic.volume = volFinal;

  // Cargar Mute SFX
  sfxMuted.checked = (localStorage.getItem('sfxMuted') === 'true');

  // Cargar Invertir Y
  invertY.checked = (localStorage.getItem('invertY') === 'true');

  // NUEVO: Cargar Idioma
  languageSelect.value = localStorage.getItem('language') || 'es';
}

// 2. EVENT LISTENERS PARA GUARDAR AL CAMBIAR
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

// NUEVO: Listener para el Idioma
languageSelect.addEventListener('change', (e) => {
  const lang = e.target.value;
  localStorage.setItem('language', lang);
  
  // Recargar la página para aplicar el nuevo idioma
  window.location.reload(); 
});