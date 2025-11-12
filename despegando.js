// Animar los tres puntos: se van "llenando" y reiniciando
const dots = document.getElementById('dots');
let count = 0;

setInterval(() => {
  count = (count + 1) % 4; // 0,1,2,3
  dots.textContent = '.'.repeat(count);
}, 500);
