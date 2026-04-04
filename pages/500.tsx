import type { NextPage } from 'next';
import Link from 'next/link';
import { m } from 'framer-motion';
import SEO from '../components/SEO';
import { Section } from '../components/ui/Section';
import { PAGE_TITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';

const ServerErrorPage: NextPage = () => {
  return (
    <Section variant="default" className="min-h-[60vh] flex flex-col justify-center text-center">
      <SEO
        title="Server Error | Studio NOL"
        description="500 Internal Server Error"
        robots="noindex, nofollow"
        disableCanonicalAndAlternates
      />

      <m.h1
        className="text-heading-1 font-title mb-6"
        {...PAGE_TITLE_ANIMATION}
      >
        500
      </m.h1>

      <m.p
        className="typo-section-lead max-w-2xl mx-auto mb-10 text-gray-600 dark:text-gray-300"
        {...PAGE_CONTENT_ANIMATION}
      >
        An unexpected error occurred. Please try again later.
      </m.p>

      <m.div
        className="flex items-center justify-center"
        {...PAGE_CONTENT_ANIMATION}
        transition={{ ...PAGE_CONTENT_ANIMATION.transition, delay: 0.6 }}
      >
        <Link
          href="/ko"
          className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors duration-300 typo-button shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
        >
          Go Home
        </Link>
      </m.div>
    </Section>
  );
};

export default ServerErrorPage;
