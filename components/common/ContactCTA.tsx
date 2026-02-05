import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage';
import SectionHeading from '../ui/SectionHeading';
import type { Locale } from '../../lib/i18n';

interface ContactCTAProps {
    className?: string;
    locale?: Locale;
}

const ContactCTA = ({ className = "", locale = 'ko' }: ContactCTAProps) => {
    const isKo = locale === 'ko';
    
    // Simple translation helper
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

    return (
        <motion.div
            className={`mt-16 overflow-hidden rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 ${className}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
        >
            <div className="grid md:grid-cols-2 items-stretch min-h-[400px]">
                <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20 p-8 md:p-12 flex flex-col justify-center">
                    <SectionHeading
                        icon={Sparkles}
                        title={
                            <>
                                {t("당신의 소중한 음악,", "Your Precious Music,", "您珍贵的音乐，", "Tu Preciada Música,", "Âm nhạc quý giá của bạn,", "ดนตรีล้ำค่าของคุณ,", "Qadrli musiqangiz,")}<br />
                                <span className="text-primary">{t("최상의 사운드로", "With the Best Sound", "以最佳音质", "Con el Mejor Sonido", "Với âm thanh tốt nhất", "ด้วยซาวด์ที่ดีที่สุด", "Eng yaxshi ovoz bilan")}</span>
                            </>
                        }
                        subtitle={
                            <>
                                {t("검증된 장비와 전문 엔지니어의 노하우로 최선의 결과물을 약속합니다.", "We promise the best results with verified equipment and expert know-how.", "凭借经过验证的设备和专业工程师的经验，承诺最佳结果。", "Prometemos los mejores resultados con equipos verificados y conocimientos expertos.", "Chúng tôi cam kết kết quả tốt nhất với thiết bị đã được kiểm chứng và kinh nghiệm chuyên môn.", "เรารับประกันผลลัพธ์ที่ดีที่สุดด้วยอุปกรณ์ที่ผ่านการพิสูจน์และความชำนาญของวิศวกร", "Tekshirilgan uskunalar va mutaxassis tajribasi bilan eng yaxshi natijani kafolatlaymiz.")}<br className="hidden md:block" />
                                {t("지금 바로 방문 상담을 예약하고 스튜디오를 둘러보세요.", "Book a consultation now and tour the studio.", "立即预约访问咨询并参观工作室。", "Reserva una consulta ahora y recorre el estudio.", "Đặt lịch tư vấn ngay và tham quan studio.", "จองปรึกษาและเยี่ยมชมสตูดิโอได้เลย", "Hozir maslahat vaqtini band qiling va studiyani ko‘ring.")}
                            </>
                        }
                        align="left"
                        className="mb-8"
                    />
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            href={getLink("/contact")}
                            className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600"
                        >
                            {t("오시는 길", "Location", "位置", "Ubicación", "Đường đi", "ที่ตั้ง", "Manzil")}
                        </Link>
                        <a
                            href="https://open.kakao.com/me/nol"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                        >
                            <MessageCircle className="mr-2" size={20} />
                            {t("카카오톡 문의하기", "Inquiry", "KakaoTalk 咨询", "Consulta por KakaoTalk", "Liên hệ qua KakaoTalk", "สอบถามผ่าน KakaoTalk", "KakaoTalk orqali so‘rov")}
                        </a>
                    </div>
                </div>

                <a
                    href="https://open.kakao.com/me/nol"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer"
                >
                    <ResponsiveImage
                        src="/images/studio2.jpg"
                        alt="Studio NOL Control Room"
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        pictureClassName="block h-full"
                        loading="lazy"
                        sizes="(min-width: 768px) 50vw, 100vw"
                        fill
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                </a>
            </div>
        </motion.div>
    );
};

export default ContactCTA;
