import type { Locale } from '../lib/i18n';
import type { ContactValidationCode } from './contactValidation';

export interface ContactSubmitErrorMessages {
  timeout: string;
  tooMany: string;
  unavailable: string;
  forbidden: string;
  invalidRequest: string;
  retry: string;
}

interface ContactValidationFallbacks {
  errorsFound: string;
  nameRequired: string;
  nameMin: string;
  nameMax: string;
  nameInvalid: string;
  emailRequired: string;
  emailInvalid: string;
  emailMax: string;
  phoneRequired: string;
  phoneInvalid: string;
  phoneLength: string;
  messageRequired: string;
  messageMin: string;
  messageMax: string;
}

const SUBMIT_ERROR_MESSAGES: Record<Locale, ContactSubmitErrorMessages> = {
  ko: {
    timeout: '요청 시간이 초과되었습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
    tooMany: '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
    unavailable: '현재 문의 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.',
    forbidden: '요청이 차단되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
    invalidRequest: '요청 형식이 올바르지 않습니다. 입력 내용을 확인해 주세요.',
    retry: '다시 시도',
  },
  en: {
    timeout: 'Request timed out. Please check your network and try again.',
    tooMany: 'Too many requests. Please try again in a moment.',
    unavailable: 'Contact service is temporarily unavailable. Please try again shortly.',
    forbidden: 'Request was blocked. Please refresh the page and try again.',
    invalidRequest: 'Request format is invalid. Please review your input and try again.',
    retry: 'Try again',
  },
  zh: {
    timeout: '请求超时。请检查网络后重试。',
    tooMany: '请求过于频繁，请稍后再试。',
    unavailable: '咨询服务暂时不可用，请稍后重试。',
    forbidden: '请求被拦截。请刷新页面后重试。',
    invalidRequest: '请求格式无效。请检查输入后重试。',
    retry: '重试',
  },
  es: {
    timeout: 'La solicitud supero el tiempo de espera. Verifica tu red e intentalo de nuevo.',
    tooMany: 'Demasiadas solicitudes. Intentalo de nuevo en un momento.',
    unavailable: 'El servicio de contacto no esta disponible temporalmente. Intentalo pronto.',
    forbidden: 'La solicitud fue bloqueada. Recarga la pagina e intentalo de nuevo.',
    invalidRequest: 'El formato de la solicitud no es valido. Revisa tus datos e intentalo de nuevo.',
    retry: 'Reintentar',
  },
  vi: {
    timeout: 'Yeu cau het thoi gian cho. Vui long kiem tra mang va thu lai.',
    tooMany: 'Qua nhieu yeu cau. Vui long thu lai sau it phut.',
    unavailable: 'Dich vu lien he tam thoi khong kha dung. Vui long thu lai sau.',
    forbidden: 'Yeu cau bi chan. Vui long tai lai trang roi thu lai.',
    invalidRequest: 'Dinh dang yeu cau khong hop le. Vui long kiem tra lai noi dung.',
    retry: 'Thu lai',
  },
  th: {
    timeout: 'คําขอหมดเวลา กรุณาตรวจสอบเครือข่ายแล้วลองใหม่อีกครั้ง',
    tooMany: 'มีคําขอมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง',
    unavailable: 'บริการติดต่อไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง',
    forbidden: 'คําขอถูกบล็อก กรุณารีเฟรชหน้าแล้วลองใหม่อีกครั้ง',
    invalidRequest: 'รูปแบบคําขอไม่ถูกต้อง กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง',
    retry: 'ลองอีกครั้ง',
  },
  uz: {
    timeout: 'Sorov vaqti tugadi. Tarmoqni tekshirib, qayta urinib koring.',
    tooMany: 'So\'rovlar juda kop. Birozdan keyin yana urinib koring.',
    unavailable: 'Aloqa xizmati vaqtincha mavjud emas. Keyinroq qayta urinib koring.',
    forbidden: 'So\'rov bloklandi. Sahifani yangilang va qayta urinib koring.',
    invalidRequest: 'So\'rov formati noto\'g\'ri. Kiritilgan ma\'lumotlarni tekshirib qayta urinib koring.',
    retry: 'Qayta urinish',
  },
};

const VALIDATION_FALLBACKS: Record<Locale, ContactValidationFallbacks> = {
  ko: {
    errorsFound: '{{count}}개의 입력 항목을 확인해 주세요.',
    nameRequired: '이름을 입력해 주세요.',
    nameMin: '이름은 2자 이상 입력해 주세요.',
    nameMax: '이름은 100자 이하로 입력해 주세요.',
    nameInvalid: '이름에 사용할 수 없는 문자가 포함되어 있습니다.',
    emailRequired: '이메일을 입력해 주세요.',
    emailInvalid: '유효한 이메일 형식을 입력해 주세요.',
    emailMax: '이메일은 254자 이하로 입력해 주세요.',
    phoneRequired: '연락처를 입력해 주세요.',
    phoneInvalid: '연락처 형식이 올바르지 않습니다.',
    phoneLength: '연락처는 5자 이상 50자 이하로 입력해 주세요.',
    messageRequired: '메시지를 입력해 주세요.',
    messageMin: '메시지는 10자 이상 입력해 주세요.',
    messageMax: '메시지는 5000자 이하로 입력해 주세요.',
  },
  en: {
    errorsFound: 'Please review {{count}} field(s).',
    nameRequired: 'Name is required.',
    nameMin: 'Name must be at least 2 characters.',
    nameMax: 'Name must be 100 characters or fewer.',
    nameInvalid: 'Name contains invalid characters.',
    emailRequired: 'Email is required.',
    emailInvalid: 'Please enter a valid email address.',
    emailMax: 'Email must be 254 characters or fewer.',
    phoneRequired: 'Phone is required.',
    phoneInvalid: 'Phone format is invalid.',
    phoneLength: 'Phone must be between 5 and 50 characters.',
    messageRequired: 'Message is required.',
    messageMin: 'Message must be at least 10 characters.',
    messageMax: 'Message must be 5000 characters or fewer.',
  },
  zh: {
    errorsFound: '请检查 {{count}} 个输入项。',
    nameRequired: '请输入姓名。',
    nameMin: '姓名至少需要 2 个字符。',
    nameMax: '姓名不能超过 100 个字符。',
    nameInvalid: '姓名包含无效字符。',
    emailRequired: '请输入电子邮箱。',
    emailInvalid: '请输入有效的电子邮箱地址。',
    emailMax: '电子邮箱不能超过 254 个字符。',
    phoneRequired: '请输入联系电话。',
    phoneInvalid: '联系电话格式无效。',
    phoneLength: '联系电话长度需在 5 到 50 个字符之间。',
    messageRequired: '请输入留言。',
    messageMin: '留言至少需要 10 个字符。',
    messageMax: '留言不能超过 5000 个字符。',
  },
  es: {
    errorsFound: 'Revisa {{count}} campo(s).',
    nameRequired: 'El nombre es obligatorio.',
    nameMin: 'El nombre debe tener al menos 2 caracteres.',
    nameMax: 'El nombre debe tener como maximo 100 caracteres.',
    nameInvalid: 'El nombre contiene caracteres no validos.',
    emailRequired: 'El correo es obligatorio.',
    emailInvalid: 'Ingresa un correo electronico valido.',
    emailMax: 'El correo debe tener como maximo 254 caracteres.',
    phoneRequired: 'El telefono es obligatorio.',
    phoneInvalid: 'El formato del telefono no es valido.',
    phoneLength: 'El telefono debe tener entre 5 y 50 caracteres.',
    messageRequired: 'El mensaje es obligatorio.',
    messageMin: 'El mensaje debe tener al menos 10 caracteres.',
    messageMax: 'El mensaje debe tener como maximo 5000 caracteres.',
  },
  vi: {
    errorsFound: 'Vui long kiem tra {{count}} truong.',
    nameRequired: 'Vui long nhap ten.',
    nameMin: 'Ten phai co it nhat 2 ky tu.',
    nameMax: 'Ten khong duoc vuot qua 100 ky tu.',
    nameInvalid: 'Ten chua ky tu khong hop le.',
    emailRequired: 'Vui long nhap email.',
    emailInvalid: 'Vui long nhap email hop le.',
    emailMax: 'Email khong duoc vuot qua 254 ky tu.',
    phoneRequired: 'Vui long nhap so dien thoai.',
    phoneInvalid: 'Dinh dang so dien thoai khong hop le.',
    phoneLength: 'So dien thoai phai tu 5 den 50 ky tu.',
    messageRequired: 'Vui long nhap noi dung.',
    messageMin: 'Noi dung phai co it nhat 10 ky tu.',
    messageMax: 'Noi dung khong duoc vuot qua 5000 ky tu.',
  },
  th: {
    errorsFound: 'กรุณาตรวจสอบ {{count}} ช่องข้อมูล',
    nameRequired: 'กรุณากรอกชื่อ',
    nameMin: 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร',
    nameMax: 'ชื่อต้องไม่เกิน 100 ตัวอักษร',
    nameInvalid: 'ชื่อมีอักขระที่ไม่ถูกต้อง',
    emailRequired: 'กรุณากรอกอีเมล',
    emailInvalid: 'กรุณากรอกอีเมลที่ถูกต้อง',
    emailMax: 'อีเมลต้องไม่เกิน 254 ตัวอักษร',
    phoneRequired: 'กรุณากรอกเบอร์โทรศัพท์',
    phoneInvalid: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง',
    phoneLength: 'เบอร์โทรศัพท์ต้องมีความยาว 5 ถึง 50 ตัวอักษร',
    messageRequired: 'กรุณากรอกข้อความ',
    messageMin: 'ข้อความต้องมีอย่างน้อย 10 ตัวอักษร',
    messageMax: 'ข้อความต้องไม่เกิน 5000 ตัวอักษร',
  },
  uz: {
    errorsFound: '{{count}} ta maydonni tekshiring.',
    nameRequired: 'Ism kiritilishi shart.',
    nameMin: 'Ism kamida 2 ta belgidan iborat bolishi kerak.',
    nameMax: 'Ism 100 ta belgidan oshmasligi kerak.',
    nameInvalid: 'Ismda yaroqsiz belgilar bor.',
    emailRequired: 'Email kiritilishi shart.',
    emailInvalid: 'Yaroqli email manzilini kiriting.',
    emailMax: 'Email 254 ta belgidan oshmasligi kerak.',
    phoneRequired: 'Telefon raqami kiritilishi shart.',
    phoneInvalid: 'Telefon raqami formati notogri.',
    phoneLength: 'Telefon raqami 5 dan 50 tagacha belgidan iborat bolishi kerak.',
    messageRequired: 'Xabar kiritilishi shart.',
    messageMin: 'Xabar kamida 10 ta belgidan iborat bolishi kerak.',
    messageMax: 'Xabar 5000 ta belgidan oshmasligi kerak.',
  },
};

const VALIDATION_MESSAGE_META: Record<ContactValidationCode, { key: string; fallback: keyof ContactValidationFallbacks }> = {
  name_required: { key: 'contact.form.errors.nameRequired', fallback: 'nameRequired' },
  name_min: { key: 'contact.form.errors.nameMin', fallback: 'nameMin' },
  name_max: { key: 'contact.form.errors.nameMax', fallback: 'nameMax' },
  name_invalid: { key: 'contact.form.errors.nameInvalid', fallback: 'nameInvalid' },
  email_required: { key: 'contact.form.errors.emailRequired', fallback: 'emailRequired' },
  email_invalid: { key: 'contact.form.errors.emailInvalid', fallback: 'emailInvalid' },
  email_max: { key: 'contact.form.errors.emailMax', fallback: 'emailMax' },
  phone_required: { key: 'contact.form.errors.phoneRequired', fallback: 'phoneRequired' },
  phone_invalid: { key: 'contact.form.errors.phoneInvalid', fallback: 'phoneInvalid' },
  phone_length: { key: 'contact.form.errors.phoneLength', fallback: 'phoneLength' },
  message_required: { key: 'contact.form.errors.messageRequired', fallback: 'messageRequired' },
  message_min: { key: 'contact.form.errors.messageMin', fallback: 'messageMin' },
  message_max: { key: 'contact.form.errors.messageMax', fallback: 'messageMax' },
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const getSubmitErrorMessages = (locale: Locale): ContactSubmitErrorMessages =>
  SUBMIT_ERROR_MESSAGES[locale] || SUBMIT_ERROR_MESSAGES.ko;

export const getValidationFallbacks = (locale: Locale): ContactValidationFallbacks =>
  VALIDATION_FALLBACKS[locale] || VALIDATION_FALLBACKS.ko;

export const getContactValidationMessage = (
  code: ContactValidationCode | undefined,
  locale: Locale,
  t: TranslateFn
): string => {
  if (!code) return '';

  const messageMeta = VALIDATION_MESSAGE_META[code];
  const fallbackCopy = getValidationFallbacks(locale);
  return t(messageMeta.key, { defaultValue: fallbackCopy[messageMeta.fallback] });
};
