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
        body: '문의 양식을 통해 이름, 연락처, 이메일, 문의 내용을 수집할 수 있습니다.',
      },
      {
        heading: '2. 개인정보 이용 목적',
        body: '수집한 정보는 문의 답변, 예약 안내, 서비스 상담 및 고객 요청 처리 목적으로만 사용합니다.',
      },
      {
        heading: '3. 보유 및 이용 기간',
        body: '문의·상담으로 수집한 개인정보는 상담 완료 후 지체 없이 파기합니다. 펀딩 후원으로 수집한 개인정보의 보유 기간은 아래 8항을 따르며, 법령에 보관 의무가 있는 기록은 해당 기간 동안 보관합니다.',
      },
      {
        heading: '4. 제3자 제공 및 처리위탁',
        body: '원칙적으로 개인정보를 외부에 제공하지 않으며, 서비스 운영에 필요한 최소 범위에서만 관련 법령을 준수하여 처리합니다.',
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
        body: 'We do not provide personal data to third parties in principle, and process only the minimum scope required to operate services lawfully.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
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
        body: '原则上我们不会向外部提供个人信息，仅在服务运营所必需的最小范围内并依法处理。',
      },
      {
        heading: '5. 用户权利',
        body: '您可随时请求查阅、更正或删除个人信息，我们将及时处理。',
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
        body: 'En principio no compartimos datos personales con terceros y tratamos solo el mínimo necesario para operar el servicio conforme a la ley.',
      },
      {
        heading: '5. Derechos del usuario',
        body: 'Puede solicitar en cualquier momento acceso, corrección o eliminación de sus datos personales, y responderemos sin demoras indebidas.',
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
        body: 'Về nguyên tắc, chúng tôi không cung cấp dữ liệu cá nhân cho bên thứ ba; chỉ xử lý trong phạm vi tối thiểu cần thiết để vận hành dịch vụ đúng quy định.',
      },
      {
        heading: '5. Quyền của người dùng',
        body: 'Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa thông tin cá nhân bất cứ lúc nào, và chúng tôi sẽ xử lý sớm nhất có thể.',
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
        body: 'โดยหลักแล้วเราไม่เปิดเผยข้อมูลส่วนบุคคลให้บุคคลภายนอก และจะประมวลผลเฉพาะเท่าที่จําเป็นต่อการให้บริการตามกฎหมาย',
      },
      {
        heading: '5. สิทธิของผู้ใช้',
        body: 'คุณสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลได้ทุกเมื่อ และเราจะดําเนินการโดยเร็ว',
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
        body: 'Asosan shaxsiy ma\'lumotlar uchinchi tomonlarga berilmaydi; xizmatni qonuniy yuritish uchun zarur eng kam doirada qayta ishlanadi.',
      },
      {
        heading: '5. Foydalanuvchi huquqlari',
        body: 'Siz istalgan vaqtda shaxsiy ma\'lumotlaringizni ko\'rish, tuzatish yoki o\'chirishni so\'rashingiz mumkin va biz buni tezkor ko\'rib chiqamiz.',
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
