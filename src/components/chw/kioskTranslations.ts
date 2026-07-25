/**
 * kioskTranslations - UI strings for the public CHW kiosk check-in flow
 *
 * Purpose: senior-facing translations (en/es/vi) for KioskCheckIn.
 * Used by: src/components/chw/KioskCheckIn.tsx
 */

export type KioskLanguage = 'en' | 'es' | 'vi';

export interface KioskStrings {
  welcome: string;
  selectLanguage: string;
  english: string;
  spanish: string;
  vietnamese: string;
  patientLookup: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  findMe: string;
  privacy: string;
  privacyText: string;
  agree: string;
  cancel: string;
  back: string;
  checking: string;
  notFound: string;
  tooManyAttempts: string;
  kioskUnavailable: string;
  verifyTitle: string;
  codeSentTo: string;
  enterCode: string;
  enterPhoneLast4: string;
  phoneLast4Help: string;
  checkIn: string;
  verifyFailed: string;
  seeStaffTitle: string;
  seeStaffText: string;
  startOver: string;
  successTitle: string;
  successText: string;
  timedOut: string;
}

export const kioskTranslations: Record<KioskLanguage, KioskStrings> = {
  en: {
    welcome: 'Welcome to WellFit Health Kiosk',
    selectLanguage: 'Select Your Language',
    english: 'English',
    spanish: 'Spanish',
    vietnamese: 'Vietnamese',
    patientLookup: 'Patient Lookup',
    firstName: 'First Name',
    lastName: 'Last Name',
    dateOfBirth: 'Date of Birth',
    findMe: 'Find Me',
    privacy: 'Privacy Consent',
    privacyText:
      'Your health information is private and secure. This kiosk uses encryption and follows HIPAA guidelines. By continuing, you consent to using this kiosk for your health check-in.',
    agree: 'I Agree',
    cancel: 'Cancel',
    back: 'Back',
    checking: 'One moment...',
    notFound: 'We could not find your record. Please check your information or see staff for assistance.',
    tooManyAttempts: 'Too many attempts. Please wait a few minutes or see staff for assistance.',
    kioskUnavailable: 'This kiosk is unavailable right now. Please see staff to check in.',
    verifyTitle: 'Verify It’s You',
    codeSentTo: 'We sent a code by text message to',
    enterCode: 'Enter the code from your text message',
    enterPhoneLast4: 'Enter the last 4 digits of your phone number',
    phoneLast4Help: 'This is the phone number we have on file for you.',
    checkIn: 'Check In',
    verifyFailed: 'That didn’t match. Please try again or see staff for assistance.',
    seeStaffTitle: 'Please See Staff',
    seeStaffText:
      'We found your record, but we need a staff member to help you check in today.',
    startOver: 'Start Over',
    successTitle: 'You’re Checked In!',
    successText: 'Please have a seat. A community health worker will be with you shortly.',
    timedOut: 'Session timed out for security. Please start over.',
  },
  es: {
    welcome: 'Bienvenido al Quiosco de Salud WellFit',
    selectLanguage: 'Seleccione su idioma',
    english: 'Inglés',
    spanish: 'Español',
    vietnamese: 'Vietnamita',
    patientLookup: 'Búsqueda de Paciente',
    firstName: 'Nombre',
    lastName: 'Apellido',
    dateOfBirth: 'Fecha de Nacimiento',
    findMe: 'Encuéntrame',
    privacy: 'Consentimiento de Privacidad',
    privacyText:
      'Su información de salud es privada y segura. Este quiosco usa encriptación y sigue las pautas de HIPAA. Al continuar, usted consiente en usar este quiosco para su registro de salud.',
    agree: 'Estoy de acuerdo',
    cancel: 'Cancelar',
    back: 'Atrás',
    checking: 'Un momento...',
    notFound: 'No encontramos su registro. Verifique su información o consulte al personal.',
    tooManyAttempts: 'Demasiados intentos. Espere unos minutos o consulte al personal.',
    kioskUnavailable: 'Este quiosco no está disponible en este momento. Consulte al personal para registrarse.',
    verifyTitle: 'Verifique su identidad',
    codeSentTo: 'Enviamos un código por mensaje de texto a',
    enterCode: 'Ingrese el código de su mensaje de texto',
    enterPhoneLast4: 'Ingrese los últimos 4 dígitos de su número de teléfono',
    phoneLast4Help: 'Este es el número de teléfono que tenemos registrado para usted.',
    checkIn: 'Registrarse',
    verifyFailed: 'No coincide. Intente de nuevo o consulte al personal.',
    seeStaffTitle: 'Consulte al Personal',
    seeStaffText:
      'Encontramos su registro, pero necesitamos que un miembro del personal le ayude a registrarse hoy.',
    startOver: 'Comenzar de Nuevo',
    successTitle: '¡Ya está registrado!',
    successText: 'Por favor tome asiento. Un trabajador de salud comunitaria le atenderá pronto.',
    timedOut: 'La sesión expiró por seguridad. Por favor, comience de nuevo.',
  },
  vi: {
    welcome: 'Chào Mừng Đến Quầy Sức Khỏe WellFit',
    selectLanguage: 'Chọn Ngôn Ngữ Của Bạn',
    english: 'Tiếng Anh',
    spanish: 'Tiếng Tây Ban Nha',
    vietnamese: 'Tiếng Việt',
    patientLookup: 'Tra Cứu Bệnh Nhân',
    firstName: 'Tên',
    lastName: 'Họ',
    dateOfBirth: 'Ngày Sinh',
    findMe: 'Tìm Tôi',
    privacy: 'Đồng Ý Quyền Riêng Tư',
    privacyText:
      'Thông tin sức khỏe của bạn được bảo mật và an toàn. Quầy này sử dụng mã hóa và tuân theo hướng dẫn HIPAA. Bằng cách tiếp tục, bạn đồng ý sử dụng quầy này để đăng ký sức khỏe của mình.',
    agree: 'Tôi Đồng Ý',
    cancel: 'Hủy',
    back: 'Quay Lại',
    checking: 'Xin chờ một lát...',
    notFound: 'Không tìm thấy hồ sơ của bạn. Vui lòng kiểm tra thông tin hoặc liên hệ nhân viên.',
    tooManyAttempts: 'Quá nhiều lần thử. Vui lòng chờ vài phút hoặc liên hệ nhân viên.',
    kioskUnavailable: 'Quầy này hiện không khả dụng. Vui lòng liên hệ nhân viên để đăng ký.',
    verifyTitle: 'Xác Minh Danh Tính',
    codeSentTo: 'Chúng tôi đã gửi mã qua tin nhắn đến',
    enterCode: 'Nhập mã từ tin nhắn của bạn',
    enterPhoneLast4: 'Nhập 4 số cuối của số điện thoại của bạn',
    phoneLast4Help: 'Đây là số điện thoại chúng tôi có trong hồ sơ của bạn.',
    checkIn: 'Đăng Ký',
    verifyFailed: 'Không khớp. Vui lòng thử lại hoặc liên hệ nhân viên.',
    seeStaffTitle: 'Vui Lòng Liên Hệ Nhân Viên',
    seeStaffText:
      'Chúng tôi đã tìm thấy hồ sơ của bạn, nhưng cần nhân viên hỗ trợ bạn đăng ký hôm nay.',
    startOver: 'Bắt Đầu Lại',
    successTitle: 'Bạn Đã Đăng Ký!',
    successText: 'Vui lòng ngồi đợi. Nhân viên y tế cộng đồng sẽ gặp bạn ngay.',
    timedOut: 'Phiên làm việc đã hết hạn vì lý do bảo mật. Vui lòng bắt đầu lại.',
  },
};
