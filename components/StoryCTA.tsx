import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Music, Mic2, Settings, BookOpen, GraduationCap, Lightbulb, MapPin, Speaker, Clock } from 'lucide-react';
import type { Locale } from '../lib/i18n';

export type CTAType = 'recording' | 'lesson' | 'practice' | 'production';

interface StoryCTAProps {
    type?: CTAType;
    locale?: Locale;
}

const StoryCTA: React.FC<StoryCTAProps> = ({ type = 'recording', locale = 'ko' }) => {
    const t = (ko: string, en: string, zh?: string, es?: string, vi?: string, th?: string, uz?: string) => {
        if (locale === 'ko') return ko;
        if (locale === 'en') return en;
        if (locale === 'zh') return zh || en;
        if (locale === 'es') return es || en;
        if (locale === 'vi') return vi || en;
        if (locale === 'th') return th || en;
        if (locale === 'uz') return uz || en;
        return ko;
    };

    const getLink = (path: string) => `/${locale}${path}`;

    const content = {
        recording: {
            gradient: 'from-indigo-900 to-purple-900',
            accentColor: 'text-purple-200',
            accentBg: 'bg-purple-200',
            buttonBg: 'bg-white text-indigo-900 hover:bg-purple-50',
            secondaryButtonBg: 'bg-purple-700/50 text-white hover:bg-purple-700/70 border-purple-500/30',
            icons: (
                <>
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-purple-200 rounded-full" />
                    <Settings size={20} />
                    <span className="w-1 h-1 bg-purple-200 rounded-full" />
                    <Music size={20} />
                </>
            ),
            title: t("더 나은 사운드를 원하시나요?", "Want Better Sound?", "想要更好的声音吗？", "¿Quieres un mejor sonido?", "Bạn muốn âm thanh tốt hơn?", "อยากได้ซาวด์ที่ดีกว่าไหม?", "Yaxshiroq tovush xohlaysizmi?"),
            description: (
                <>
                    {t("스튜디오 놀의 전문적인 레코딩, 믹싱 서비스를 경험해보세요.", "Experience professional recording and mixing services at Studio NOL.", "体验 Studio NOL 的专业录音和混音服务。", "Experimenta los servicios profesionales de grabación y mezcla en Studio NOL.", "Hãy trải nghiệm dịch vụ thu âm và mix chuyên nghiệp tại Studio NOL.", "สัมผัสบริการบันทึกเสียงและมิกซ์ระดับมืออาชีพที่ Studio NOL", "Studio NOL’da professional yozuv va miks xizmatlarini sinab ko‘ring.")}<br className="hidden md:block" />
                    {t("최고의 장비와 노하우로 당신의 음악을 완성해드립니다.", "We complete your music with the best equipment and know-how.", "用最好的设备和经验完成您的音乐。", "Completamos tu música con el mejor equipo y experiencia.", "Chúng tôi hoàn thiện âm nhạc của bạn với thiết bị tốt nhất và kinh nghiệm chuyên môn.", "เราทำเพลงของคุณให้สมบูรณ์ด้วยอุปกรณ์ชั้นยอดและความชำนาญ", "Eng yaxshi uskunalar va tajriba bilan musiqangizni yakunlaymiz.")}
                </>
            ),
            primaryLink: getLink('/pricing'),
            primaryText: t("서비스 가격 보기", "View Pricing", "查看价格", "Ver Precios", "Xem giá dịch vụ", "ดูราคาบริการ", "Xizmat narxlarini ko‘rish"),
            secondaryLink: getLink('/contact'),
            secondaryText: t("문의하기", "Inquiry", "咨询", "Consulta", "Liên hệ", "สอบถาม", "So‘rov"),
            visualText: 'Professional Audio',
            visualGradient: 'from-purple-500 to-indigo-400',
        },
        lesson: {
            gradient: 'from-orange-800 to-amber-900',
            accentColor: 'text-amber-200',
            accentBg: 'bg-amber-200',
            buttonBg: 'bg-white text-amber-900 hover:bg-amber-50',
            secondaryButtonBg: 'bg-amber-700/50 text-white hover:bg-amber-700/70 border-amber-500/30',
            icons: (
                <>
                    <BookOpen size={20} />
                    <span className="w-1 h-1 bg-amber-200 rounded-full" />
                    <Lightbulb size={20} />
                    <span className="w-1 h-1 bg-amber-200 rounded-full" />
                    <GraduationCap size={20} />
                </>
            ),
            title: t("직접 음악을 만들고 싶으신가요?", "Want to Make Music Yourself?", "想自己制作音乐吗？", "¿Quieres crear tu propia música?", "Bạn muốn tự làm nhạc?", "อยากทำเพลงด้วยตัวเองไหม?", "Musiqani o‘zingiz yaratmoqchimisiz?"),
            description: (
                <>
                    {t("혼자 고민하지 마세요. 1:1 맞춤형 레슨으로 도와드립니다.", "Don't struggle alone. We help with 1:1 customized lessons.", "不要独自烦恼。我们提供1:1定制课程。", "No luches solo. Te ayudamos con clases personalizadas 1:1.", "Đừng lo một mình. Chúng tôi hỗ trợ với lớp học 1:1 theo nhu cầu.", "ไม่ต้องกังวลคนเดียว เราช่วยด้วยบทเรียนแบบตัวต่อตัว", "Yolg‘iz qiynalmang. Sizga 1:1 moslashtirilgan darslar bilan yordam beramiz.")}<br className="hidden md:block" />
                    {t("미디, 믹싱, 사운드 디자인까지 기초부터 탄탄하게 배워보세요.", "Learn from basics to MIDI, mixing, and sound design.", "从基础开始扎实学习 MIDI、混音、声音设计。", "Aprende desde lo básico hasta MIDI, mezcla y diseño de sonido.", "Học từ nền tảng đến MIDI, mixing và sound design một cách chắc chắn.", "เรียนตั้งแต่พื้นฐานไปจนถึง MIDI มิกซ์ และซาวด์ดีไซน์", "MIDI, miks va sound dizayngacha asoslardan puxta o‘rganing.")}
                </>
            ),
            primaryLink: getLink('/lesson'),
            primaryText: t("레슨 커리큘럼 보기", "View Curriculum", "查看课程大纲", "Ver Currículo", "Xem giáo trình", "ดูหลักสูตร", "O‘quv dasturini ko‘rish"),
            secondaryLink: getLink('/contact'),
            secondaryText: t("상담 신청하기", "Apply for Consultation", "申请咨询", "Solicitar Consulta", "Đăng ký tư vấn", "ขอคำปรึกษา", "Maslahat so‘rash"),
            visualText: 'Music Education',
            visualGradient: 'from-amber-500 to-orange-400',
        },
        practice: {
            gradient: 'from-emerald-900 to-teal-900',
            accentColor: 'text-emerald-200',
            accentBg: 'bg-emerald-200',
            buttonBg: 'bg-white text-emerald-900 hover:bg-emerald-50',
            secondaryButtonBg: 'bg-teal-700/50 text-white hover:bg-teal-700/70 border-teal-500/30',
            icons: (
                <>
                    <MapPin size={20} />
                    <span className="w-1 h-1 bg-emerald-200 rounded-full" />
                    <Clock size={20} />
                    <span className="w-1 h-1 bg-emerald-200 rounded-full" />
                    <Speaker size={20} />
                </>
            ),
            title: t("몰입할 나만의 공간이 필요한가요?", "Need Your Own Space to Focus?", "需要沉浸的专属空间吗？", "¿Necesitas tu propio espacio para concentrarte?", "Bạn cần không gian riêng để tập trung?", "ต้องการพื้นที่ส่วนตัวเพื่อโฟกัสไหม?", "Diqqat jamlash uchun o‘zingizga xos joy kerakmi?"),
            description: (
                <>
                    {t("언제든 자유롭게 이용할 수 있는 프리미엄 연습실.", "Premium practice rooms available freely anytime.", "随时可以自由使用的高级练习室。", "Salas de práctica premium disponibles libremente en cualquier momento.", "Phòng tập cao cấp có thể sử dụng tự do bất cứ lúc nào.", "ห้องซ้อมระดับพรีเมียมใช้ได้ทุกเวลา", "Istalgan vaqtda erkin foydalaniladigan premium mashg‘ulot xonalari.")}<br className="hidden md:block" />
                    {t("쾌적한 환경과 완벽한 방음 시설이 준비되어 있습니다.", "Pleasant environment and perfect soundproofing ready.", "准备了舒适的环境和完美的隔音设施。", "Ambiente agradable e insonorización perfecta listos.", "Môi trường thoải mái và cách âm hoàn hảo đã sẵn sàng.", "สภาพแวดล้อมสบายและระบบกันเสียงที่สมบูรณ์พร้อม", "Qulay muhit va mukammal ovoz izolyatsiyasi tayyor.")}
                </>
            ),
            primaryLink: getLink('/practice-room'),
            primaryText: t("연습실 시설 보기", "View Facilities", "查看设施", "Ver Instalaciones", "Xem cơ sở vật chất", "ดูสิ่งอำนวยความสะดวก", "Jihozlarni ko‘rish"),
            secondaryLink: getLink('/contact'),
            secondaryText: t("예약 문의하기", "Inquiry", "预约咨询", "Consulta de Reserva", "Hỏi về đặt chỗ", "สอบถามการจอง", "Bron bo‘yicha so‘rov"),
            visualText: 'Creative Space',
            visualGradient: 'from-emerald-500 to-teal-400',
        },
        production: {
            gradient: 'from-blue-900 to-indigo-900',
            accentColor: 'text-blue-200',
            accentBg: 'bg-blue-200',
            buttonBg: 'bg-white text-blue-900 hover:bg-blue-50',
            secondaryButtonBg: 'bg-indigo-700/50 text-white hover:bg-indigo-700/70 border-indigo-500/30',
            icons: (
                <>
                    <Music size={20} />
                    <span className="w-1 h-1 bg-blue-200 rounded-full" />
                    <Mic2 size={20} />
                    <span className="w-1 h-1 bg-blue-200 rounded-full" />
                    <Settings size={20} />
                </>
            ),
            title: t("나만의 음원을 제작하고 싶으신가요?", "Want to Produce Your Own Music?", "想制作自己的音源吗？", "¿Quieres producir tu propia música?", "Bạn muốn sản xuất bản thu của riêng mình?", "อยากทำเพลงของตัวเองไหม?", "O‘zingizning treklaringizni yaratmoqchimisiz?"),
            description: (
                <>
                    {t("작곡, 편곡부터 믹싱, 마스터링까지.", "From composition, arrangement to mixing, mastering.", "从作曲、编曲到混音、母带。", "Desde la composición y arreglo hasta la mezcla y masterización.", "Từ sáng tác, hòa âm đến mix và mastering.", "ตั้งแต่แต่งเพลง เรียบเรียง ไปจนถึงมิกซ์และมาสเตอริ่ง", "Kompozitsiya va aranjimandan miks va masteringgacha.")}<br className="hidden md:block" />
                    {t("당신의 아이디어를 완성된 음원으로 만들어드립니다.", "We turn your ideas into finished tracks.", "将您的想法变成完成的音源。", "Convertimos tus ideas en pistas terminadas.", "Chúng tôi biến ý tưởng của bạn thành bản nhạc hoàn chỉnh.", "เราจะทำไอเดียของคุณให้เป็นเพลงที่เสร็จสมบูรณ์", "G‘oyalaringizni yakunlangan trekka aylantiramiz.")}
                </>
            ),
            primaryLink: getLink('/contact'),
            primaryText: t("음원 제작 상담하기", "Production Inquiry", "音源制作咨询", "Consulta de Producción", "Tư vấn sản xuất", "ปรึกษางานผลิตเพลง", "Prodakshn bo‘yicha so‘rov"),
            secondaryLink: getLink('/pricing'),
            secondaryText: t("제작 비용 보기", "View Cost", "查看费用", "Ver Costos", "Xem chi phí", "ดูค่าใช้จ่าย", "Narxlarni ko‘rish"),
            visualText: 'Music Production',
            visualGradient: 'from-blue-500 to-indigo-400',
        }
    };

    const current = content[type];
    const heights = [40, 70, 50, 90, 60, 80, 40, 60];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={`my-16 relative overflow-hidden rounded-2xl bg-gradient-to-br ${current.gradient} text-white shadow-xl`}
        >
            {/* Background Decor */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-8">
                <div className="flex-1 text-center md:text-left">
                    <div className={`flex items-center justify-center md:justify-start gap-3 mb-4 ${current.accentColor}`}>
                        {current.icons}
                    </div>

                    <h3 className={`text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200`}>
                        {current.title}
                    </h3>

                    <p className="text-white/90 text-lg leading-relaxed mb-6">
                        {current.description}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                        <Link
                            href={current.primaryLink}
                            className={`inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-black/20 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 ${current.buttonBg}`}
                        >
                            <span className="min-w-0">{current.primaryText}</span>
                            <ArrowRight size={18} className="ml-2 flex-shrink-0" />
                        </Link>
                        <Link
                            href={current.secondaryLink}
                            className={`inline-flex items-center justify-center w-full sm:w-auto text-center whitespace-normal leading-snug min-h-[44px] px-6 py-3 rounded-xl font-medium transition-colors backdrop-blur-sm border touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 ${current.secondaryButtonBg}`}
                        >
                            <span className="min-w-0">{current.secondaryText}</span>
                        </Link>
                    </div>
                </div>

                <div className="hidden md:block w-full max-w-xs lg:max-w-sm">
                    {/* Abstract Visual Representation */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 p-6 flex flex-col justify-center items-center">
                        <div className="w-full flex justify-between items-end h-32 gap-2 mb-4">
                            {heights.map((h, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ height: '20%' }}
                                    whileInView={{ height: `${h}%` }}
                                    transition={{
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        duration: 1.5,
                                        delay: i * 0.1
                                    }}
                                    className={`flex-1 bg-gradient-to-t ${current.visualGradient} rounded-t-sm opacity-80`}
                                />
                            ))}
                        </div>
                        <p className={`text-sm font-mono ${current.accentColor}`}>{current.visualText}</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default StoryCTA;
