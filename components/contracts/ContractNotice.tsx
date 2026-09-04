import React from 'react';

/**
 * 계약 페이지에서 "문서를 보여줄 수 없다"를 알리는 화면.
 *
 * 사이트 공용 404를 쓰지 않는 이유: 여기 오는 사람은 대부분 계약 당사자다. 재발송으로
 * 무효가 된 옛 링크를 눌렀거나, 하필 DB가 흔들렸거나, 메일에 몇 년 남아 있던 링크를
 * 이제야 눌렀을 뿐이다. 마케팅 톤의 "페이지를 찾을 수 없습니다"를 보면 자기가 잘못한
 * 줄 알고 헤매게 된다 — 무엇이 일어났고 어디로 연락하면 되는지 계약 맥락으로 말한다.
 *
 * sign.tsx에만 있던 것을 complete.tsx와 함께 쓰려고 꺼냈다. 같은 고객이 같은 링크로
 * 두 페이지를 오가는데 한쪽만 안내를 하고 다른 쪽은 맨 404를 띄우고 있었다.
 */
const ContractNotice = ({ title, description }: { title: string; description: string }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-50 flex items-center justify-center px-4">
    <div className="bg-white dark:bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-900 mb-3">{title}</h1>
      <p className="text-gray-600 dark:text-gray-600 leading-relaxed">{description}</p>
      <p className="text-sm text-gray-400 dark:text-gray-400 mt-6">
        문의: 스튜디오 놀 010-4255-7893
      </p>
    </div>
  </div>
);

export default ContractNotice;
