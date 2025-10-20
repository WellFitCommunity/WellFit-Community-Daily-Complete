// ============================================================================
// Resilience Hub Multilingual Support
// ============================================================================
// Purpose: Translations for Emotional Resilience Hub (NurseOS)
// Languages: English (en), Spanish (es)
// Target: 33% Spanish-speaking nurses
// ============================================================================

export type Language = 'en' | 'es';

export interface ResilienceHubTranslations {
  // Dashboard
  dashboard: {
    title: string;
    subtitle: string;
    riskBadge: {
      unknown: string;
      low: string;
      moderate: string;
      high: string;
      critical: string;
    };
    riskMessages: {
      unknown: string;
      low: string;
      moderate: string;
      high: string;
      critical: string;
    };
    takeAssessment: string;
    interventionAlert: {
      title: string;
      message: string;
      call988: string;
      viewResources: string;
    };
    checkinPrompt: {
      title: string;
      message: string;
      button: string;
    };
    stats: {
      stressTrend: string;
      trainingModules: string;
      supportCircles: string;
      completed: string;
      inProgress: string;
      circles: string;
      notInCircles: string;
    };
    quickActions: {
      title: string;
      dailyCheckin: string;
      dailyCheckinDesc: string;
      burnoutAssessment: string;
      burnoutAssessmentDesc: string;
      viewTrends: string;
      viewTrendsDesc: string;
      trainingModules: string;
      trainingModulesDesc: string;
      resourceLibrary: string;
      resourceLibraryDesc: string;
    };
    recentCheckins: string;
    stress: string;
    energy: string;
    mood: string;
  };

  // Burnout Assessment
  assessment: {
    title: string;
    instructions: {
      whatMeasures: string;
      timeRequired: string;
      privacy: string;
      instructionsTitle: string;
      steps: string[];
      crisisSupport: string;
    };
    startButton: string;
    cancelButton: string;
    progress: string;
    questionsAnswered: string;
    previous: string;
    next: string;
    submit: string;
    submitting: string;
    pleaseAnswer: string;
    dimensions: {
      emotionalExhaustion: string;
      depersonalization: string;
      personalAccomplishment: string;
    };
    frequencyLabels: {
      never: string;
      fewTimesYear: string;
      onceMonth: string;
      fewTimesMonth: string;
      onceWeek: string;
      fewTimesWeek: string;
      everyday: string;
    };
  };

  // Training Modules
  modules: {
    title: string;
    subtitle: string;
    categories: {
      all: string;
      mindfulness: string;
      stressManagement: string;
      communication: string;
      selfCare: string;
      boundarySetting: string;
    };
    noModules: string;
    startModule: string;
    reviewModule: string;
    completed: string;
    inProgress: string;
    minutes: string;
    evidenceBased: string;
    helpful: string;
    yesHelpful: string;
    notHelpful: string;
    closeButton: string;
  };

  // Resource Library
  resources: {
    title: string;
    subtitle: string;
    emergencyBanner: {
      title: string;
      message: string;
      call988: string;
      text988: string;
      chatOnline: string;
    };
    filters: {
      resourceType: string;
      category: string;
      allTypes: string;
      allCategories: string;
    };
    types: {
      hotline: string;
      app: string;
      article: string;
      video: string;
      podcast: string;
      book: string;
      worksheet: string;
    };
    categories: {
      crisisSupport: string;
      mindfulness: string;
      stressManagement: string;
      selfCare: string;
      communication: string;
    };
    featured: string;
    allResources: string;
    noResources: string;
    clearFilters: string;
    callNow: string;
    viewResource: string;
    views: string;
    resourcesAvailable: string;
    closeButton: string;
  };

  // Daily Check-in
  checkin: {
    title: string;
    subtitle: string;
    workSetting: string;
    stressLevel: string;
    energyLevel: string;
    moodRating: string;
    patientsContacted: string;
    difficultCalls: string;
    overtimeHours: string;
    feltOverwhelmed: string;
    feltSupported: string;
    missedBreak: string;
    notes: string;
    submitButton: string;
    cancelButton: string;
    successMessage: string;
    errorMessage: string;
  };

  // Common
  common: {
    loading: string;
    error: string;
    retry: string;
    close: string;
    yes: string;
    no: string;
    save: string;
    cancel: string;
  };
}

// English translations
const en: ResilienceHubTranslations = {
  dashboard: {
    title: 'Emotional Resilience Hub',
    subtitle: 'Your wellness checkpoint — because you can\'t pour from an empty cup.',
    riskBadge: {
      unknown: 'Not Assessed',
      low: 'Low Risk',
      moderate: 'Moderate Risk',
      high: 'High Risk',
      critical: 'Critical Risk',
    },
    riskMessages: {
      unknown: 'Take a burnout assessment to get your risk level.',
      low: 'Great! Keep up the self-care practices.',
      moderate: 'Consider increasing self-care activities.',
      high: 'High stress detected. Please prioritize self-care.',
      critical: '⚠️ Critical level. Please reach out for support immediately.',
    },
    takeAssessment: 'Take Assessment Now (5 min)',
    interventionAlert: {
      title: 'Wellness Check Recommended',
      message: 'Your recent stress levels or burnout scores suggest you may benefit from additional support.',
      call988: 'Call 988 Lifeline',
      viewResources: 'View Resources',
    },
    checkinPrompt: {
      title: 'Haven\'t checked in today?',
      message: 'Take 60 seconds to log how you\'re feeling. It helps track your wellness trends.',
      button: 'Quick Check-In',
    },
    stats: {
      stressTrend: 'Stress Trend (7 days)',
      trainingModules: 'Training Modules',
      supportCircles: 'Support Circles',
      completed: 'completed',
      inProgress: 'in progress',
      circles: 'circles',
      notInCircles: 'Not in any circles yet',
    },
    quickActions: {
      title: 'Quick Actions',
      dailyCheckin: 'Daily Check-In',
      dailyCheckinDesc: 'Log your wellness',
      burnoutAssessment: 'Burnout Assessment',
      burnoutAssessmentDesc: 'MBI questionnaire',
      viewTrends: 'View Trends',
      viewTrendsDesc: '30-day overview',
      trainingModules: 'Training Modules',
      trainingModulesDesc: 'Evidence-based',
      resourceLibrary: 'Resource Library',
      resourceLibraryDesc: 'Apps, articles, hotlines',
    },
    recentCheckins: 'Recent Check-Ins (Last 7 Days)',
    stress: 'Stress',
    energy: 'Energy',
    mood: 'Mood',
  },

  assessment: {
    title: 'Burnout Assessment (MBI)',
    instructions: {
      whatMeasures: 'This assessment uses the Maslach Burnout Inventory (MBI), the most widely used tool for measuring burnout in healthcare professionals. It measures three dimensions of burnout - Emotional Exhaustion, Depersonalization (cynicism), and reduced Personal Accomplishment.',
      timeRequired: 'Time required: 5-7 minutes (22 questions)',
      privacy: 'Privacy: Your responses are confidential. Only you and administrators (for intervention purposes) can see your individual results.',
      instructionsTitle: 'Instructions:',
      steps: [
        'Read each statement carefully',
        'Select how often you feel this way about your work',
        'Answer honestly - there are no right or wrong answers',
        'Think about the past 6 months, not just today',
        'You can go back and change answers before submitting',
      ],
      crisisSupport: 'Crisis Support: If you are experiencing thoughts of self-harm, please call 988 (Suicide & Crisis Lifeline) immediately. This assessment is for burnout screening only, not crisis intervention.',
    },
    startButton: 'Start Assessment',
    cancelButton: 'Cancel',
    progress: 'Page',
    questionsAnswered: 'questions answered',
    previous: 'Previous',
    next: 'Next',
    submit: 'Submit Assessment',
    submitting: 'Submitting...',
    pleaseAnswer: 'Please answer all questions on this page',
    dimensions: {
      emotionalExhaustion: 'Emotional Exhaustion',
      depersonalization: 'Depersonalization',
      personalAccomplishment: 'Personal Accomplishment',
    },
    frequencyLabels: {
      never: 'Never',
      fewTimesYear: 'A few times a year or less',
      onceMonth: 'Once a month or less',
      fewTimesMonth: 'A few times a month',
      onceWeek: 'Once a week',
      fewTimesWeek: 'A few times a week',
      everyday: 'Every day',
    },
  },

  modules: {
    title: 'Resilience Training Library',
    subtitle: 'Evidence-based modules to prevent burnout',
    categories: {
      all: 'All Modules',
      mindfulness: 'Mindfulness',
      stressManagement: 'Stress Management',
      communication: 'Communication',
      selfCare: 'Self-Care',
      boundarySetting: 'Boundary Setting',
    },
    noModules: 'No modules found in this category.',
    startModule: 'Start Module',
    reviewModule: 'Review Module',
    completed: 'You completed this module',
    inProgress: 'In Progress',
    minutes: 'min',
    evidenceBased: 'Evidence-Based',
    helpful: 'Did you find this module helpful?',
    yesHelpful: 'Yes, this helped!',
    notHelpful: 'No, not really',
    closeButton: 'Close',
  },

  resources: {
    title: 'Resource Library',
    subtitle: 'Crisis hotlines, apps, articles, and support resources',
    emergencyBanner: {
      title: 'Crisis Support - Available 24/7',
      message: 'If you\'re experiencing thoughts of self-harm or suicide, help is available right now.',
      call988: 'Call 988 Suicide & Crisis Lifeline',
      text988: 'Text 988',
      chatOnline: 'Chat Online',
    },
    filters: {
      resourceType: 'Resource Type',
      category: 'Category',
      allTypes: 'All Types',
      allCategories: 'All Categories',
    },
    types: {
      hotline: 'Hotline',
      app: 'App',
      article: 'Article',
      video: 'Video',
      podcast: 'Podcast',
      book: 'Book',
      worksheet: 'Worksheet',
    },
    categories: {
      crisisSupport: 'Crisis Support',
      mindfulness: 'Mindfulness',
      stressManagement: 'Stress Management',
      selfCare: 'Self-Care',
      communication: 'Communication',
    },
    featured: 'Featured Resources',
    allResources: 'All Resources',
    noResources: 'No resources found for this filter combination.',
    clearFilters: 'Clear Filters',
    callNow: 'Call Now →',
    viewResource: 'View Resource →',
    views: 'views',
    resourcesAvailable: 'resources available',
    closeButton: 'Close',
  },

  checkin: {
    title: 'Daily Check-In',
    subtitle: 'How are you feeling today?',
    workSetting: 'Work Setting',
    stressLevel: 'Stress Level',
    energyLevel: 'Energy Level',
    moodRating: 'Mood Rating',
    patientsContacted: 'Patients Contacted Today',
    difficultCalls: 'Difficult Patient Calls',
    overtimeHours: 'Overtime Hours',
    feltOverwhelmed: 'Felt Overwhelmed',
    feltSupported: 'Felt Supported by Team',
    missedBreak: 'Missed Break',
    notes: 'Notes (Optional)',
    submitButton: 'Submit Check-In',
    cancelButton: 'Cancel',
    successMessage: 'Check-in recorded successfully!',
    errorMessage: 'Failed to record check-in. Please try again.',
  },

  common: {
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    save: 'Save',
    cancel: 'Cancel',
  },
};

// Spanish translations (ES)
const es: ResilienceHubTranslations = {
  dashboard: {
    title: 'Centro de Resiliencia Emocional',
    subtitle: 'Tu punto de control de bienestar — porque no puedes dar de una taza vacía.',
    riskBadge: {
      unknown: 'No Evaluado',
      low: 'Riesgo Bajo',
      moderate: 'Riesgo Moderado',
      high: 'Riesgo Alto',
      critical: 'Riesgo Crítico',
    },
    riskMessages: {
      unknown: 'Realiza una evaluación de agotamiento para conocer tu nivel de riesgo.',
      low: '¡Excelente! Continúa con tus prácticas de autocuidado.',
      moderate: 'Considera aumentar las actividades de autocuidado.',
      high: 'Alto estrés detectado. Por favor prioriza el autocuidado.',
      critical: '⚠️ Nivel crítico. Por favor busca apoyo inmediatamente.',
    },
    takeAssessment: 'Realizar Evaluación Ahora (5 min)',
    interventionAlert: {
      title: 'Revisión de Bienestar Recomendada',
      message: 'Tus niveles recientes de estrés o puntajes de agotamiento sugieren que podrías beneficiarte de apoyo adicional.',
      call988: 'Llamar a 988 Línea de Vida',
      viewResources: 'Ver Recursos',
    },
    checkinPrompt: {
      title: '¿No te has registrado hoy?',
      message: 'Toma 60 segundos para registrar cómo te sientes. Ayuda a rastrear tus tendencias de bienestar.',
      button: 'Registro Rápido',
    },
    stats: {
      stressTrend: 'Tendencia de Estrés (7 días)',
      trainingModules: 'Módulos de Capacitación',
      supportCircles: 'Círculos de Apoyo',
      completed: 'completados',
      inProgress: 'en progreso',
      circles: 'círculos',
      notInCircles: 'Aún no estás en ningún círculo',
    },
    quickActions: {
      title: 'Acciones Rápidas',
      dailyCheckin: 'Registro Diario',
      dailyCheckinDesc: 'Registra tu bienestar',
      burnoutAssessment: 'Evaluación de Agotamiento',
      burnoutAssessmentDesc: 'Cuestionario MBI',
      viewTrends: 'Ver Tendencias',
      viewTrendsDesc: 'Resumen de 30 días',
      trainingModules: 'Módulos de Capacitación',
      trainingModulesDesc: 'Basados en evidencia',
      resourceLibrary: 'Biblioteca de Recursos',
      resourceLibraryDesc: 'Apps, artículos, líneas directas',
    },
    recentCheckins: 'Registros Recientes (Últimos 7 Días)',
    stress: 'Estrés',
    energy: 'Energía',
    mood: 'Estado de Ánimo',
  },

  assessment: {
    title: 'Evaluación de Agotamiento (MBI)',
    instructions: {
      whatMeasures: 'Esta evaluación utiliza el Inventario de Agotamiento de Maslach (MBI), la herramienta más utilizada para medir el agotamiento en profesionales de la salud. Mide tres dimensiones del agotamiento: Agotamiento Emocional, Despersonalización (cinismo) y Reducción del Logro Personal.',
      timeRequired: 'Tiempo requerido: 5-7 minutos (22 preguntas)',
      privacy: 'Privacidad: Tus respuestas son confidenciales. Solo tú y los administradores (para fines de intervención) pueden ver tus resultados individuales.',
      instructionsTitle: 'Instrucciones:',
      steps: [
        'Lee cada declaración cuidadosamente',
        'Selecciona con qué frecuencia te sientes así sobre tu trabajo',
        'Responde honestamente - no hay respuestas correctas o incorrectas',
        'Piensa en los últimos 6 meses, no solo en hoy',
        'Puedes volver y cambiar respuestas antes de enviar',
      ],
      crisisSupport: 'Apoyo en Crisis: Si estás experimentando pensamientos de autolesión, por favor llama al 988 (Línea de Vida para Suicidio y Crisis) inmediatamente. Esta evaluación es solo para detección de agotamiento, no para intervención en crisis.',
    },
    startButton: 'Comenzar Evaluación',
    cancelButton: 'Cancelar',
    progress: 'Página',
    questionsAnswered: 'preguntas respondidas',
    previous: 'Anterior',
    next: 'Siguiente',
    submit: 'Enviar Evaluación',
    submitting: 'Enviando...',
    pleaseAnswer: 'Por favor responde todas las preguntas en esta página',
    dimensions: {
      emotionalExhaustion: 'Agotamiento Emocional',
      depersonalization: 'Despersonalización',
      personalAccomplishment: 'Logro Personal',
    },
    frequencyLabels: {
      never: 'Nunca',
      fewTimesYear: 'Pocas veces al año o menos',
      onceMonth: 'Una vez al mes o menos',
      fewTimesMonth: 'Pocas veces al mes',
      onceWeek: 'Una vez a la semana',
      fewTimesWeek: 'Pocas veces a la semana',
      everyday: 'Todos los días',
    },
  },

  modules: {
    title: 'Biblioteca de Capacitación en Resiliencia',
    subtitle: 'Módulos basados en evidencia para prevenir el agotamiento',
    categories: {
      all: 'Todos los Módulos',
      mindfulness: 'Atención Plena',
      stressManagement: 'Manejo del Estrés',
      communication: 'Comunicación',
      selfCare: 'Autocuidado',
      boundarySetting: 'Establecimiento de Límites',
    },
    noModules: 'No se encontraron módulos en esta categoría.',
    startModule: 'Comenzar Módulo',
    reviewModule: 'Revisar Módulo',
    completed: 'Completaste este módulo',
    inProgress: 'En Progreso',
    minutes: 'min',
    evidenceBased: 'Basado en Evidencia',
    helpful: '¿Te fue útil este módulo?',
    yesHelpful: '¡Sí, me ayudó!',
    notHelpful: 'No, no mucho',
    closeButton: 'Cerrar',
  },

  resources: {
    title: 'Biblioteca de Recursos',
    subtitle: 'Líneas directas de crisis, apps, artículos y recursos de apoyo',
    emergencyBanner: {
      title: 'Apoyo en Crisis - Disponible 24/7',
      message: 'Si estás experimentando pensamientos de autolesión o suicidio, la ayuda está disponible ahora mismo.',
      call988: 'Llamar a 988 Línea de Vida para Suicidio y Crisis',
      text988: 'Enviar texto a 988',
      chatOnline: 'Chat en Línea',
    },
    filters: {
      resourceType: 'Tipo de Recurso',
      category: 'Categoría',
      allTypes: 'Todos los Tipos',
      allCategories: 'Todas las Categorías',
    },
    types: {
      hotline: 'Línea Directa',
      app: 'Aplicación',
      article: 'Artículo',
      video: 'Video',
      podcast: 'Podcast',
      book: 'Libro',
      worksheet: 'Hoja de Trabajo',
    },
    categories: {
      crisisSupport: 'Apoyo en Crisis',
      mindfulness: 'Atención Plena',
      stressManagement: 'Manejo del Estrés',
      selfCare: 'Autocuidado',
      communication: 'Comunicación',
    },
    featured: 'Recursos Destacados',
    allResources: 'Todos los Recursos',
    noResources: 'No se encontraron recursos para esta combinación de filtros.',
    clearFilters: 'Limpiar Filtros',
    callNow: 'Llamar Ahora →',
    viewResource: 'Ver Recurso →',
    views: 'vistas',
    resourcesAvailable: 'recursos disponibles',
    closeButton: 'Cerrar',
  },

  checkin: {
    title: 'Registro Diario',
    subtitle: '¿Cómo te sientes hoy?',
    workSetting: 'Lugar de Trabajo',
    stressLevel: 'Nivel de Estrés',
    energyLevel: 'Nivel de Energía',
    moodRating: 'Estado de Ánimo',
    patientsContacted: 'Pacientes Contactados Hoy',
    difficultCalls: 'Llamadas Difíciles de Pacientes',
    overtimeHours: 'Horas Extras',
    feltOverwhelmed: 'Me Sentí Abrumado/a',
    feltSupported: 'Me Sentí Apoyado/a por el Equipo',
    missedBreak: 'Perdí mi Descanso',
    notes: 'Notas (Opcional)',
    submitButton: 'Enviar Registro',
    cancelButton: 'Cancelar',
    successMessage: '¡Registro guardado exitosamente!',
    errorMessage: 'Error al guardar el registro. Por favor intenta de nuevo.',
  },

  common: {
    loading: 'Cargando...',
    error: 'Error',
    retry: 'Reintentar',
    close: 'Cerrar',
    yes: 'Sí',
    no: 'No',
    save: 'Guardar',
    cancel: 'Cancelar',
  },
};

export const resilienceHubTranslations: Record<Language, ResilienceHubTranslations> = {
  en,
  es,
};

// Helper function to get browser language
export function getBrowserLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('es')) return 'es';
  return 'en';
}

// Hook for easy access
export function useResilienceHubTranslations(language: Language = 'en'): ResilienceHubTranslations {
  return resilienceHubTranslations[language];
}
