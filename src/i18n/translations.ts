// Multi-language support for WellFit Community
// Starting with English and Spanish for Houston's diverse population

export type Language = 'en' | 'es';

export interface Translations {
  // Navigation
  nav: {
    home: string;
    myHealth: string;
    askNurse: string;
    community: string;
    more: string;
    selfReport: string;
    doctorsView: string;
    memoryLane: string;
    wordFind: string;
    myInformation: string;
    settings: string;
    visitWebsite: string;
    logout: string;
  };
  // Common actions
  actions: {
    submit: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    confirm: string;
  };
  // Health-related
  health: {
    bloodPressure: string;
    heartRate: string;
    bloodSugar: string;
    weight: string;
    mood: string;
    symptoms: string;
    medications: string;
  };
  // Community
  community: {
    shareYourMoment: string;
    uploadPhoto: string;
    caption: string;
    post: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      home: '🏠 Home',
      myHealth: '💊 My Health',
      askNurse: '👩‍⚕️ Ask Nurse',
      community: '👥 Community',
      more: '⋯ More',
      selfReport: '📝 Self-Report',
      doctorsView: '🩺 Doctor\'s View',
      memoryLane: '🧠 Memory Lane',
      wordFind: '🔤 Word Find',
      myInformation: '📋 My Information',
      settings: '⚙️ Settings',
      visitWebsite: '🌐 Visit Website',
      logout: '🚪 Log Out',
    },
    actions: {
      submit: 'Submit',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      confirm: 'Confirm',
    },
    health: {
      bloodPressure: 'Blood Pressure',
      heartRate: 'Heart Rate',
      bloodSugar: 'Blood Sugar',
      weight: 'Weight',
      mood: 'Mood',
      symptoms: 'Symptoms',
      medications: 'Medications',
    },
    community: {
      shareYourMoment: 'Share Your Moment',
      uploadPhoto: 'Upload Photo',
      caption: 'Caption',
      post: 'Post',
    },
  },
  es: {
    nav: {
      home: '🏠 Inicio',
      myHealth: '💊 Mi Salud',
      askNurse: '👩‍⚕️ Preguntar a Enfermera',
      community: '👥 Comunidad',
      more: '⋯ Más',
      selfReport: '📝 Auto-Reporte',
      doctorsView: '🩺 Vista del Doctor',
      memoryLane: '🧠 Carril de Memoria',
      wordFind: '🔤 Buscar Palabras',
      myInformation: '📋 Mi Información',
      settings: '⚙️ Configuración',
      visitWebsite: '🌐 Visitar Sitio Web',
      logout: '🚪 Cerrar Sesión',
    },
    actions: {
      submit: 'Enviar',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      confirm: 'Confirmar',
    },
    health: {
      bloodPressure: 'Presión Arterial',
      heartRate: 'Frecuencia Cardíaca',
      bloodSugar: 'Azúcar en Sangre',
      weight: 'Peso',
      mood: 'Estado de Ánimo',
      symptoms: 'Síntomas',
      medications: 'Medicamentos',
    },
    community: {
      shareYourMoment: 'Comparte Tu Momento',
      uploadPhoto: 'Subir Foto',
      caption: 'Descripción',
      post: 'Publicar',
    },
  },
};

// Get browser language or default to English
export function getBrowserLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('es')) {
    return 'es';
  }
  return 'en';
}

// Simple hook for translations
export function useTranslation(lang?: Language) {
  const language = lang || getBrowserLanguage();
  return {
    t: translations[language],
    language,
  };
}