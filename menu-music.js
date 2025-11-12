// Este código se ejecutará en cada página de menú

// Espera a que el contenido de la página (incluido el audio) esté listo
document.addEventListener('DOMContentLoaded', () => {

    const menuMusic = document.getElementById('menuMusic');
    if (!menuMusic) return; 

    // --- 1. LÓGICA DE VOLUMEN ---
    // Cargar Volumen (default 0.5)
    const volGuardado = localStorage.getItem('gameVolume');
    menuMusic.volume = volGuardado !== null ? parseFloat(volGuardado) : 0.5;

    // --- 2. LÓGICA DE TIEMPO (Continuar canción) ---
    const savedTime = sessionStorage.getItem('menuMusicTime');
    if (savedTime) {
        menuMusic.currentTime = parseFloat(savedTime);
    }

    menuMusic.play().catch(error => {
        console.warn("La música de menú no pudo iniciarse automáticamente.", error);
    });

    // Guardar el tiempo antes de salir
    window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('menuMusicTime', menuMusic.currentTime);
    });
});