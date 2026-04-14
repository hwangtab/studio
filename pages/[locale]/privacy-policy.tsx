import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { Section } from '../../components/ui/Section';
import { getSiteConfig } from '../../data/siteConfig';
import { buildPageStaticProps, getCommonStaticPaths } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface PrivacyPolicyProps {
  locale: Locale;
}

type PolicySection = {
  heading: string;
  body: string;
};

type PolicyCopy = {
  title: string;
  subtitle: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  sections: PolicySection[];
};

const POLICY_COPY_BY_LOCALE: Record<Locale, PolicyCopy> = {
  ko: {
    title: '개인정보 처리방침',
    subtitle: '스튜디오 놀은 문의 접수 및 상담 응대에 필요한 최소한의 개인정보만 수집하고 안전하게 관리합니다.',
    lastUpdatedLabel: '시행일',
    lastUpdatedValue: '2026년 2월 12일',
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
        body: '개인정보는 상담 완료 후 지체 없이 파기하며, 관련 법령에 보관 의무가 있는 경우에만 해당 기간 동안 보관합니다.',
      },
      {
        heading: '4. 제3자 제공 및 처리위탁',
        body: '원칙적으로 개인정보를 외부에 제공하지 않으며, 서비스 운영에 필요한 최소 범위에서만 관련 법령을 준수하여 처리합니다.',
      },
      {
        heading: '5. 이용자의 권리',
        body: '정보주체는 언제든지 개인정보 열람, 정정, 삭제를 요청할 수 있으며, 요청 시 지체 없이 조치합니다.',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'Studio NOL collects only the minimum personal data required for inquiries and consultation support.',
    lastUpdatedLabel: 'Effective date',
    lastUpdatedValue: 'February 12, 2026',
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
        body: 'Personal data is deleted without delay after consultation is completed, except where retention is required by applicable law.',
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
    lastUpdatedValue: '2026年2月12日',
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
        body: '个人信息在咨询完成后将及时删除；如法律法规另有保存要求，则按规定期限保存。',
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
    title: 'Politica de privacidad',
    subtitle: 'Studio NOL recopila solo los datos personales minimos necesarios para responder consultas y brindar orientacion.',
    lastUpdatedLabel: 'Fecha de entrada en vigor',
    lastUpdatedValue: '12 de febrero de 2026',
    sections: [
      {
        heading: '1. Datos personales que recopilamos',
        body: 'Mediante el formulario de contacto podemos recopilar nombre, telefono, correo electronico y contenido del mensaje.',
      },
      {
        heading: '2. Finalidad del uso',
        body: 'Los datos recopilados se usan solo para responder consultas, apoyar reservas, brindar orientacion y gestionar solicitudes del cliente.',
      },
      {
        heading: '3. Periodo de conservacion',
        body: 'Los datos personales se eliminan sin demora tras finalizar la atencion, salvo que la ley exija su conservacion.',
      },
      {
        heading: '4. Cesion a terceros y tratamiento encargado',
        body: 'En principio no compartimos datos personales con terceros y tratamos solo el minimo necesario para operar el servicio conforme a la ley.',
      },
      {
        heading: '5. Derechos del usuario',
        body: 'Puede solicitar en cualquier momento acceso, correccion o eliminacion de sus datos personales, y responderemos sin demoras indebidas.',
      },
    ],
  },
  vi: {
    title: 'Chinh sach bao mat',
    subtitle: 'Studio NOL chi thu thap toi thieu thong tin ca nhan can thiet de tiep nhan va phan hoi tu van.',
    lastUpdatedLabel: 'Ngay hieu luc',
    lastUpdatedValue: '12 thang 2, 2026',
    sections: [
      {
        heading: '1. Thong tin ca nhan duoc thu thap',
        body: 'Thong qua form lien he, chung toi co the thu thap ho ten, so dien thoai, email va noi dung yeu cau.',
      },
      {
        heading: '2. Muc dich su dung',
        body: 'Thong tin thu thap chi duoc dung de phan hoi yeu cau, ho tro dat lich, tu van dich vu va xu ly de nghi cua khach hang.',
      },
      {
        heading: '3. Thoi gian luu tru',
        body: 'Thong tin ca nhan se duoc xoa ngay sau khi hoan tat tu van, tru truong hop phap luat yeu cau luu tru.',
      },
      {
        heading: '4. Cung cap cho ben thu ba va uy quyen xu ly',
        body: 'Ve nguyen tac, chung toi khong cung cap du lieu ca nhan cho ben thu ba; chi xu ly trong pham vi toi thieu can thiet de van hanh dich vu dung quy dinh.',
      },
      {
        heading: '5. Quyen cua nguoi dung',
        body: 'Ban co the yeu cau truy cap, chinh sua hoac xoa thong tin ca nhan bat cu luc nao, va chung toi se xu ly som nhat co the.',
      },
    ],
  },
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    subtitle: 'Studio NOL เก็บข้อมูลส่วนบุคคลเท่าที่จําเป็นสําหรับการรับและตอบคําสอบถามเท่านั้น',
    lastUpdatedLabel: 'วันที่มีผลบังคับใช้',
    lastUpdatedValue: '12 กุมภาพันธ์ 2026',
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
        body: 'ข้อมูลส่วนบุคคลจะถูกลบโดยไม่ชักช้าหลังเสร็จสิ้นการให้คําปรึกษา ยกเว้นกรณีที่กฎหมายกําหนดให้ต้องเก็บรักษา',
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
    lastUpdatedValue: '2026-yil 12-fevral',
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
        body: 'Shaxsiy ma\'lumotlar maslahat yakunlangach kechiktirmasdan o\'chiriladi, qonun talab qilgan holatlar bundan mustasno.',
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
        title={`${policyCopy.title} | ${siteConfig.name}`}
        description={policyCopy.subtitle}
        robots="noindex, follow"
        canonical={`/${locale}/privacy-policy`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('footer.privacy'), path: `/${locale}/privacy-policy` },
        ]}
      />

      <Section variant="default" className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="typo-section-title mb-4 text-gray-900 dark:text-white">{policyCopy.title}</h1>
          <p className="typo-card-body text-gray-700 dark:text-gray-300 mb-2">{policyCopy.subtitle}</p>
          <p className="typo-card-meta text-gray-500 dark:text-gray-400 mb-8">
            {policyCopy.lastUpdatedLabel}: {policyCopy.lastUpdatedValue}
          </p>

          <div className="space-y-6">
            {policyCopy.sections.map((section) => (
              <article key={section.heading} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="typo-card-title mb-2 text-gray-900 dark:text-white">{section.heading}</h2>
                <p className="typo-card-body text-gray-700 dark:text-gray-300 leading-relaxed">{section.body}</p>
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
  buildPageStaticProps(params?.locale, {}, { revalidate: 86400 });

export default PrivacyPolicyPage;
