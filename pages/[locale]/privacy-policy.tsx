import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { Section } from '../../components/ui/Section';
import { getSiteConfig } from '../../data/siteConfig';
import {
  FUNDING_COLLECTED_ITEMS,
  FUNDING_COLLECTION_PURPOSES,
  FUNDING_DATA_PROCESSORS,
  PRIVACY_LEGAL_RETENTION_TEXT,
  PRIVACY_RETENTION_TEXT,
} from '../../lib/funding/policy';
import { buildPageStaticProps, getCommonStaticPaths } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface PrivacyPolicyProps {
  locale: Locale;
}

type PolicySection = {
  heading: string;
  body: string;
  /** 본문 아래 목록. 수집 항목·이용 목적처럼 열거가 본문보다 읽기 쉬운 곳에만 쓴다. */
  items?: readonly string[];
  /** 수탁자 표. 개인정보보호법 제26조 고지 형식(수탁자·업무·항목)을 그대로 따른다. */
  processors?: ReadonlyArray<{ name: string; purpose: string; items: string }>;
};

type PolicyCopy = {
  title: string;
  subtitle: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  sections: PolicySection[];
};

/**
 * 문의·상담과 **예약·결제** 처리에 관여하는 수탁자 — 개인정보보호법 제26조·제30조의 고지 대상.
 *
 * 예전엔 4항이 "원칙적으로 외부에 제공하지 않으며"로 끝나고 수탁자를 한 곳도 밝히지 않았는데,
 * 바로 아래 9항은 펀딩 수탁자 4곳을 표로 싣고 있었다 — 같은 문서가 스스로 모순됐다.
 *
 * 고쳐 놓고 한 번 더 틀릴 뻔했다: Resend·Vercel 둘만 싣고 본문을 "아래와 같이 위탁하고
 * 있으며"라는 **열거형 단언**으로 바꾸면, 모호했던 옛 문장보다 오히려 적극적으로 부정확해진다.
 * 예약(/[locale]/booking)은 살아 있는 상품이고 문의 폼보다 많은 곳을 거치기 때문이다.
 * 아래 5곳은 전부 코드에서 확인한 것이다.
 *
 *   Resend        lib/booking/email.ts → lib/email/resend.ts, pages/api/contact/send-email.ts
 *   Vercel        vercel.json · data/siteConfig.ts hostingProvider
 *   Turso(libsql) db/client.ts — orders·bookings·work_orders 영속
 *   Google LLC    lib/booking/gcal.ts — 확정 시 캘린더 이벤트 생성.
 *                 lib/booking/confirm.ts가 이벤트 본문에 고객 이름·전화·이메일·요청사항을 담는다.
 *   토스페이먼츠   components/booking/TossPaymentWidget.tsx(customerName·customerEmail) · lib/booking/toss.ts
 *
 * 형식은 9항(FUNDING_DATA_PROCESSORS)과 같은 수탁자·업무·항목 3열을 쓴다. 위탁이 늘거나
 * 줄면 여기부터 고칠 것 — 4항 본문이 "아래와 같이"라고 단언하므로 표가 곧 사실 주장이다.
 */
export const SERVICE_DATA_PROCESSORS: ReadonlyArray<{ name: string; purpose: string; items: string }> = [
  { name: 'Resend', purpose: '문의 답변 메일, 예약 확정·변경·취소 안내 메일 발송', items: '이름, 연락처, 이메일 주소, 문의 내용, 예약·주문 내역' },
  { name: 'Vercel', purpose: '웹사이트·문의 접수·예약 처리 서버 호스팅', items: '문의·예약 과정에서 전송되는 위 항목 전부' },
  { name: 'Turso', purpose: '예약·주문 기록 데이터베이스 보관', items: '이름, 연락처, 이메일 주소, 예약 일시·상품·요청사항, 결제·환불 처리 기록' },
  { name: 'Google LLC', purpose: '확정된 예약의 일정 관리(구글 캘린더 이벤트 생성·삭제)', items: '이름, 연락처, 이메일 주소, 예약 일시·상품·요청사항, 주문번호' },
  { name: '토스페이먼츠', purpose: '예약 결제 승인·취소·환불 처리', items: '이름, 이메일 주소, 주문번호, 결제 금액·결제수단 정보' },
];

/** 테스트(tests/pages/privacy-policy.test.tsx)가 로케일 간 모순을 검사하므로 export한다. */
export const POLICY_COPY_BY_LOCALE: Record<Locale, PolicyCopy> = {
  ko: {
    title: '개인정보 처리방침',
    subtitle: '스튜디오 놀은 문의·상담 응대와 펀딩(리워드 선주문) 처리에 필요한 최소한의 개인정보만 수집하고 안전하게 관리합니다.',
    lastUpdatedLabel: '시행일',
    lastUpdatedValue: '2026년 9월 11일',
    sections: [
      {
        heading: '1. 수집하는 개인정보 항목',
        body: '문의 양식을 통해 이름, 연락처, 이메일, 문의 내용을 수집할 수 있습니다. 예약·결제 신청 화면에서는 이름, 연락처, 이메일 주소, 예약 일시·상품, 요청사항과 결제 처리 기록(주문번호, 결제 금액·결제수단)을 수집합니다. 펀딩(리워드 선주문)의 수집 항목은 아래 6항이 따로 정합니다.',
      },
      {
        heading: '2. 개인정보 이용 목적',
        body: '수집한 정보는 문의 답변, 예약 접수·확정·변경·취소 안내, 결제와 환불 처리, 서비스 상담 및 고객 요청 처리 목적으로만 사용합니다.',
      },
      {
        heading: '3. 보유 및 이용 기간',
        body: `문의·상담으로 수집한 개인정보는 상담 완료 후 지체 없이 파기합니다. 예약·결제 기록은 ${PRIVACY_LEGAL_RETENTION_TEXT} 펀딩 후원으로 수집한 개인정보의 보유 기간은 아래 8항을 따릅니다.`,
      },
      {
        heading: '4. 제3자 제공 및 처리위탁',
        body: '개인정보를 제3자에게 제공하지 않습니다. 다만 문의·상담과 예약·결제 처리에 필요한 범위에서 아래와 같이 개인정보 처리를 위탁하고 있으며, 수탁자가 바뀌면 이 처리방침으로 알립니다. 펀딩(리워드 선주문) 처리의 위탁 현황은 아래 9항이, 언론 홍보 업무의 매체 연락처는 아래 10~12항이 따로 정합니다.',
        processors: SERVICE_DATA_PROCESSORS,
      },
      {
        heading: '5. 이용자의 권리',
        body: '정보주체는 언제든지 개인정보 열람, 정정, 삭제를 요청할 수 있으며, 요청 시 지체 없이 조치합니다.',
      },
      // 6~9항은 펀딩(리워드 선주문) 전용이다. 펀딩 신청 화면의 동의 체크박스 하나가 펀딩 약관과
      // 이 처리방침을 함께 동의받으므로, 두 문서의 보유기간·수집 항목이 어긋나면 그 동의가 무효가 된다.
      // 보유기간·법정 보존 문구는 lib/funding/policy.ts의 상수를 약관(제13조)과 함께 쓴다(복제 금지).
      {
        heading: '6. 펀딩(리워드 선주문) 수집 항목',
        body: '펀딩 후원은 통신판매 계약이라 문의·상담과 수집 항목이 다릅니다. 후원 신청 화면에서 다음 항목을 수집합니다.',
        items: FUNDING_COLLECTED_ITEMS,
      },
      {
        heading: '7. 펀딩 개인정보의 이용 목적',
        body: '후원으로 수집한 개인정보는 아래 목적으로만 이용합니다.',
        items: FUNDING_COLLECTION_PURPOSES,
      },
      {
        heading: '8. 펀딩 개인정보의 보유·이용 기간',
        body: `후원으로 수집한 개인정보는 ${PRIVACY_RETENTION_TEXT} 보관한 뒤 지체 없이 파기합니다. 다만 ${PRIVACY_LEGAL_RETENTION_TEXT} 후원자가 후원을 취소해 환불이 완료된 경우에도 이 거래기록 보존 의무는 그대로 적용됩니다.`,
      },
      {
        heading: '9. 펀딩 개인정보의 처리위탁',
        body: '후원 처리를 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 수탁자가 바뀌면 이 처리방침으로 알립니다.',
        processors: FUNDING_DATA_PROCESSORS,
      },
      // 10~12항은 음원 발매 홍보 업무 전용이다. 이 업무는 정보주체(기자·매체)가 아닌
      // 곳에서 개인정보를 수집하므로, 처리 사실과 출처·수신거부·제3자 제공 원칙을
      // 공개해 두어야 한다. 공개하지 않고 하면 같은 행위가 "몰래 했다"가 된다.
      {
        heading: '10. 언론 홍보 업무를 위한 매체 연락처 처리',
        body:
          '스튜디오 놀은 음원 발매 홍보 업무를 위해 언론사·매체·방송·음반 유통처가 스스로 공개한 ' +
          '업무용 연락처(편집부·제보·기고 접수 창구 등)를 수집해 보도자료를 보냅니다. 정보주체가 ' +
          '공개한 범위 안에서만 이용하며, 개인이 사적으로 쓰는 주소는 수집하지 않습니다. ' +
          '주소를 어디서 확인했는지는 보내는 메일에 함께 밝히고, 요청하시면 개별 출처를 알려드립니다.',
      },
      {
        heading: '11. 매체 연락처의 수신거부와 보유 기간',
        body:
          '수신을 원하지 않는다는 뜻을 밝히시면 즉시 발송 대상에서 제외하고, 이후 어떤 캠페인에서도 ' +
          '다시 보내지 않습니다. 이 제외 기록과 발송 기록은 같은 메일이 두 번 가는 것을 막기 위해 ' +
          '보관합니다 — 기록을 지우면 다시 보내게 되기 때문입니다.',
      },
      {
        heading: '12. 매체 연락처의 제3자 제공',
        body:
          '수집한 매체 연락처는 어떤 경우에도 제3자에게 제공하지 않습니다. 홍보를 의뢰한 고객에게 ' +
          '드리는 결과 보고서에도 개인의 이름과 이메일 주소는 싣지 않으며, 법인·단체 매체는 공개 ' +
          '도메인으로, 개인 기자·평론가는 인원 집계로만 적습니다.',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'September 11, 2026',
    sections: [
      {
        heading: '1. Personal data we collect',
        body: 'Through the inquiry form, we may collect your name, phone number, email address, and message content.',
      },
      {
        heading: '2. Purpose of use',
        body: 'Collected data is used only to answer inquiries, support bookings, provide consultation, and process customer requests.',
      },
      {
        heading: '3. Retention period',
        body: 'Personal data collected through inquiries is deleted without delay after the consultation is completed. Personal data collected through crowdfunding pledges (offered on our Korean pages only) is kept until one year after reward delivery and then destroyed, except for transaction records that Korean e-commerce law requires us to keep for up to five years. See the Korean privacy policy and funding terms for details.',
      },
      {
        heading: '4. Third-party sharing and outsourcing',
        body: 'We do not provide personal data to third parties. We do entrust processing: Resend (sending inquiry and booking emails) and Vercel (website and server hosting) receive the name, phone number, email address, and message you submit. Bookings and payments (offered on our Korean pages only) additionally involve Turso (booking and order database), Google LLC (calendar event for a confirmed booking) and Toss Payments (payment approval, cancellation, refund). Outsourcing for crowdfunding (reward pre-orders) is listed in section 9 of the Korean privacy policy, and media contact handling for press outreach in sections 6 to 8 below.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
      {
        heading: '6. Media contact details for press outreach',
        body: 'For music release publicity, Studio NOL collects business contact details that press outlets, media companies, broadcasters, and music distributors have themselves made public (editorial desks, news tip lines, contribution intake channels, and similar) and uses them to send press releases. We use them only within the scope the data subject has made public, and we do not collect addresses that individuals use privately. Every email we send states where we found the address, and we will disclose the individual source on request.',
      },
      {
        heading: '7. Opt-out and retention of media contact details',
        body: 'If you tell us you do not wish to receive our emails, we remove you from the send list immediately and will not send to you again in any later campaign. We keep that opt-out record together with our send log to prevent the same email being sent twice - deleting the record would make us send it again.',
      },
      {
        heading: '8. Third-party sharing of media contact details',
        body: 'We never provide collected media contact details to third parties under any circumstances. The result reports we give to clients who commission publicity do not carry individual names or email addresses either: outlets that are companies or organisations are listed by their public domain, and individual reporters and critics are recorded only as a headcount.',
      },
    ],
  },
  zh: {
    title: '隐私政策',
    subtitle: 'Studio NOL 仅收集处理咨询与沟通所需的最少个人信息，并进行安全管理。',
    lastUpdatedLabel: '生效日期',
    lastUpdatedValue: '2026年9月11日',
    sections: [
      {
        heading: '1. 我们收集的个人信息',
        body: '通过咨询表单，我们可能会收集您的姓名、联系电话、电子邮箱和咨询内容。',
      },
      {
        heading: '2. 使用目的',
        body: '所收集的信息仅用于回复咨询、预约引导、服务说明及处理客户请求。',
      },
      {
        heading: '3. 保存与使用期限',
        body: '因咨询而收集的个人信息在咨询完成后将及时删除。通过众筹支持（仅在韩语页面提供）收集的个人信息保存至回报寄送完成后 1 年再行销毁；韩国电子商务法要求保存的交易记录最长保存 5 年。详情请参阅韩语版隐私政策及众筹条款。',
      },
      {
        heading: '4. 向第三方提供与委托处理',
        body: '我们不向第三方提供个人信息。但我们委托处理如下：Resend（发送咨询与预约相关邮件）与 Vercel（网站及服务器托管）会接收您提交的姓名、联系电话、电子邮箱和咨询内容。预约与支付（仅在韩语页面提供）另外涉及 Turso（预约与订单数据库）、Google LLC（为已确认预约创建日历日程）和 Toss Payments（支付授权、取消与退款）。众筹（回报预购）相关的委托情况请参阅韩语版隐私政策第 9 项，新闻宣传的媒体联系方式处理请见下方第 6 至 8 项。',
      },
      {
        heading: '5. 用户权利',
        body: '您可随时请求查阅、更正或删除个人信息，我们将及时处理。',
      },
      {
        heading: '6. 为新闻宣传业务处理媒体联系方式',
        body: 'Studio NOL 为音乐作品发行宣传业务，收集新闻机构、媒体、广播电视及音乐发行方自行公开的公务联系方式（编辑部、报料与投稿受理窗口等），并据此发送新闻稿。我们仅在信息主体已公开的范围内使用，不收集个人私下使用的地址。该地址的获取来源会在发出的邮件中一并说明，如您提出要求，我们也会单独告知具体出处。',
      },
      {
        heading: '7. 媒体联系方式的拒绝接收与保存期限',
        body: '若您表示不希望继续接收，我们将立即将其从发送对象中排除，此后在任何宣传活动中都不会再次发送。该排除记录与发送记录将予以保存，以防同一封邮件重复发出——若删除记录，我们就会再次发送。',
      },
      {
        heading: '8. 媒体联系方式向第三方提供',
        body: '所收集的媒体联系方式在任何情况下都不会向第三方提供。向委托宣传的客户提交的结果报告中也不会载明个人姓名与电子邮箱；法人及团体媒体仅以公开域名记载，个人记者与评论人仅以人数统计记载。',
      },
    ],
  },
  es: {
    title: 'Política de privacidad',
    subtitle: 'Studio NOL recopila solo los datos personales mínimos necesarios para responder consultas y brindar orientación.',
    lastUpdatedLabel: 'Fecha de entrada en vigor',
    lastUpdatedValue: '11 de septiembre de 2026',
    sections: [
      {
        heading: '1. Datos personales que recopilamos',
        body: 'Mediante el formulario de contacto podemos recopilar nombre, teléfono, correo electrónico y contenido del mensaje.',
      },
      {
        heading: '2. Finalidad del uso',
        body: 'Los datos recopilados se usan solo para responder consultas, apoyar reservas, brindar orientación y gestionar solicitudes del cliente.',
      },
      {
        heading: '3. Período de conservación',
        body: 'Los datos personales recopilados en consultas se eliminan sin demora al finalizar la atención. Los datos recopilados por aportes de crowdfunding (disponible solo en nuestras páginas en coreano) se conservan hasta un año después de la entrega de la recompensa y luego se destruyen, salvo los registros de la transacción que la ley coreana de comercio electrónico obliga a conservar hasta cinco años. Consulte la política de privacidad y los términos de financiación en coreano.',
      },
      {
        heading: '4. Cesión a terceros y tratamiento encargado',
        body: 'No cedemos datos personales a terceros. Sí encargamos el tratamiento: Resend (envío de correos de consulta y de reserva) y Vercel (alojamiento del sitio y del servidor) reciben el nombre, teléfono, correo electrónico y contenido del mensaje. Las reservas y pagos (disponibles solo en nuestras páginas en coreano) implican además a Turso (base de datos de reservas y pedidos), Google LLC (evento de calendario de una reserva confirmada) y Toss Payments (autorización, cancelación y reembolso del pago). El encargo relativo al crowdfunding (pedidos anticipados de recompensas) figura en el apartado 9 de la política de privacidad en coreano, y el tratamiento de contactos de prensa en los apartados 6 a 8 siguientes.',
      },
      {
        heading: '5. Derechos del usuario',
        body: 'Puede solicitar en cualquier momento acceso, corrección o eliminación de sus datos personales, y responderemos sin demoras indebidas.',
      },
      {
        heading: '6. Tratamiento de contactos de medios para labores de prensa',
        body: 'Para la promoción de lanzamientos musicales, Studio NOL recopila datos de contacto profesionales que los medios de comunicación, las emisoras y las distribuidoras musicales han hecho públicos por sí mismos (redacción, buzón de avisos, recepción de colaboraciones, etc.) y les envía notas de prensa. Los usamos únicamente dentro del ámbito que el interesado ha hecho público y no recopilamos direcciones de uso personal privado. En cada correo indicamos dónde obtuvimos la dirección y, si lo solicita, le informamos de la fuente concreta.',
      },
      {
        heading: '7. Baja y conservación de los contactos de medios',
        body: 'Si nos comunica que no desea recibir nuestros envíos, lo excluimos de inmediato de la lista de envío y no volveremos a escribirle en ninguna campaña posterior. Conservamos ese registro de exclusión junto con el registro de envíos para evitar que el mismo correo salga dos veces: si borráramos el registro, volveríamos a enviarlo.',
      },
      {
        heading: '8. Cesión a terceros de los contactos de medios',
        body: 'Los contactos de medios recopilados no se ceden a terceros en ningún caso. Los informes de resultados que entregamos al cliente que encarga la promoción tampoco incluyen nombres ni correos electrónicos de personas: los medios que son empresas o entidades se indican por su dominio público y los periodistas y críticos individuales, solo como recuento de personas.',
      },
    ],
  },
  vi: {
    title: 'Chính sách bảo mật',
    subtitle: 'Studio NOL chỉ thu thập tối thiểu thông tin cá nhân cần thiết để tiếp nhận và phản hồi tư vấn.',
    lastUpdatedLabel: 'Ngày hiệu lực',
    lastUpdatedValue: '11 tháng 9, 2026',
    sections: [
      {
        heading: '1. Thông tin cá nhân được thu thập',
        body: 'Thông qua form liên hệ, chúng tôi có thể thu thập họ tên, số điện thoại, email và nội dung yêu cầu.',
      },
      {
        heading: '2. Mục đích sử dụng',
        body: 'Thông tin thu thập chỉ được dùng để phản hồi yêu cầu, hỗ trợ đặt lịch, tư vấn dịch vụ và xử lý đề nghị của khách hàng.',
      },
      {
        heading: '3. Thời gian lưu trữ',
        body: 'Thông tin cá nhân thu thập qua tư vấn sẽ được xóa ngay sau khi hoàn tất tư vấn. Thông tin thu thập khi tham gia gây quỹ (chỉ có trên trang tiếng Hàn) được lưu đến một năm sau khi giao phần thưởng rồi hủy, trừ hồ sơ giao dịch mà luật thương mại điện tử Hàn Quốc yêu cầu lưu tới năm năm. Xem chính sách bảo mật và điều khoản gây quỹ bản tiếng Hàn để biết chi tiết.',
      },
      {
        heading: '4. Cung cấp cho bên thứ ba và ủy quyền xử lý',
        body: 'Chúng tôi không cung cấp dữ liệu cá nhân cho bên thứ ba. Chúng tôi có ủy quyền xử lý: Resend (gửi email liên hệ và email đặt lịch) và Vercel (lưu trữ website và máy chủ) nhận họ tên, số điện thoại, email và nội dung yêu cầu của bạn. Việc đặt lịch và thanh toán (chỉ có trên trang tiếng Hàn) còn liên quan tới Turso (cơ sở dữ liệu đặt lịch và đơn hàng), Google LLC (tạo sự kiện lịch cho lịch hẹn đã xác nhận) và Toss Payments (duyệt, hủy và hoàn tiền thanh toán). Việc ủy quyền xử lý cho gây quỹ (đặt trước phần thưởng) được nêu tại mục 9 của chính sách bảo mật bản tiếng Hàn, còn xử lý liên hệ báo chí ở mục 6 đến 8 bên dưới.',
      },
      {
        heading: '5. Quyền của người dùng',
        body: 'Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa thông tin cá nhân bất cứ lúc nào, và chúng tôi sẽ xử lý sớm nhất có thể.',
      },
      {
        heading: '6. Xử lý thông tin liên hệ của báo chí cho hoạt động truyền thông',
        body: 'Để phục vụ hoạt động quảng bá phát hành âm nhạc, Studio NOL thu thập các địa chỉ liên hệ công vụ mà cơ quan báo chí, đơn vị truyền thông, đài phát thanh - truyền hình và nhà phân phối âm nhạc tự công khai (ban biên tập, kênh tiếp nhận tin báo, kênh nhận bài cộng tác, v.v.) để gửi thông cáo báo chí. Chúng tôi chỉ sử dụng trong phạm vi mà chủ thể thông tin đã công khai và không thu thập địa chỉ cá nhân dùng cho mục đích riêng tư. Trong mỗi email gửi đi, chúng tôi nêu rõ đã lấy địa chỉ từ đâu, và sẽ thông báo nguồn cụ thể nếu bạn yêu cầu.',
      },
      {
        heading: '7. Từ chối nhận thư và thời gian lưu trữ thông tin liên hệ của báo chí',
        body: 'Nếu bạn cho biết không muốn nhận thư, chúng tôi lập tức loại khỏi danh sách gửi và sẽ không gửi lại trong bất kỳ chiến dịch nào sau đó. Bản ghi loại trừ này cùng nhật ký gửi thư được lưu để tránh gửi trùng cùng một email - vì nếu xóa bản ghi, chúng tôi sẽ gửi lại.',
      },
      {
        heading: '8. Cung cấp thông tin liên hệ của báo chí cho bên thứ ba',
        body: 'Thông tin liên hệ của báo chí đã thu thập không được cung cấp cho bên thứ ba trong bất kỳ trường hợp nào. Báo cáo kết quả gửi cho khách hàng đặt hàng truyền thông cũng không ghi tên và địa chỉ email của cá nhân; cơ quan báo chí là pháp nhân hoặc tổ chức chỉ được ghi bằng tên miền công khai, còn phóng viên và nhà phê bình cá nhân chỉ được ghi theo số lượng người.',
      },
    ],
  },
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    subtitle: 'Studio NOL เก็บข้อมูลส่วนบุคคลเท่าที่จําเป็นสําหรับการรับและตอบคําสอบถามเท่านั้น',
    lastUpdatedLabel: 'วันที่มีผลบังคับใช้',
    lastUpdatedValue: '11 กันยายน 2026',
    sections: [
      {
        heading: '1. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม',
        body: 'ผ่านแบบฟอร์มติดต่อ เราอาจเก็บชื่อ เบอร์โทร อีเมล และรายละเอียดข้อความสอบถามของคุณ',
      },
      {
        heading: '2. วัตถุประสงค์ในการใช้งาน',
        body: 'ข้อมูลที่เก็บรวบรวมจะใช้เพื่อการตอบคําถาม การช่วยเหลือการจอง การให้คําปรึกษา และการดําเนินการตามคําขอของลูกค้าเท่านั้น',
      },
      {
        heading: '3. ระยะเวลาการเก็บรักษา',
        body: 'ข้อมูลส่วนบุคคลที่เก็บจากการสอบถามจะถูกลบโดยไม่ชักช้าหลังเสร็จสิ้นการให้คําปรึกษา ส่วนข้อมูลที่เก็บจากการร่วมสนับสนุนโครงการระดมทุน (มีเฉพาะหน้าภาษาเกาหลี) จะเก็บไว้จนถึงหนึ่งปีหลังส่งมอบของตอบแทนแล้วจึงทําลาย ยกเว้นบันทึกธุรกรรมที่กฎหมายพาณิชย์อิเล็กทรอนิกส์ของเกาหลีกําหนดให้เก็บสูงสุดห้าปี รายละเอียดดูได้จากนโยบายความเป็นส่วนตัวและข้อกําหนดการระดมทุนฉบับภาษาเกาหลี',
      },
      {
        heading: '4. การเปิดเผยต่อบุคคลที่สามและการว่าจ้างประมวลผล',
        body: 'เราไม่เปิดเผยข้อมูลส่วนบุคคลให้บุคคลที่สาม แต่เราว่าจ้างประมวลผลดังนี้ Resend (ส่งอีเมลคําสอบถามและอีเมลการจอง) และ Vercel (โฮสติงเว็บไซต์และเซิร์ฟเวอร์) จะได้รับชื่อ เบอร์โทร อีเมล และเนื้อหาคําสอบถามของคุณ ส่วนการจองและการชําระเงิน (มีเฉพาะหน้าภาษาเกาหลี) ยังเกี่ยวข้องกับ Turso (ฐานข้อมูลการจองและคําสั่งซื้อ) Google LLC (สร้างกําหนดการในปฏิทินสําหรับการจองที่ยืนยันแล้ว) และ Toss Payments (อนุมัติ ยกเลิก และคืนเงิน) การว่าจ้างประมวลผลที่เกี่ยวกับการระดมทุน (การสั่งจองของตอบแทนล่วงหน้า) ระบุไว้ในข้อ 9 ของนโยบายฉบับภาษาเกาหลี และการจัดการข้อมูลติดต่อสื่อมวลชนอยู่ในข้อ 6 ถึง 8 ด้านล่าง',
      },
      {
        heading: '5. สิทธิของผู้ใช้',
        body: 'คุณสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลได้ทุกเมื่อ และเราจะดําเนินการโดยเร็ว',
      },
      {
        heading: '6. การประมวลผลข้อมูลติดต่อของสื่อมวลชนเพื่องานประชาสัมพันธ์',
        body: 'เพื่องานประชาสัมพันธ์การเผยแพร่ผลงานเพลง Studio NOL เก็บรวบรวมข้อมูลติดต่อเชิงธุรกิจที่สํานักข่าว สื่อมวลชน สถานีวิทยุโทรทัศน์ และผู้จัดจําหน่ายเพลงเปิดเผยไว้เอง (กองบรรณาธิการ ช่องทางแจ้งข่าว ช่องทางรับบทความ เป็นต้น) เพื่อส่งข่าวประชาสัมพันธ์ เราใช้เฉพาะในขอบเขตที่เจ้าของข้อมูลส่วนบุคคลเปิดเผยไว้เท่านั้น และไม่เก็บที่อยู่ที่บุคคลใช้เป็นการส่วนตัว อีเมลที่เราส่งจะระบุด้วยว่าได้ที่อยู่นั้นมาจากที่ใด และหากร้องขอ เราจะแจ้งแหล่งที่มาเฉพาะรายให้ทราบ',
      },
      {
        heading: '7. การปฏิเสธการรับข่าวสารและระยะเวลาเก็บรักษาข้อมูลติดต่อของสื่อมวลชน',
        body: 'หากคุณแจ้งว่าไม่ประสงค์จะรับข่าวสาร เราจะนําออกจากรายชื่อผู้รับทันที และจะไม่ส่งอีกในทุกแคมเปญหลังจากนั้น บันทึกการนําออกนี้และบันทึกการส่งจะถูกเก็บไว้เพื่อป้องกันไม่ให้อีเมลฉบับเดียวกันถูกส่งซ้ํา เพราะหากลบบันทึกทิ้ง เราจะส่งซ้ําอีก',
      },
      {
        heading: '8. การเปิดเผยข้อมูลติดต่อของสื่อมวลชนต่อบุคคลที่สาม',
        body: 'ข้อมูลติดต่อของสื่อมวลชนที่เก็บรวบรวมไว้จะไม่ถูกเปิดเผยต่อบุคคลที่สามไม่ว่ากรณีใด ๆ รายงานผลที่ส่งให้ลูกค้าผู้ว่าจ้างงานประชาสัมพันธ์ก็จะไม่ระบุชื่อและอีเมลของบุคคล โดยสื่อที่เป็นนิติบุคคลหรือองค์กรจะระบุเป็นโดเมนสาธารณะ ส่วนนักข่าวและนักวิจารณ์ที่เป็นบุคคลจะระบุเพียงจํานวนคนเท่านั้น',
      },
    ],
  },
  uz: {
    title: 'Maxfiylik siyosati',
    subtitle: 'Studio NOL faqat murojaatlarni qabul qilish va javob berish uchun zarur bo\'lgan eng kam shaxsiy ma\'lumotlarni yig\'adi.',
    lastUpdatedLabel: 'Kuchga kirish sanasi',
    lastUpdatedValue: '2026-yil 11-sentabr',
    sections: [
      {
        heading: '1. Yig\'iladigan shaxsiy ma\'lumotlar',
        body: 'Murojaat formasi orqali ism, telefon raqami, email manzili va xabar mazmuni yig\'ilishi mumkin.',
      },
      {
        heading: '2. Foydalanish maqsadi',
        body: 'Yig\'ilgan ma\'lumotlar faqat murojaatlarga javob berish, bron qilishga ko\'maklashish, maslahat berish va mijoz so\'rovlarini bajarish uchun ishlatiladi.',
      },
      {
        heading: '3. Saqlash muddati',
        body: 'Murojaat orqali yig\'ilgan shaxsiy ma\'lumotlar maslahat yakunlangach kechiktirmasdan o\'chiriladi. Kraudfanding qo\'llab-quvvatlashi orqali yig\'ilgan ma\'lumotlar (faqat koreys tilidagi sahifalarda mavjud) mukofot yetkazilgandan keyin bir yilgacha saqlanadi va so\'ng yo\'q qilinadi; Koreya elektron tijorat qonuni talab qiladigan tranzaksiya yozuvlari besh yilgacha saqlanadi. Tafsilotlar koreyscha maxfiylik siyosati va kraudfanding shartlarida.',
      },
      {
        heading: '4. Uchinchi tomonga berish va qayta ishlashni topshirish',
        body: 'Shaxsiy ma\'lumotlar uchinchi tomonlarga berilmaydi. Biroq qayta ishlash topshirilgan: Resend (murojaat va bron xatlarini yuborish) hamda Vercel (veb-sayt va server hostingi) siz yuborgan ism, telefon raqami, email manzili va murojaat mazmunini oladi. Bron va to\'lov (faqat koreys tilidagi sahifalarda) qo\'shimcha ravishda Turso (bron va buyurtma ma\'lumotlar bazasi), Google LLC (tasdiqlangan bron uchun kalendar tadbiri) va Toss Payments (to\'lovni tasdiqlash, bekor qilish, qaytarish) ishtirokida kechadi. Kraudfanding (mukofotlarni oldindan buyurtma qilish) bo\'yicha topshirish koreyscha maxfiylik siyosatining 9-bandida, matbuot aloqalari esa quyidagi 6-8-bandlarda keltirilgan.',
      },
      {
        heading: '5. Foydalanuvchi huquqlari',
        body: 'Siz istalgan vaqtda shaxsiy ma\'lumotlaringizni ko\'rish, tuzatish yoki o\'chirishni so\'rashingiz mumkin va biz buni tezkor ko\'rib chiqamiz.',
      },
      {
        heading: '6. Matbuot targ\'iboti uchun ommaviy axborot vositalari aloqa ma\'lumotlarini qayta ishlash',
        body: 'Studio NOL musiqa relizlarini targ\'ib qilish uchun nashrlar, ommaviy axborot vositalari, teleradiokanallar va musiqa distributorlari o\'zlari oshkor qilgan ish aloqa manzillarini (tahririyat, xabar berish, maqola qabul qilish kanallari va shu kabilar) yig\'adi va press-relizlar yuboradi. Ular faqat ma\'lumotlar subyekti oshkor qilgan doirada ishlatiladi va shaxslar shaxsiy maqsadda foydalanadigan manzillar yig\'ilmaydi. Manzilni qayerdan olganimizni yuboradigan xatimizda ko\'rsatamiz, so\'rasangiz aniq manbani alohida ma\'lum qilamiz.',
      },
      {
        heading: '7. Ommaviy axborot vositalari aloqa ma\'lumotlaridan voz kechish va saqlash muddati',
        body: 'Agar xat olishni istamasligingizni bildirsangiz, sizni darhol yuborish ro\'yxatidan chiqaramiz va bundan keyin hech qanday kampaniyada qayta yubormaymiz. Bu chiqarish yozuvi va yuborish yozuvi bir xil xat ikki marta ketmasligi uchun saqlanadi - yozuv o\'chirilsa, xat qayta yuboriladi.',
      },
      {
        heading: '8. Ommaviy axborot vositalari aloqa ma\'lumotlarini uchinchi tomonga berish',
        body: 'Yig\'ilgan ommaviy axborot vositalari aloqa ma\'lumotlari hech qanday holatda uchinchi tomonlarga berilmaydi. Targ\'ibotni buyurtma qilgan mijozga beriladigan natija hisobotida ham shaxslarning ismi va email manzili ko\'rsatilmaydi; yuridik shaxs va tashkilot bo\'lgan nashrlar ommaviy domen bilan, alohida jurnalist va tanqidchilar esa faqat kishilar soni bilan qayd etiladi.',
      },
    ],
  },
};

const PrivacyPolicyPage: NextPage<PrivacyPolicyProps> = ({ locale }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const policyCopy = POLICY_COPY_BY_LOCALE[locale] || POLICY_COPY_BY_LOCALE.ko;

  return (
    <>
      <SEO
        locale={locale}
        title={`${policyCopy.title} | ${siteConfig.name}`}
        description={policyCopy.subtitle}
        robots="noindex, follow"
        canonical={`/${locale}/privacy-policy`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('footer.privacy'), path: `/${locale}/privacy-policy` },
        ]}
      />

      <Section variant="default">
        <div className="max-w-4xl mx-auto">
          <h1 className="typo-section-title mb-4 text-gray-900 dark:text-white">{policyCopy.title}</h1>
          <p className="typo-card-body text-gray-700 dark:text-gray-300 mb-2">{policyCopy.subtitle}</p>
          <p className="typo-card-meta text-gray-500 dark:text-gray-400 mb-8">
            {policyCopy.lastUpdatedLabel}: {policyCopy.lastUpdatedValue}
          </p>

          <div className="space-y-6">
            {policyCopy.sections.map((section) => (
              <article key={section.heading} className="glass-card rounded-xl p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                <p className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed">{section.body}</p>
                {section.items && (
                  <ul className="typo-card-body mt-3 list-disc space-y-1 pl-5 text-gray-700 dark:text-gray-300 leading-relaxed">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {section.processors && (
                  /* 표는 좁은 화면에서 가로 스크롤로 넘긴다 — 본문이 가로로 밀리면 안 된다. */
                  <div className="mt-3 overflow-x-auto">
                    <table className="typo-card-body w-full min-w-[32rem] border-collapse text-left text-gray-700 dark:text-gray-300">
                      <thead>
                        <tr className="border-b border-gray-300 dark:border-gray-600">
                          <th scope="col" className="py-2 pr-4 font-semibold">수탁자</th>
                          <th scope="col" className="py-2 pr-4 font-semibold">위탁 업무</th>
                          <th scope="col" className="py-2 font-semibold">위탁 항목</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.processors.map((row) => (
                          <tr key={row.name} className="border-b border-gray-200/70 last:border-0 dark:border-gray-700/70">
                            <td className="py-2 pr-4 align-top font-medium text-gray-900 dark:text-white">{row.name}</td>
                            <td className="py-2 pr-4 align-top">{row.purpose}</td>
                            <td className="py-2 align-top">{row.items}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps = async ({ params }) =>
  buildPageStaticProps(params?.locale, {}, { revalidate: 86400, i18nSections: [] });

export default PrivacyPolicyPage;
