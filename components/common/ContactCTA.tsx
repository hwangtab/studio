import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage';
import SectionHeading from '../ui/SectionHeading';

interface ContactCTAProps {
    className?: string;
}

const ContactCTA = ({ className = "" }: ContactCTAProps) => {
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
                                당신의 소중한 음악,<br />
                                <span className="text-primary">최상의 사운드로</span>
                            </>
                        }
                        subtitle={
                            <>
                                검증된 장비와 전문 엔지니어의 노하우로 최선의 결과물을 약속합니다.<br className="hidden md:block" />
                                지금 바로 방문 상담을 예약하고 스튜디오를 둘러보세요.
                            </>
                        }
                        align="left"
                        className="mb-8"
                    />
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-600"
                        >
                            오시는 길
                        </Link>
                        <a
                            href="https://open.kakao.com/me/nol"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all duration-300"
                        >
                            <MessageCircle className="mr-2" size={20} />
                            카카오톡 문의하기
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
                        alt="스튜디오 놀 메인 컨트롤 룸"
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
