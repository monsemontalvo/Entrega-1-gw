// Variable global para guardar las traducciones
window.translations = {};

// 1. Función para cargar el archivo JSON del idioma
async function loadTranslations(lang) {
  try {
    const response = await fetch(`i18n/${lang}.json`);
    if (!response.ok) {
      throw new Error('File not found');
    }
    const translations = await response.json();
    window.translations = translations; // Guardar en la variable global
    return translations;
  } catch (error) {
    console.warn(`Could not load ${lang} translations. Defaulting to 'es'.`, error);
    // Si falla (ej. falta un archivo), cargar español como emergencia
    const response = await fetch(`i18n/es.json`);
    const translations = await response.json();
    window.translations = translations;
    return translations;
  }
}

// 2. Función para aplicar las traducciones a la página
function translatePage(translations) {
  // Buscar todos los elementos que tengan el atributo [data-i18n]
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n'); // Ej: "main_title"
    const translation = translations[key]; // Ej: "AXOLOTL FLY"

    if (translation) {
      // Aplicar la traducción
      // Manejar diferentes tipos de elementos
      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = translation; // Para placeholders
      } else {
        element.textContent = translation; // Para todo lo demás (h1, button, label)
      }
    } else {
      // Si no se encuentra una clave, mostrar la clave para depurar
      element.textContent = `[${key}]`;
    }
  });
}

// 3. Función principal que se ejecuta en CADA página
async function initializeI18n() {
  // Obtener el idioma guardado (default: 'es')
  const lang = localStorage.getItem('language') || 'es';

  // Cargar las traducciones
  const translations = await loadTranslations(lang);
  
  // Aplicar las traducciones a los elementos [data-i18n]
  translatePage(translations);
}

// Ejecutar todo cuando la página termine de cargar
document.addEventListener('DOMContentLoaded', initializeI18n);