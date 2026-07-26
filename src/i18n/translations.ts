// Multi-language support for WellFit Community
// Supporting English, Spanish, and Vietnamese for Houston's diverse population

export type Language = 'en' | 'es' | 'vi';

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
    back: string;
    loading: string;
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
  // Dashboard
  dashboard: {
    welcome: string;
    welcomeSubtitle: string;
    dailyCheckIn: string;
    checkInButtons: {
      feelingGreat: string;
      doctorAppt: string;
      inHospital: string;
      navigation: string;
      attendingEvent: string;
      notBest: string;
      fallen: string;
      lost: string;
    };
    checkInResponses: {
      feelingGreat: string;
      doctorAppt: string;
      inHospital: string;
      navigation: string;
      attendingEvent: string;
      notBest: string;
      fallen: string;
      lost: string;
    };
    communityMoments: string;
    sharePhoto: string;
    viewAllMoments: string;
    dashMeal: string;
    dashExplanation: string;
    learnMore: string;
    viewRecipe: string;
    dailyWordFind: string;
    playPuzzle: string;
    memoryLane: string;
    visitMemoryLane: string;
  };
  // Settings
  settings: {
    title: string;
    subtitle: string;
    backToDashboard: string;
    saveAllSettings: string;
    saving: string;
    saveSuccess: string;
    saveFailed: string;
    sections: {
      language: {
        title: string;
        description: string;
        selectLanguage: string;
        changesImmediate: string;
      };
      display: {
        title: string;
        description: string;
        textSize: string;
        small: string;
        medium: string;
        large: string;
        extraLarge: string;
        theme: string;
        themeDesc: string;
        themeLight: string;
        themeDark: string;
        themeAuto: string;
      };
      notifications: {
        title: string;
        description: string;
        allNotifications: string;
        allNotificationsDesc: string;
        careTeam: string;
        careTeamDesc: string;
        communityUpdates: string;
        communityUpdatesDesc: string;
        reminderTime: string;
      };
      emergency: {
        title: string;
        description: string;
        contactName: string;
        contactNamePlaceholder: string;
        contactPhone: string;
        contactPhonePlaceholder: string;
      };
      personal: {
        title: string;
        description: string;
        preferredName: string;
        preferredNamePlaceholder: string;
        timezone: string;
      };
      account: {
        title: string;
        description: string;
        passwordSecurity: string;
        passwordSecurityDesc: string;
        changePassword: string;
        accountInfo: string;
        email: string;
        accountCreated: string;
        needHelp: string;
        needHelpDesc: string;
        callSupport: string;
        viewHelpCenter: string;
      };
    };
    footer: {
      questionsAboutSettings: string;
      hoursOfOperation: string;
    };
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
      back: 'Back',
      loading: 'Loading...',
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
    dashboard: {
      welcome: 'Welcome to Your Community',
      welcomeSubtitle: "Let's check in today",
      dailyCheckIn: 'Daily Check-In',
      checkInButtons: {
        feelingGreat: 'Feeling Great Today',
        doctorAppt: 'I have a Dr. Appt today',
        inHospital: 'In the hospital',
        navigation: 'Need Healthcare Navigation Assistance',
        attendingEvent: 'Attending the event today',
        notBest: 'I am not feeling my best today',
        fallen: 'Fallen down & injured',
        lost: 'I am lost',
      },
      checkInResponses: {
        feelingGreat: 'Awesome! Have a great day!',
        doctorAppt: "Don't forget to show your doctor your progress and have a great visit!",
        inHospital: 'We will follow up with you in a few days. Get well soon!',
        navigation: 'Sent the nurse a message',
        attendingEvent: "We can't wait to see you there!",
        notBest: 'Do you need to speak to someone?',
        fallen: 'CALL 911',
        lost: 'Call emergency contact',
      },
      communityMoments: '🌟 Community Moments',
      sharePhoto: '📸 Share a Photo',
      viewAllMoments: '👥 View All Moments',
      dashMeal: '🍽️ DASH Meal of the Day',
      dashExplanation: 'DASH = Dietary Approaches to Stop Hypertension',
      learnMore: 'Learn more about DASH research →',
      viewRecipe: '🍳 View Today\'s Recipe',
      dailyWordFind: 'Daily Word Find',
      playPuzzle: '🧩 Play Today\'s Puzzle',
      memoryLane: 'Memory Lane',
      visitMemoryLane: '🎭 Visit Memory Lane',
    },
    settings: {
      title: '⚙️ Your Settings',
      subtitle: 'Customize your WellFit Community experience',
      backToDashboard: 'Back to Dashboard',
      saveAllSettings: 'Save All Settings',
      saving: 'Saving...',
      saveSuccess: 'Settings saved successfully! 🎉',
      saveFailed: 'Failed to save settings. Please try again.',
      sections: {
        language: {
          title: '🌐 Language / Idioma',
          description: 'Choose your preferred language',
          selectLanguage: '🌍 Select your preferred language / Seleccione su idioma preferido',
          changesImmediate: 'The app will display in your chosen language. Changes take effect immediately.',
        },
        display: {
          title: '👁️ Display Settings',
          description: 'Make the app easier to see and use',
          textSize: 'Text Size',
          small: 'Small',
          medium: 'Medium',
          large: 'Large',
          extraLarge: 'Extra Large',
          theme: 'Appearance',
          themeDesc: 'Choose light or dark colors, or match your device',
          themeLight: 'Light',
          themeDark: 'Dark',
          themeAuto: 'Match Device',
        },
        notifications: {
          title: '🔔 Notification Preferences',
          description: 'Choose what notifications you want to receive',
          allNotifications: 'All Notifications',
          allNotificationsDesc: 'Enable or disable all notifications',
          careTeam: 'Care Team Messages',
          careTeamDesc: 'Messages from your care team',
          communityUpdates: 'Community Updates',
          communityUpdatesDesc: 'New photos and community events',
          reminderTime: 'Daily Check-in Reminder Time',
        },
        emergency: {
          title: '🚨 Emergency Contacts',
          description: 'Update your emergency contact information',
          contactName: 'Emergency Contact Name',
          contactNamePlaceholder: 'Full name of your emergency contact',
          contactPhone: 'Emergency Contact Phone',
          contactPhonePlaceholder: '(555) 123-4567',
        },
        personal: {
          title: '👤 Personal Information',
          description: 'Your name and preferences',
          preferredName: 'What would you like us to call you?',
          preferredNamePlaceholder: 'Your preferred name',
          timezone: 'Time Zone',
        },
        account: {
          title: '🔐 Account Security',
          description: 'Password and security settings',
          passwordSecurity: 'Password Security',
          passwordSecurityDesc: 'Keep your account secure by using a strong password and changing it regularly.',
          changePassword: '🔒 Change Password',
          accountInfo: 'Account Information',
          email: 'Email:',
          accountCreated: 'Account Created:',
          needHelp: '⚠️ Need Help?',
          needHelpDesc: "If you're having trouble with your account or need to make changes, our support team is here to help.",
          callSupport: '📞 Call Support',
          viewHelpCenter: '📚 View Help Center',
        },
      },
      footer: {
        questionsAboutSettings: 'Questions about these settings? Call our support team at',
        hoursOfOperation: "We're here to help Monday through Friday, 8 AM to 6 PM",
      },
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
      back: 'Atrás',
      loading: 'Cargando...',
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
    dashboard: {
      welcome: 'Bienvenido a Tu Comunidad',
      welcomeSubtitle: 'Vamos a registrarnos hoy',
      dailyCheckIn: 'Registro Diario',
      checkInButtons: {
        feelingGreat: 'Me siento genial hoy',
        doctorAppt: 'Tengo cita con el doctor hoy',
        inHospital: 'En el hospital',
        navigation: 'Necesito asistencia de navegación médica',
        attendingEvent: 'Asistiré al evento hoy',
        notBest: 'No me siento bien hoy',
        fallen: 'Me caí y estoy herido',
        lost: 'Estoy perdido',
      },
      checkInResponses: {
        feelingGreat: '¡Excelente! ¡Que tengas un gran día!',
        doctorAppt: '¡No olvides mostrarle tu progreso al doctor y que tengas una gran visita!',
        inHospital: 'Te contactaremos en unos días. ¡Que te mejores pronto!',
        navigation: 'Mensaje enviado a la enfermera',
        attendingEvent: '¡No podemos esperar a verte allí!',
        notBest: '¿Necesitas hablar con alguien?',
        fallen: 'LLAMA AL 911',
        lost: 'Llama al contacto de emergencia',
      },
      communityMoments: '🌟 Momentos de la Comunidad',
      sharePhoto: '📸 Compartir una Foto',
      viewAllMoments: '👥 Ver Todos los Momentos',
      dashMeal: '🍽️ Comida DASH del Día',
      dashExplanation: 'DASH = Enfoques Dietéticos para Detener la Hipertensión',
      learnMore: 'Aprende más sobre la investigación DASH →',
      viewRecipe: '🍳 Ver Receta de Hoy',
      dailyWordFind: 'Sopa de Letras Diaria',
      playPuzzle: '🧩 Jugar el Rompecabezas de Hoy',
      memoryLane: 'Carril de la Memoria',
      visitMemoryLane: '🎭 Visitar Carril de la Memoria',
    },
    settings: {
      title: '⚙️ Tu Configuración',
      subtitle: 'Personaliza tu experiencia de WellFit Community',
      backToDashboard: 'Volver al Tablero',
      saveAllSettings: 'Guardar Toda la Configuración',
      saving: 'Guardando...',
      saveSuccess: '¡Configuración guardada exitosamente! 🎉',
      saveFailed: 'Error al guardar la configuración. Por favor, inténtalo de nuevo.',
      sections: {
        language: {
          title: '🌐 Language / Idioma',
          description: 'Elige tu idioma preferido',
          selectLanguage: '🌍 Select your preferred language / Seleccione su idioma preferido',
          changesImmediate: 'La aplicación se mostrará en el idioma que elijas. Los cambios se aplican inmediatamente.',
        },
        display: {
          title: '👁️ Configuración de Pantalla',
          description: 'Haz que la aplicación sea más fácil de ver y usar',
          textSize: 'Tamaño del Texto',
          small: 'Pequeño',
          medium: 'Mediano',
          large: 'Grande',
          extraLarge: 'Extra Grande',
          theme: 'Apariencia',
          themeDesc: 'Elige colores claros u oscuros, o iguala tu dispositivo',
          themeLight: 'Claro',
          themeDark: 'Oscuro',
          themeAuto: 'Igual que el Dispositivo',
        },
        notifications: {
          title: '🔔 Preferencias de Notificaciones',
          description: 'Elige qué notificaciones deseas recibir',
          allNotifications: 'Todas las Notificaciones',
          allNotificationsDesc: 'Activar o desactivar todas las notificaciones',
          careTeam: 'Mensajes del Equipo de Atención',
          careTeamDesc: 'Mensajes de tu equipo de atención',
          communityUpdates: 'Actualizaciones de la Comunidad',
          communityUpdatesDesc: 'Nuevas fotos y eventos comunitarios',
          reminderTime: 'Hora del Recordatorio de Registro Diario',
        },
        emergency: {
          title: '🚨 Contactos de Emergencia',
          description: 'Actualiza tu información de contacto de emergencia',
          contactName: 'Nombre del Contacto de Emergencia',
          contactNamePlaceholder: 'Nombre completo de tu contacto de emergencia',
          contactPhone: 'Teléfono del Contacto de Emergencia',
          contactPhonePlaceholder: '(555) 123-4567',
        },
        personal: {
          title: '👤 Información Personal',
          description: 'Tu nombre y preferencias',
          preferredName: '¿Cómo te gustaría que te llamemos?',
          preferredNamePlaceholder: 'Tu nombre preferido',
          timezone: 'Zona Horaria',
        },
        account: {
          title: '🔐 Seguridad de la Cuenta',
          description: 'Configuración de contraseña y seguridad',
          passwordSecurity: 'Seguridad de Contraseña',
          passwordSecurityDesc: 'Mantén tu cuenta segura usando una contraseña fuerte y cambiándola regularmente.',
          changePassword: '🔒 Cambiar Contraseña',
          accountInfo: 'Información de la Cuenta',
          email: 'Correo Electrónico:',
          accountCreated: 'Cuenta Creada:',
          needHelp: '⚠️ ¿Necesitas Ayuda?',
          needHelpDesc: 'Si tienes problemas con tu cuenta o necesitas hacer cambios, nuestro equipo de soporte está aquí para ayudarte.',
          callSupport: '📞 Llamar a Soporte',
          viewHelpCenter: '📚 Ver Centro de Ayuda',
        },
      },
      footer: {
        questionsAboutSettings: '¿Preguntas sobre esta configuración? Llama a nuestro equipo de soporte al',
        hoursOfOperation: 'Estamos aquí para ayudarte de lunes a viernes, de 8 AM a 6 PM',
      },
    },
  },
  vi: {
    nav: {
      home: '🏠 Trang Chủ',
      myHealth: '💊 Sức Khỏe Của Tôi',
      askNurse: '👩‍⚕️ Hỏi Y Tá',
      community: '👥 Cộng Đồng',
      more: '⋯ Thêm',
      selfReport: '📝 Báo Cáo Tự Nguyện',
      doctorsView: '🩺 Xem Bác Sĩ',
      memoryLane: '🧠 Hồi Ức',
      wordFind: '🔤 Tìm Từ',
      myInformation: '📋 Thông Tin Của Tôi',
      settings: '⚙️ Cài Đặt',
      visitWebsite: '🌐 Truy Cập Trang Web',
      logout: '🚪 Đăng Xuất',
    },
    actions: {
      submit: 'Gửi',
      cancel: 'Hủy',
      save: 'Lưu',
      delete: 'Xóa',
      edit: 'Chỉnh Sửa',
      close: 'Đóng',
      confirm: 'Xác Nhận',
      back: 'Quay Lại',
      loading: 'Đang Tải...',
    },
    health: {
      bloodPressure: 'Huyết Áp',
      heartRate: 'Nhịp Tim',
      bloodSugar: 'Đường Huyết',
      weight: 'Cân Nặng',
      mood: 'Tâm Trạng',
      symptoms: 'Triệu Chứng',
      medications: 'Thuốc Men',
    },
    community: {
      shareYourMoment: 'Chia Sẻ Khoảnh Khắc Của Bạn',
      uploadPhoto: 'Tải Ảnh Lên',
      caption: 'Chú Thích',
      post: 'Đăng',
    },
    dashboard: {
      welcome: 'Chào Mừng Đến Cộng Đồng Của Bạn',
      welcomeSubtitle: 'Hãy kiểm tra sức khỏe hôm nay',
      dailyCheckIn: 'Kiểm Tra Hàng Ngày',
      checkInButtons: {
        feelingGreat: 'Cảm Thấy Tuyệt Vời Hôm Nay',
        doctorAppt: 'Tôi có cuộc hẹn với Bác sĩ hôm nay',
        inHospital: 'Trong bệnh viện',
        navigation: 'Cần Hỗ Trợ Điều Hướng Y Tế',
        attendingEvent: 'Tham dự sự kiện hôm nay',
        notBest: 'Tôi không cảm thấy tốt nhất hôm nay',
        fallen: 'Bị ngã và bị thương',
        lost: 'Tôi bị lạc',
      },
      checkInResponses: {
        feelingGreat: 'Tuyệt vời! Chúc bạn một ngày tốt lành!',
        doctorAppt: 'Đừng quên cho bác sĩ xem tiến trình của bạn và chúc bạn một chuyến khám tốt đẹp!',
        inHospital: 'Chúng tôi sẽ theo dõi bạn trong vài ngày tới. Mau bình phục!',
        navigation: 'Đã gửi tin nhắn cho y tá',
        attendingEvent: 'Chúng tôi rất mong được gặp bạn ở đó!',
        notBest: 'Bạn có cần nói chuyện với ai không?',
        fallen: 'GỌI 911',
        lost: 'Gọi cho người liên hệ khẩn cấp',
      },
      communityMoments: '🌟 Khoảnh Khắc Cộng Đồng',
      sharePhoto: '📸 Chia Sẻ Ảnh',
      viewAllMoments: '👥 Xem Tất Cả Khoảnh Khắc',
      dashMeal: '🍽️ Bữa Ăn DASH Hôm Nay',
      dashExplanation: 'DASH = Cách Tiếp Cận Chế Độ Ăn Để Ngăn Chặn Cao Huyết Áp',
      learnMore: 'Tìm hiểu thêm về nghiên cứu DASH →',
      viewRecipe: '🍳 Xem Công Thức Hôm Nay',
      dailyWordFind: 'Tìm Từ Hàng Ngày',
      playPuzzle: '🧩 Chơi Câu Đố Hôm Nay',
      memoryLane: 'Hồi Ức',
      visitMemoryLane: '🎭 Thăm Hồi Ức',
    },
    settings: {
      title: '⚙️ Cài Đặt Của Bạn',
      subtitle: 'Tùy chỉnh trải nghiệm WellFit Community của bạn',
      backToDashboard: 'Quay Lại Trang Chủ',
      saveAllSettings: 'Lưu Tất Cả Cài Đặt',
      saving: 'Đang Lưu...',
      saveSuccess: 'Cài đặt đã được lưu thành công! 🎉',
      saveFailed: 'Không thể lưu cài đặt. Vui lòng thử lại.',
      sections: {
        language: {
          title: '🌐 Ngôn Ngữ / Language',
          description: 'Chọn ngôn ngữ ưa thích của bạn',
          selectLanguage: '🌍 Chọn ngôn ngữ ưa thích / Select your preferred language / Seleccione su idioma preferido',
          changesImmediate: 'Ứng dụng sẽ hiển thị bằng ngôn ngữ bạn chọn. Thay đổi có hiệu lực ngay lập tức.',
        },
        display: {
          title: '👁️ Cài Đặt Hiển Thị',
          description: 'Làm cho ứng dụng dễ nhìn và sử dụng hơn',
          textSize: 'Kích Thước Chữ',
          small: 'Nhỏ',
          medium: 'Trung Bình',
          large: 'Lớn',
          extraLarge: 'Rất Lớn',
          theme: 'Giao Diện',
          themeDesc: 'Chọn màu sáng hoặc tối, hoặc theo thiết bị của bạn',
          themeLight: 'Sáng',
          themeDark: 'Tối',
          themeAuto: 'Theo Thiết Bị',
        },
        notifications: {
          title: '🔔 Tùy Chọn Thông Báo',
          description: 'Chọn thông báo bạn muốn nhận',
          allNotifications: 'Tất Cả Thông Báo',
          allNotificationsDesc: 'Bật hoặc tắt tất cả thông báo',
          careTeam: 'Tin Nhắn Từ Đội Chăm Sóc',
          careTeamDesc: 'Tin nhắn từ đội chăm sóc của bạn',
          communityUpdates: 'Cập Nhật Cộng Đồng',
          communityUpdatesDesc: 'Ảnh mới và sự kiện cộng đồng',
          reminderTime: 'Thời Gian Nhắc Nhở Kiểm Tra Hàng Ngày',
        },
        emergency: {
          title: '🚨 Liên Hệ Khẩn Cấp',
          description: 'Cập nhật thông tin liên hệ khẩn cấp của bạn',
          contactName: 'Tên Người Liên Hệ Khẩn Cấp',
          contactNamePlaceholder: 'Họ tên đầy đủ của người liên hệ khẩn cấp',
          contactPhone: 'Số Điện Thoại Khẩn Cấp',
          contactPhonePlaceholder: '(555) 123-4567',
        },
        personal: {
          title: '👤 Thông Tin Cá Nhân',
          description: 'Tên và sở thích của bạn',
          preferredName: 'Bạn muốn chúng tôi gọi bạn là gì?',
          preferredNamePlaceholder: 'Tên bạn ưa thích',
          timezone: 'Múi Giờ',
        },
        account: {
          title: '🔐 Bảo Mật Tài Khoản',
          description: 'Cài đặt mật khẩu và bảo mật',
          passwordSecurity: 'Bảo Mật Mật Khẩu',
          passwordSecurityDesc: 'Giữ tài khoản của bạn an toàn bằng cách sử dụng mật khẩu mạnh và thay đổi thường xuyên.',
          changePassword: '🔒 Đổi Mật Khẩu',
          accountInfo: 'Thông Tin Tài Khoản',
          email: 'Email:',
          accountCreated: 'Tài Khoản Được Tạo:',
          needHelp: '⚠️ Cần Trợ Giúp?',
          needHelpDesc: 'Nếu bạn gặp khó khăn với tài khoản của mình hoặc cần thực hiện thay đổi, đội ngũ hỗ trợ của chúng tôi sẵn sàng giúp đỡ.',
          callSupport: '📞 Gọi Hỗ Trợ',
          viewHelpCenter: '📚 Xem Trung Tâm Trợ Giúp',
        },
      },
      footer: {
        questionsAboutSettings: 'Có câu hỏi về cài đặt này? Gọi đội hỗ trợ của chúng tôi tại',
        hoursOfOperation: 'Chúng tôi sẵn sàng giúp đỡ từ Thứ Hai đến Thứ Sáu, 8 giờ sáng đến 6 giờ chiều',
      },
    },
  },
};

// Get browser language or default to English
export function getBrowserLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('es')) {
    return 'es';
  }
  if (browserLang.startsWith('vi')) {
    return 'vi';
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