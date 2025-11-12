// Función para obtener parámetros de la URL
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

const modo = getUrlParameter('modo');
const nombre = getUrlParameter('nombre');
const dificultad = getUrlParameter('dificultad');


document.querySelectorAll('.map-btn').forEach(boton => {
  boton.addEventListener('click', () => {
    const nombreMapa = boton.querySelector('.map-label').textContent;

    // Construir la URL con todos los parámetros
    let nextUrl = `MenuPausa.html?map=${encodeURIComponent(nombreMapa)}`;
    
    if (dificultad) {
        nextUrl += '&dificultad=' + dificultad;
    }
    if (modo) {
        nextUrl += '&modo=' + modo;
    }
    if (nombre) {
        nextUrl += '&nombre=' + encodeURIComponent(nombre);
    }
    
    window.location.href = nextUrl;
  });
});