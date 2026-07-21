import React from 'react';
import { type Locale } from '../../lib/i18n';

interface SessionChecklistProps {
  locale?: Locale;
}

const SessionChecklist: React.FC<SessionChecklistProps> = () => {
  return (
    <div className="my-8 rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
          출발 전 챙길 것
        </h4>
      </div>
      <div className="px-6 py-4 grid sm:grid-cols-2 gap-6">
        <div>
          <ul className="space-y-2">
            {[
              '녹음할 곡의 가사·악보·MR 파일 (USB 또는 Google Drive)',
              '원하는 사운드의 레퍼런스 트랙 2~3곡',
              '예약 확인 문자·카카오톡 캡처',
              '충분한 수분 (물 500ml 이상)',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-0.5 text-primary" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            세션 효율을 높이는 팁
          </p>
          <ul className="space-y-2">
            {[
              '도착 후 15~20분은 스튜디오에서 목·악기 워밍업',
              '가장 중요한 구간을 세션 초반에 먼저 녹음 (피로 전)',
              '원하는 사운드를 엔지니어에게 레퍼런스 곡으로 공유',
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-0.5 text-amber-500" aria-hidden="true">→</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SessionChecklist;
