// Función para obtener parámetros de la URL
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

const modo = getUrlParameter('modo');
const nombre = getUrlParameter('nombre');

// Al hacer clic en cualquiera de los botones, redirige a Mapas.html
document.querySelectorAll('.dif-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dificultad = btn.id; // 'facil' o 'dificil'

    // Construir la URL con todos los parámetros
    let nextUrl = 'Mapas.html?dificultad=' + dificultad;
    if (modo) {
        nextUrl += '&modo=' + modo;
    }
    if (nombre) {
        nextUrl += '&nombre=' + encodeURIComponent(nombre);
    }
    
    window.location.href = nextUrl;
  });
});