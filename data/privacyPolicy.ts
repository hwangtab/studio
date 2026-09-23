/**
 * 개인정보 처리방침 정본 — 7개 로케일 본문과 수탁자 표.
 *
 * 왜 페이지가 아니라 여기 있는가: 이 데이터를 읽는 곳이 처리방침 페이지 하나가 아니다.
 * 펀딩 약관 페이지가 §13에서 참조할 항 제목을 끌어가고, content/fundingTermsHash.ts가
 * 후원자 동의 문서의 내용 해시를 계산한다. 정본이 페이지 모듈에 있으면 그 두 소비처가
 * 처리방침 **페이지 전체**(7개 로케일 본문 + SEO·레이아웃 컴포넌트)를 번들로 끌고 들어온다 —
 * 약관 페이지 First Load가 그만큼 불어났고, lib/funding/policy.ts가 같은 이유로 적어 둔
 * 저장소 규칙("페이지 모듈에 두면 서버 함수가 React 페이지를 끌고 들어온다")과도 어긋난다.
 *
 * **문구를 고칠 때 주의**: ko 본문과 수탁자 표는 펀딩 약관 해시 게이트의 대상이다.
 * 내용을 바꾸면 lib/funding/policy.ts의 FUNDING_TERMS_VERSION을 **먼저** 올린 뒤
 * `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`로
 * 기준선을 다시 쓴다. 순서를 뒤집으면 갱신 경로가 스스로 거부한다.
 */
import { CANONICAL_FACTS } from '../lib/factTokens';
import { CUSTOMER_REPLY_TO } from '../lib/operatorContact';
import {
  type DataProcessorRow,
  FUNDING_COLLECTED_ITEMS,
  FUNDING_COLLECTION_PURPOSES,
  FUNDING_CREATOR_DATA_PROCESSORS,
  FUNDING_DATA_PROCESSORS,
  PRIVACY_LEGAL_RETENTION_TEXT,
  PRIVACY_RETENTION_TEXT,
} from '../lib/funding/policy';
import { studioOperator } from './siteConfig';
import type { Locale } from '../lib/i18n';

type PolicySection = {
  heading: string;
  body: string;
  /** 본문 아래 목록. 수집 항목·이용 목적처럼 열거가 본문보다 읽기 쉬운 곳에만 쓴다. */
  items?: readonly string[];
  /** 수탁자 표. 개인정보보호법 제26조 고지 형식(수탁자·업무·항목)에 국가를 더했다. */
  processors?: ReadonlyArray<DataProcessorRow>;
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
 *   Resend        lib/booking/email.ts → lib/email/resend.ts, pages/api/contact/send-email.ts,
 *                 pages/api/inbound/resend.ts(hello@ 수신 메일을 운영자 Gmail로 전달)
 *   Vercel        vercel.json · data/siteConfig.ts hostingProvider
 *   Turso(libsql) db/client.ts — orders·bookings·work_orders 영속
 *   Google LLC    lib/booking/gcal.ts — 확정 시 캘린더 이벤트 생성.
 *                 lib/booking/confirm.ts가 이벤트 본문에 고객 이름·전화·이메일·요청사항을 담는다.
 *   토스페이먼츠   components/booking/TossPaymentWidget.tsx(customerName·customerEmail) · lib/booking/toss.ts
 *
 * 형식은 9항(FUNDING_DATA_PROCESSORS)과 같은 수탁자·업무·항목 3열을 쓴다. 위탁이 늘거나
 * 줄면 여기부터 고칠 것 — 4항 본문이 "아래와 같이"라고 단언하므로 표가 곧 사실 주장이다.
 */
export const SERVICE_DATA_PROCESSORS: ReadonlyArray<DataProcessorRow> = [
  { name: 'Resend', country: '미국', purpose: '문의 접수 알림 메일(스튜디오 앞) 발송, 예약·주문 확정·취소 안내 메일 발송, hello@ 수신 메일의 운영자 전달', items: '이름, 연락처, 이메일 주소, 문의 내용, 예약·주문 내역, hello@ 수신 메일 본문·첨부파일' },
  { name: 'Vercel', country: '미국', purpose: '웹사이트·문의 접수·예약 처리 서버 호스팅', items: '문의·예약 과정에서 전송되는 위 항목 전부' },
  { name: 'Turso', country: '미국', purpose: '예약·주문 기록 데이터베이스 보관', items: '이름, 연락처, 이메일 주소, 예약 일시·상품·요청사항, 결제·환불 처리 기록' },
  { name: 'Google LLC', country: '미국', purpose: '확정된 예약의 일정 관리(구글 캘린더 이벤트 생성·삭제)', items: '이름, 연락처, 이메일 주소, 예약 일시·상품·요청사항, 주문번호' },
  { name: '토스페이먼츠', country: '대한민국', purpose: '예약 결제 승인·취소·환불 처리', items: '이름, 이메일 주소, 주문번호, 결제 금액·결제수단 정보' },
];

/**
 * 개인정보 보호책임자 — 개인정보 보호법 제30조①6호의 필수 기재사항.
 *
 * 값을 문자열로 박지 않는다. 이름은 `data/siteConfig.ts`의 운영자, 전화는
 * `lib/factTokens.js`의 회전 사실(0507→010 전환 때 180개 파일을 고친 그 값), 접수 메일은
 * `lib/operatorContact.ts`가 정본이다. 셋 중 하나가 바뀌면 이 항도 함께 움직여야 한다 —
 * 처리방침에 적힌 연락처가 닿지 않으면 권리 행사 창구가 없는 것과 같다.
 *
 * 이 값은 ko 처리방침 본문에 보간되므로 **후원자 동의 문서의 해시 대상**이다. 바꾸면
 * `FUNDING_TERMS_VERSION`을 먼저 올린 뒤 기준선을 다시 써야 한다.
 */
export const PRIVACY_OFFICER = {
  name: studioOperator.name,
  role: '스튜디오 놀 운영자',
  email: CUSTOMER_REPLY_TO,
  phone: CANONICAL_FACTS.phone,
} as const;

/** 테스트(tests/pages/privacy-policy.test.tsx)가 로케일 간 모순을 검사하므로 export한다. */
export const POLICY_COPY_BY_LOCALE: Record<Locale, PolicyCopy> = {
  ko: {
    title: '개인정보 처리방침',
    subtitle: '스튜디오 놀은 문의·상담 응대와 펀딩(리워드 선주문) 처리에 필요한 최소한의 개인정보만 수집하고 안전하게 관리합니다.',
    lastUpdatedLabel: '시행일',
    lastUpdatedValue: '2026년 9월 23일',
    sections: [
      {
        heading: '1. 수집하는 개인정보 항목',
        body: '문의 양식을 통해 이름, 연락처, 이메일, 문의 내용을 수집할 수 있습니다. 예약·결제 신청 화면에서는 이름, 연락처, 이메일 주소, 예약 일시·상품, 요청사항과 결제 처리 기록(주문번호, 결제 금액·결제수단)을 수집합니다. 펀딩(리워드 선주문)의 수집 항목은 아래 6항이, 펀딩 프로젝트를 개설하는 아티스트(이하 “개설자”)의 수집 항목은 아래 13항이 따로 정합니다.',
      },
      {
        heading: '2. 개인정보 이용 목적',
        body: '수집한 정보는 문의 답변, 예약 접수·확정·변경·취소 안내, 결제와 환불 처리, 서비스 상담 및 고객 요청 처리 목적으로만 사용합니다.',
      },
      {
        heading: '3. 보유 및 이용 기간',
        body: `문의·상담으로 수집한 개인정보는 상담 완료 후 지체 없이 파기합니다. 예약·결제 기록은 ${PRIVACY_LEGAL_RETENTION_TEXT} 펀딩으로 수집한 개인정보의 보유 기간은 아래 8항을 따릅니다.`,
      },
      {
        heading: '4. 제3자 제공 및 처리위탁',
        body: '개인정보를 제3자에게 제공하지 않습니다. 다만 문의·상담과 예약·결제 처리에 필요한 범위에서 아래와 같이 개인정보 처리를 위탁하고 있으며, 수탁자가 바뀌면 이 처리방침으로 알립니다. 표의 ‘사업자 소재 국가’는 수탁자가 어느 나라 사업자인지를 밝힌 것입니다. 펀딩(리워드 선주문) 처리의 위탁 현황은 아래 9항이, 언론 홍보 업무의 매체 연락처는 아래 10~12항이, 개설자 계정 정보는 아래 13~15항이, 요청 제한 기록은 아래 16항이 따로 정합니다.',
        processors: SERVICE_DATA_PROCESSORS,
      },
      // 5항은 개인정보 보호법 제30조①5호가 요구하는 "정보주체와 법정대리인의 권리·의무 및
      // 행사방법"이다. 예전엔 "열람, 정정, 삭제" 한 줄이라 제37조(처리정지·동의 철회)가 빠져
      // 있었고, 어디로 접수하는지도 없었다 — 권리를 적어 두고 행사할 길을 안 적으면 그 항은
      // 요건을 채우지 못한다. 예외(제36조 단서·제37조②4호)는 사실대로 함께 적는다.
      {
        heading: '5. 정보주체와 법정대리인의 권리·의무 및 행사방법',
        body:
          '정보주체는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요구할 수 ' +
          '있고, 동의를 받아 처리하는 개인정보는 그 동의를 철회할 수 있습니다. 법정대리인도 ' +
          '정보주체를 대리하여 같은 권리를 행사할 수 있습니다. 요청은 아래 17항의 개인정보 ' +
          '보호책임자에게 접수하며, 접수하면 지체 없이 확인해 조치한 뒤 그 결과를 알려드립니다.',
        items: [
          '접수 창구 — 아래 17항의 이메일 또는 전화. 요청하신 분이 정보주체 본인이거나 정당한 대리인인지 확인할 수 있는 범위에서 처리하며, 확인이 어려우면 확인에 필요한 사항을 여쭙습니다',
          '처리 절차 — 접수한 요청은 지체 없이 확인해 열람·정정·삭제·처리정지 조치를 하고, 조치하거나 거절한 사실과 그 사유를 요청하신 분께 알려드립니다',
          '삭제 요구의 예외 — 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 삭제를 요구하실 수 없습니다(개인정보 보호법 제36조). 위 3항·8항의 거래기록처럼 법정 보존 대상인 기록이 여기에 해당하며, 그런 기록은 보존 기간이 지난 뒤 파기합니다',
          '처리정지 요구의 거절 — 정보주체와 맺은 계약을 이행하기 곤란한 경우로서 정보주체가 그 계약의 해지 의사를 명확하게 밝히지 않은 때에는 처리정지 요구를 거절할 수 있습니다(같은 법 제37조제2항제4호). 거절하는 경우 그 사유를 알려드립니다',
          '동의 철회 — 철회하시면 그 동의에 근거한 처리를 멈춥니다. 다만 펀딩·예약처럼 이미 성립한 계약의 이행과 법정 보존 대상 기록은 철회로 사라지지 않으며, 그 기록은 위 3항·8항의 기간 동안 남습니다',
          '불복 — 조치 결과에 이의가 있으시면 개인정보분쟁조정위원회에 분쟁조정을 신청하거나 개인정보침해신고센터에 신고하실 수 있습니다',
        ],
      },
      // 6~9항은 펀딩(리워드 선주문) 전용이다. 펀딩 신청 화면의 동의 체크박스 하나가 펀딩 약관과
      // 이 처리방침을 함께 동의받으므로, 두 문서의 보유기간·수집 항목이 어긋나면 그 동의가 무효가 된다.
      // 보유기간·법정 보존 문구는 lib/funding/policy.ts의 상수를 약관(제13조)과 함께 쓴다(복제 금지).
      {
        heading: '6. 펀딩(리워드 선주문) 수집 항목',
        body: '펀딩은 통신판매 계약이라 문의·상담과 수집 항목이 다릅니다. 펀딩 신청 화면에서 다음 항목을 수집합니다.',
        items: FUNDING_COLLECTED_ITEMS,
      },
      {
        heading: '7. 펀딩 개인정보의 이용 목적',
        body: '펀딩으로 수집한 개인정보는 아래 목적으로만 이용합니다.',
        items: FUNDING_COLLECTION_PURPOSES,
      },
      {
        heading: '8. 펀딩 개인정보의 보유·이용 기간',
        body: `펀딩으로 수집한 개인정보는 ${PRIVACY_RETENTION_TEXT} 보관한 뒤 지체 없이 파기합니다. 다만 ${PRIVACY_LEGAL_RETENTION_TEXT} 서포터가 펀딩을 취소해 환불이 완료된 경우에도 이 거래기록 보존 의무는 그대로 적용됩니다.`,
      },
      {
        heading: '9. 펀딩 개인정보의 처리위탁',
        body:
          '펀딩 처리를 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 수탁자가 바뀌면 이 ' +
          '처리방침으로 알립니다. 프로젝트를 직접 등록한 개설자에게는 모금이 마감된 뒤 배송 ' +
          '리워드의 발송에 필요한 항목만 제공하며, 개설자는 그 정보를 리워드 발송과 배송 문의 ' +
          '응대에만 사용하고 발송을 마친 뒤 지체 없이 파기해야 합니다. 스튜디오가 직접 운영하는 ' +
          '프로젝트는 스튜디오가 발송하므로 개설자에게 제공하는 정보가 없습니다.',
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
          '주소를 어디서 확인했는지는 보내는 메일에 함께 밝히고, 요청하시면 수집 경위를 알려드립니다.',
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
      // 13~14항은 펀딩 프로젝트를 **개설하는** 아티스트 전용이다. 6~9항(서포터)과 대상이 다르다.
      // 항 제목을 '펀딩'으로 시작하지 않게 두는 것이 중요하다 — 약관 §13이 참조하는 목록
      // (FUNDING_PRIVACY_SECTION_HEADINGS)은 `/^\d+\. 펀딩/`으로 뽑히는 서포터 절이고,
      // 개설자 절이 거기 섞이면 서포터 약관이 개설자 항을 가리키게 된다.
      {
        heading: '13. 개설자(아티스트) 계정 정보의 수집 항목과 수집 시점',
        body:
          '펀딩 프로젝트를 개설하려는 분이 개설자 화면에서 “로그인 링크 받기”로 이메일 주소를 ' +
          '보내면, 그 순간 그 주소로 개설자 계정이 만들어집니다. 별도의 가입 절차가 없어 링크를 ' +
          '한 번 요청한 것만으로 계정이 생기며, 이때 저장되는 것은 이메일 주소와 그 주소의 @ 앞 ' +
          '부분으로 자동으로 채워지는 이름입니다. 나머지는 개설자 편집 화면에서 직접 적어 주실 ' +
          '때만 저장됩니다. 로그인 링크는 원문을 보관하지 않고 되돌릴 수 없는 해시로만 두며, ' +
          '15분이 지나거나 한 번 쓰이면 다시 쓸 수 없습니다. 정산 정보는 프로젝트가 승인된 ' +
          '뒤에만 받습니다 — 승인 전에는 편집 화면의 정산 구획이 열리지 않고, 서버도 승인된 ' +
          '프로젝트가 없는 계정의 정산 정보 저장을 거부합니다. 정산 정보는 제공하지 않으셔도 ' +
          '되지만, 보낼 계좌와 세금 처리 구분을 알 수 없으면 정산금을 보낼 수 없습니다 — ' +
          '프로젝트 개설과 심사, 모금 자체는 정산 정보 없이도 그대로 진행됩니다.',
        items: [
          '계정 생성 시 자동 — 이메일 주소, 이름(이메일 주소의 @ 앞부분)',
          '개설자가 편집 화면에서 적는 경우에만 — 개설자 이름, 담당자 이름, 연락처, 소개, 외부 링크',
          '프로젝트가 승인된 뒤 개설자가 정산 구획에 적는 경우에만 — 은행명, 계좌번호, 예금주, 세금 처리 구분(원천징수 대상인지, 세금계산서를 발행하는 사업자인지)',
          '프로젝트가 승인되고 세금 처리 구분이 원천징수인 경우에만 — 주민등록번호. 고유식별정보라 아래 15항이 따로 정합니다',
          '자동 생성 — 마지막 로그인 시각, 계정 생성·수정 시각, 로그인 링크의 해시값과 만료·사용 시각',
          '정산을 기록한 경우 자동 생성 — 그 프로젝트의 모금액, 환불액, 공급가액, 플랫폼 수수료, 결제 수수료와 그 합계, 세전 개설자 몫, 원천징수액, 실지급액, 확정 후원 건수, 지급 상태·지급 시각, 정산 기록의 생성·수정 시각, 운영자가 적는 정산 메모(정산 안내 메일에 그대로 실립니다)',
        ],
      },
      {
        heading: '14. 개설자 개인정보의 이용 목적과 보유 기간',
        body:
          '개설자 계정 정보는 로그인 링크 발송과 본인 확인, 프로젝트 심사 진행과 그 결과 통지, ' +
          '심사·운영 과정에서 필요한 연락에만 이용합니다. 이 가운데 공개되는 것은 개설자 이름 ' +
          '하나뿐입니다 — 승인된 프로젝트 상세 화면에 판매자 표시와 함께 나갑니다. 담당자 이름과 ' +
          '연락처는 스튜디오 운영자에게만 보이고, 소개와 외부 링크는 지금은 개설자 본인의 편집 ' +
          '화면에서만 보입니다. 정산 정보(은행명·계좌번호·예금주·세금 처리 구분)는 모금이 끝난 ' +
          '프로젝트의 정산금을 그 계좌로 보내는 데 쓰고, 세금 처리 구분이 원천징수인 경우 그 ' +
          '원천징수세액의 신고·납부에 씁니다. 계좌번호 전체는 운영자가 이체하려고 조회 버튼을 ' +
          '눌렀을 때만 그 응답으로 나오며, 심사 화면과 프로젝트 목록에는 애초에 싣지 않습니다. ' +
          '개설자 본인의 편집 화면과 정산 안내 메일에도 계좌번호 뒤 4자리까지만 나갑니다. ' +
          '정산을 기록하면 그때의 금액과 확정 후원 건수가 정산 기록으로 남고, 같은 내역을 ' +
          '정산 안내 메일로 개설자에게 보냅니다. 보유 기간은 계정이 남아 있는 동안이며, ' +
          '기간이 지나면 자동으로 지우는 절차는 두고 있지 않습니다 — 정산 정보와 정산 기록도 ' +
          '마찬가지여서, 정산이 끝나도 계좌 정보는 계정에 남아 있습니다. 개설자는 편집 화면에서 ' +
          '정산 정보를 다시 입력해 언제든 덮어쓸 수 있습니다. 주민등록번호는 예외여서 아래 ' +
          '15항이 정한 요건을 갖추면 자동으로 파기하며, 전체 파기 절차와 방법은 아래 18항에 ' +
          '적어 두었습니다. 삭제를 요청하시면 위 5항에 ' +
          '따라 조치하되, 이미 승인·공개된 프로젝트에 연결된 개설자 이름과 연락처, 그리고 대금 ' +
          '결제 기록에 해당하는 정산 기록은 그 프로젝트의 ' +
          '거래기록을 확인할 수 있어야 하므로 아래 보존 기간에는 지우지 못합니다. ' +
          PRIVACY_LEGAL_RETENTION_TEXT +
          ' 개설자 정보 처리를 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 수탁자가 바뀌면 ' +
          '이 처리방침으로 알립니다.',
        processors: FUNDING_CREATOR_DATA_PROCESSORS,
      },
      // 15항은 고유식별정보(주민등록번호) 전용이다. 13~14항과 대상은 같지만 별도로 두는 이유는,
      // 주민등록번호가 법령에 구체적 근거가 있을 때만 처리할 수 있는 정보라 항목·목적·근거·
      // 보유기간·암호화 사실을 한자리에서 읽을 수 있어야 하기 때문이다.
      // **이 항은 코드가 실제로 하는 것만 적는다.** 수집 대상은 savePayoutSection이
      // taxType === 'withholding'일 때만 저장하고 'invoice'면 기존 값까지 지우는 그대로이되,
      // 원천징수한 정산 기록이 있으면 지우지 않는 예외(hasWithheldPayout)까지 그대로이고,
      // 열람 경로는 **둘**이다 — 관리자 화면의 조회 버튼
      // (pages/api/admin/funding/projects/[id]/resident-number.ts)과 정산 기록 직전의 복호화
      // 점검(lib/funding/payout.ts의 residentNumberReadable). 둘 다 privacy_access_logs에
      // 남는다(lib/privacy/accessLog.ts). 자동 파기는 lib/funding/retention.ts의
      // purgeExpiredResidentNumbers가 월 1회 크론으로 수행한다.
      //
      // **근거 조문은 대통령령까지 적는다.** 개인정보 보호법 제24조의2①1호의 열거에 부령은
      // 없으므로, 지급명세서 서식(기획재정부령)이 주민등록번호 칸을 두고 있다는 사실은 근거가
      // 아니라 설명이다. 열거에 드는 것은 대통령령인 소득세법 시행령 제147조의7제1항제1호
      // 가목("납세번호(주민등록번호로 갈음하는 경우에는 주민등록번호)")이다.
      {
        heading: '15. 개설자 주민등록번호(고유식별정보)의 처리',
        body:
          '스튜디오 놀은 세금 처리 구분을 원천징수로 등록한 개설자에게만 주민등록번호를 받습니다. ' +
          '개인에게 정산금을 보낼 때 스튜디오가 원천징수의무자로서 그 세액을 신고·납부하고 국세청에 ' +
          '지급명세서를 제출해야 하는데, 소득세법 시행령이 그 지급명세서에 소득을 받는 분의 ' +
          '주민등록번호를 적도록 하고 있기 때문입니다. 국세청 서식에 주민등록번호 칸이 있는 것은 ' +
          '그 시행령을 따른 결과이지 그 자체가 수집 근거는 아닙니다. 이 목적 외에는 어떤 경우에도 ' +
          '이용하지 않습니다. ' +
          '세금계산서를 발행하는 사업자로 등록한 개설자에게는 원천징수를 하지 않아 지급명세서 제출 ' +
          '대상이 아니므로, 그 개설자에게는 주민등록번호를 받지 않습니다 — 편집 화면에 입력칸 자체가 ' +
          '나오지 않고, 값이 전송되어도 저장하지 않습니다. 다만 원천징수로 등록해 정산을 이미 받으신 ' +
          '뒤에 사업자로 바꾸시는 경우에는, 이미 떼어 간 세액의 신고와 지급명세서 제출 의무가 남아 ' +
          '있으므로 등록된 번호를 지우지 않고 그 목적으로만 계속 보관합니다.',
        items: [
          '수집 항목 — 주민등록번호 13자리. 다른 형태로 쪼개거나 생년월일만 따로 저장하지 않습니다',
          '수집 대상과 시점 — 프로젝트가 승인된 뒤, 세금 처리 구분을 원천징수로 등록한 개설자가 편집 화면의 정산 구획에서 직접 적을 때만',
          '이용 목적 — 사업소득 원천징수세액의 신고·납부와 국세청 지급명세서 제출. 그 밖의 목적으로 이용하지 않습니다',
          '수집 근거 — 소득세법 시행령 제147조의7제1항제1호 가목이 지급명세서에 소득을 받는 분의 납세번호(주민등록번호로 갈음하는 경우에는 주민등록번호)를 적도록 하고 있습니다. 개인정보 보호법 제24조의2제1항제1호는 법률·대통령령 등에서 구체적으로 주민등록번호의 처리를 요구하거나 허용한 경우에만 처리할 수 있도록 정하고 있으며, 스튜디오 놀은 대통령령인 위 조항을 근거로 원천징수 대상 개설자에 한해서만 수집합니다',
          '제출 의무의 근거 — 위 수집 근거와 구분됩니다. 지급명세서는 사업소득의 경우 다음 연도 3월 10일까지(소득세법 제164조제1항), 간이지급명세서는 지급일이 속하는 달의 다음 달 말일까지(같은 법 제164조의3제1항) 제출해야 합니다',
          '안전조치 — 데이터베이스에 넣기 전에 암호화(AES-256-GCM)해 저장하며, 평문 상태로는 저장하지 않습니다. 개인정보 보호법 제24조의2제2항이 정한 주민등록번호 암호화 보관 의무에 따른 조치입니다',
          '열람 범위 — 복호화되는 경로는 둘뿐입니다. 하나는 스튜디오 운영자가 신고·지급명세서 제출을 위해 관리자 화면에서 조회 버튼을 누른 때이고, 다른 하나는 정산을 기록하기 직전에 등록된 번호가 실제로 열리는지 확인하는 점검입니다 — 점검은 성공 여부만 보고 번호를 화면·메일·응답 어디에도 내보내지 않습니다. 두 경우 모두 조회한 사실을 접속기록에 남기되 번호 자체는 기록하지 않습니다. 개설자 본인의 편집 화면, 프로젝트 목록·심사 화면, 안내 메일, 내려받는 파일 어디에도 번호는 나오지 않으며 등록 여부(등록됨·미등록)만 표시됩니다',
          '접속기록 — 위 두 경로의 조회는 성공·실패를 가리지 않고 수행자·조회 종류·대상 프로젝트·결과·IP 주소·시각으로 기록하며 2년 동안 보관합니다(아래 19항)',
          '보유 기간 — 원천징수한 정산이 있으면 그 정산의 지급일부터 5년, 원천징수 기록이 한 번도 없으면 계정의 마지막 활동으로부터 1년입니다. 이 두 기간은 법이 정한 것이 아니라 수정신고·경정에 대비한 스튜디오의 운영 판단이며, 법이 정하는 것은 위 제출 기한입니다. 심사 중이거나 승인된 프로젝트 가운데 아직 정산이 끝나지 않은 것이 있으면 곧 쓸 값이므로 그동안은 파기하지 않습니다',
          '자동 파기 — 위 요건을 모두 갖추면 월 1회 도는 정리 작업이 등록된 번호를 지웁니다. 암호문 자체를 덮어쓰므로 복호화 키가 있어도 되살릴 수 없으며, 정리 작업이 한 달에 한 번이라 요건을 갖춘 날로부터 늦어도 한 달 안에 지워집니다. 계좌·세금 처리 구분 등 다른 정보는 이 작업이 건드리지 않습니다',
          '입력에 따른 파기 — 개설자가 편집 화면에서 세금 처리 구분을 사업자로 바꿔 저장하면 등록된 번호가 함께 지워집니다. 원천징수 대상이 아니게 되는 순간 보관할 근거가 사라지기 때문입니다. 다만 그 개설자에게 이미 원천징수한 정산이 있으면 지우지 않고 보관합니다 — 이미 떼어 간 세액을 신고하고 그에 대한 지급명세서를 제출할 의무가 남아 있어, 그 의무가 보관 근거가 되기 때문입니다. 그 밖의 삭제 요청은 위 5항에 따라 처리합니다',
          '다시 등록 — 새 번호를 적어 저장하면 덮어쓰고, 비워 둔 채 저장하면 이미 등록된 번호가 그대로 남습니다',
        ],
      },
      // 16항은 펀딩만의 것이 아니다 — 문의·예약·결제 웹훅·개설자 로그인이 같은 카운터를 쓴다
      // (lib/booking/rate-limit.ts). 같은 파일이 이메일은 해시로 바꾸면서 IP는 그대로 남기므로,
      // 남는 쪽을 고지한다.
      {
        heading: '16. 요청 제한을 위한 접속 기록',
        body:
          '문의·예약·펀딩 신청·디지털 리워드 내려받기·개설자 로그인처럼 반복 요청으로 남용될 수 ' +
          '있는 화면에는, 같은 곳에서 온 요청을 세어 정해진 한도를 넘으면 잠시 막는 장치를 두고 ' +
          '있습니다. 이때 요청자의 IP 주소를 담은 식별자와 그 창에서의 요청 횟수를 기록합니다. ' +
          '개설자 로그인은 같은 주소로 링크가 퍼부어지는 것도 막아야 해서 이메일로도 세는데, 그 ' +
          '값은 주소 그대로가 아니라 되돌릴 수 없는 해시로 기록합니다. 이 기록은 남용 차단 외의 ' +
          '목적으로 쓰지 않고, 다른 정보와 연결해 개인을 식별하는 데 쓰지 않으며, 제3자에게 ' +
          '제공하지 않습니다. 요청 제한 창(길어도 한 시간)이 지난 기록은 다음 요청이 들어올 때 ' +
          '함께 지웁니다 — 따로 돌리는 정리 작업이 없어, 그때까지는 남아 있습니다.',
      },
      // 17항은 개인정보 보호법 제30조①6호의 필수 기재사항이다. 이 문서에 통째로 빠져 있었다 —
      // 저장소 전체에 "보호책임자"가 0건이었다. 값은 리터럴로 박지 않는다: 이름은
      // data/siteConfig.ts, 전화는 lib/factTokens.js, 접수 메일은 lib/operatorContact.ts가
      // 정본이고, 그 값들이 바뀌면 이 항도 함께 움직여야 한다.
      {
        heading: '17. 개인정보 보호책임자',
        body:
          '스튜디오 놀은 개인정보 처리에 관한 업무를 총괄해서 책임지고, 정보주체의 문의·불만 ' +
          '처리와 피해 구제를 담당하는 개인정보 보호책임자를 아래와 같이 두고 있습니다. ' +
          '스튜디오 놀은 운영자 한 사람이 운영하므로 별도의 전담 부서를 두지 않으며, 위 5항의 ' +
          '권리 행사 요청도 같은 창구로 접수합니다.',
        items: [
          `성명 — ${PRIVACY_OFFICER.name}(${PRIVACY_OFFICER.role})`,
          `이메일 — ${PRIVACY_OFFICER.email}`,
          `전화 — ${PRIVACY_OFFICER.phone}`,
          '담당 업무 — 개인정보 처리에 관한 업무 총괄, 열람·정정·삭제·처리정지 요구와 동의 철회의 접수·처리, 개인정보 관련 문의·불만 처리와 피해 구제',
        ],
      },
      // 18항은 제30조①3의2호(파기절차 및 파기방법)다. 예전에는 파기 "시점"만 있고 누가 언제
      // 어떤 방법으로 지우는지가 없었고, 보존하는 항목도 열거돼 있지 않았다. 아래 내용은
      // lib/funding/retention.ts·lib/privacy/accessLog.ts·db/schema.ts에서 확인한 것이다 —
      // 코드가 하지 않는 파기를 적지 않는다.
      {
        heading: '18. 개인정보의 파기절차 및 파기방법',
        body:
          '처리 목적이 달성되었거나 보유 기간이 지난 개인정보는 지체 없이 파기합니다. 다만 다른 ' +
          '법령에 따라 보존해야 하는 기록은 그 기간 동안 보존한 뒤 파기합니다. 파기는 사람이 ' +
          '기억해서 하는 것이 아니라 매월 1회 자동으로 도는 정리 작업이 수행하며, 방법은 ' +
          '데이터베이스에 저장된 해당 값을 지우는 것입니다 — 암호화해 보관하던 값은 암호문 ' +
          '자체가 지워져 복호화 키로도 되살릴 수 없습니다. 정리 작업이 한 달에 한 번이므로 ' +
          '파기 요건을 갖춘 날로부터 늦어도 한 달 안에 지워집니다.',
        items: [
          '자동 파기 ① 후원자의 배송·메모 정보 — 리워드 전달이 끝나고 1년이 지났으며 아래 법정 보존 기간도 지난 후원 건에서, 받는 분 이름·연락처·우편번호·주소·상세주소·배송 메모와 응원 메시지, 운영자가 적은 메모를 지웁니다. 후원 기록의 행 자체는 남습니다 — 아래 보존 대상 항목이 그 행에 있기 때문입니다',
          '자동 파기 ② 개설자 주민등록번호 — 위 15항이 정한 요건을 갖추면 암호문을 지웁니다',
          '자동 파기 ③ 고유식별정보 접속기록 — 기록한 때로부터 2년이 지난 행을 지웁니다(아래 19항)',
          '그 밖의 파기 — 요청 제한 기록은 제한 창(길어도 한 시간)이 지나면 다음 요청이 들어올 때 함께 지우고(위 16항), 개설자 로그인 링크는 15분이 지나거나 한 번 쓰이면 다시 쓸 수 없게 됩니다',
          '보존하는 개인정보의 근거 — 전자상거래 등에서의 소비자보호에 관한 법률이 정한 거래기록 보존 의무입니다. 위 3항·8항의 기간 동안 보존합니다',
          '보존하는 개인정보의 항목 — 주문자 이름·연락처·이메일 주소, 주문번호와 주문 유형, 예약 일시·상품 또는 펀딩 리워드 이름·수량·단가·추가 후원금, 결제수단과 결제·취소·환불 처리 기록, 동의한 약관 판본과 동의 시각, 리워드 발송 상태·택배사·운송장번호, 그리고 개설자 쪽으로는 개설자 이름·연락처와 정산 기록(모금액·환불액·수수료·원천징수액·실지급액·확정 후원 건수·지급 시각)입니다',
        ],
      },
      // 19항은 시행령 제31조①3호(안전성 확보 조치)다. **지금 코드가 실제로 하는 것만 적는다.**
      // 암호화는 lib/crypto/fieldCrypto.ts(AES-256-GCM, 주민등록번호 컬럼), 관리자 인증은
      // lib/contracts/admin-auth.ts(단일 비밀번호 + 세션), 접속기록은 lib/privacy/accessLog.ts,
      // 요청 제한은 lib/booking/rate-limit.ts다. 하지 않는 것(침입탐지·모의훈련 등)은 적지 않는다.
      {
        heading: '19. 개인정보의 안전성 확보 조치',
        body:
          '스튜디오 놀은 아래와 같은 조치를 하고 있습니다. 여기에 적지 않은 조치는 하고 있지 ' +
          '않다는 뜻이며, 새로 갖추면 이 처리방침에 더합니다.',
        items: [
          '고유식별정보의 암호화 — 개설자 주민등록번호는 데이터베이스에 넣기 전에 AES-256-GCM으로 암호화하며, 암호화 키는 서버의 환경 변수로만 두고 데이터베이스에 함께 저장하지 않습니다. 평문 컬럼도, 생년월일만 떼어 둔 표시용 컬럼도 두지 않습니다',
          '되돌릴 수 없는 처리 — 개설자 로그인 링크는 원문을 저장하지 않고 해시만 보관하며, 요청 제한에 쓰는 이메일 주소도 해시로만 기록합니다',
          '접근 권한의 제한 — 개인정보를 볼 수 있는 관리자 화면은 비밀번호 인증을 통과한 세션에서만 열립니다. 주민등록번호와 계좌번호 전체는 운영자가 그 값을 보려고 조회를 요청한 응답에만 실리며, 목록·심사 화면과 페이지 소스, 안내 메일, 내려받는 파일에는 담기지 않습니다',
          '접속기록의 보관 — 주민등록번호 조회, 정산 기록 직전의 복호화 점검, 정산 계좌 조회는 성공·실패를 가리지 않고 수행자·조회 종류·대상 프로젝트·결과·IP 주소·시각으로 기록해 2년 동안 보관합니다. 열람한 값 자체는 기록하지 않습니다. 관리자 인증이 단일 비밀번호 하나여서 수행자는 개인이 아니라 "관리자"로 기록되며, 여러 사람이 같은 비밀번호를 쓰면 이 기록으로는 누구인지 가릴 수 없습니다',
          '요청 제한 — 문의·예약·펀딩 신청·내려받기·개설자 로그인 화면은 같은 곳에서 온 요청 횟수를 세어 한도를 넘으면 잠시 막습니다(위 16항)',
          '전송 구간의 암호화 — 웹사이트의 모든 요청은 HTTPS로 주고받습니다',
        ],
      },
      // 20항은 제30조①7호(자동수집장치의 설치·운영과 거부)다. 측정 스크립트가 전 페이지에서
      // 도는데 이 문서에 언급이 0건이었다. 실제 동작은 components/common/DeferredAnalytics.tsx와
      // public/scripts/ga4-init.js, lib/analytics/privatePaths.ts에서 확인한 것이다 —
      // 사이트에 자체 수집 거부 버튼은 없으므로 있다고 적지 않는다.
      {
        heading: '20. 쿠키 등 자동수집장치의 설치·운영 및 거부',
        body:
          '스튜디오 놀은 방문 통계와 화면 성능 확인을 위해 Google Analytics 4와 Vercel의 ' +
          '방문·성능 측정 기능을 사용합니다. 이 스크립트는 페이지를 열자마자 켜지지 않고 ' +
          '방문자가 화면을 처음 움직이거나 누른 뒤(또는 5초가 지난 뒤)에 불러오며, ' +
          'studionol.co.kr 도메인에서만 동작합니다. 결제 결과·후원 확인·계약 서명·관리자 ' +
          '화면에는 측정 스크립트를 아예 싣지 않습니다 — 그 주소에는 주문번호나 관리 토큰이 ' +
          '들어 있기 때문입니다.',
        items: [
          '수집하는 정보 — 방문한 페이지 주소와 유입 경로, 브라우저·기기·운영체제 정보, 접속 시각과 화면 성능 지표, 그리고 문의·카카오톡 상담 버튼을 누르는 등의 이용 행태 정보입니다. 이름·연락처처럼 방문자를 직접 알아볼 수 있는 정보를 측정 스크립트에 담아 보내지 않습니다',
          '쿠키의 사용 — Google Analytics 4는 같은 방문자의 재방문을 구분하기 위해 브라우저에 식별자 쿠키를 저장합니다. 이용 목적은 방문 통계와 화면 개선이며, 광고를 위해 이용하지 않습니다',
          '거부 방법 — 사이트에 별도의 수집 거부 버튼은 두고 있지 않습니다. 사용하시는 브라우저의 설정에서 쿠키를 차단하거나 저장된 쿠키를 삭제하시면 거부하실 수 있으며, 쿠키를 차단해도 사이트 이용에는 제한이 없습니다',
          '브라우저에만 남는 설정 — 다크 모드 설정, 안내 배너를 닫은 기록, 작성하던 폼의 임시 저장처럼 화면 편의를 위한 값은 방문자의 브라우저에만 저장되며 스튜디오 놀의 서버로 전송되지 않습니다',
        ],
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
        body: 'We do not provide personal data to third parties. We do entrust processing: Resend (sending inquiry notifications to the studio, booking/order confirmation and cancellation emails, and forwarding messages sent to hello@) and Vercel (website and server hosting) receive the name, phone number, email address, and message you submit. Bookings and payments (offered on our Korean pages only) additionally involve Turso (booking and order database), Google LLC (calendar event for a confirmed booking) and Toss Payments (payment approval, cancellation, refund). Outsourcing for crowdfunding (reward pre-orders) is listed in section 9 of the Korean privacy policy, and media contact handling for press outreach in sections 6 to 8 below.',
      },
      {
        heading: '5. Your rights',
        body: 'You may request access, correction, or deletion of your personal data at any time, and we will respond without undue delay.',
      },
      {
        heading: '6. Media contact details for press outreach',
        body: 'For music release publicity, Studio NOL collects business contact details that press outlets, media companies, broadcasters, and music distributors have themselves made public (editorial desks, news tip lines, contribution intake channels, and similar) and uses them to send press releases. We use them only within the scope the data subject has made public, and we do not collect addresses that individuals use privately. Every email we send states where we found the address, and we will explain how it was collected on request.',
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
        body: '我们不向第三方提供个人信息。但我们委托处理如下：Resend（向工作室发送咨询提醒邮件、发送预约/订单确认与取消邮件，并转发发送至 hello@ 的邮件）与 Vercel（网站及服务器托管）会接收您提交的姓名、联系电话、电子邮箱和咨询内容。预约与支付（仅在韩语页面提供）另外涉及 Turso（预约与订单数据库）、Google LLC（为已确认预约创建日历日程）和 Toss Payments（支付授权、取消与退款）。众筹（回报预购）相关的委托情况请参阅韩语版隐私政策第 9 项，新闻宣传的媒体联系方式处理请见下方第 6 至 8 项。',
      },
      {
        heading: '5. 用户权利',
        body: '您可随时请求查阅、更正或删除个人信息，我们将及时处理。',
      },
      {
        heading: '6. 为新闻宣传业务处理媒体联系方式',
        body: 'Studio NOL 为音乐作品发行宣传业务，收集新闻机构、媒体、广播电视及音乐发行方自行公开的公务联系方式（编辑部、报料与投稿受理窗口等），并据此发送新闻稿。我们仅在信息主体已公开的范围内使用，不收集个人私下使用的地址。该地址的获取来源会在发出的邮件中一并说明，如您提出要求，我们也会说明收集经过。',
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
        body: 'No cedemos datos personales a terceros. Sí encargamos el tratamiento: Resend (envío de notificaciones de consulta al estudio, correos de confirmación y cancelación de reservas/pedidos, y reenvío de los mensajes enviados a hello@) y Vercel (alojamiento del sitio y del servidor) reciben el nombre, teléfono, correo electrónico y contenido del mensaje. Las reservas y pagos (disponibles solo en nuestras páginas en coreano) implican además a Turso (base de datos de reservas y pedidos), Google LLC (evento de calendario de una reserva confirmada) y Toss Payments (autorización, cancelación y reembolso del pago). El encargo relativo al crowdfunding (pedidos anticipados de recompensas) figura en el apartado 9 de la política de privacidad en coreano, y el tratamiento de contactos de prensa en los apartados 6 a 8 siguientes.',
      },
      {
        heading: '5. Derechos del usuario',
        body: 'Puede solicitar en cualquier momento acceso, corrección o eliminación de sus datos personales, y responderemos sin demoras indebidas.',
      },
      {
        heading: '6. Tratamiento de contactos de medios para labores de prensa',
        body: 'Para la promoción de lanzamientos musicales, Studio NOL recopila datos de contacto profesionales que los medios de comunicación, las emisoras y las distribuidoras musicales han hecho públicos por sí mismos (redacción, buzón de avisos, recepción de colaboraciones, etc.) y les envía notas de prensa. Los usamos únicamente dentro del ámbito que el interesado ha hecho público y no recopilamos direcciones de uso personal privado. En cada correo indicamos dónde obtuvimos la dirección y, si lo solicita, le explicamos cómo la recopilamos.',
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
        body: 'Chúng tôi không cung cấp dữ liệu cá nhân cho bên thứ ba. Chúng tôi có ủy quyền xử lý: Resend (gửi email thông báo yêu cầu liên hệ đến studio, email xác nhận và hủy đặt lịch/đơn hàng, và chuyển tiếp email gửi đến hello@) và Vercel (lưu trữ website và máy chủ) nhận họ tên, số điện thoại, email và nội dung yêu cầu của bạn. Việc đặt lịch và thanh toán (chỉ có trên trang tiếng Hàn) còn liên quan tới Turso (cơ sở dữ liệu đặt lịch và đơn hàng), Google LLC (tạo sự kiện lịch cho lịch hẹn đã xác nhận) và Toss Payments (duyệt, hủy và hoàn tiền thanh toán). Việc ủy quyền xử lý cho gây quỹ (đặt trước phần thưởng) được nêu tại mục 9 của chính sách bảo mật bản tiếng Hàn, còn xử lý liên hệ báo chí ở mục 6 đến 8 bên dưới.',
      },
      {
        heading: '5. Quyền của người dùng',
        body: 'Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa thông tin cá nhân bất cứ lúc nào, và chúng tôi sẽ xử lý sớm nhất có thể.',
      },
      {
        heading: '6. Xử lý thông tin liên hệ của báo chí cho hoạt động truyền thông',
        body: 'Để phục vụ hoạt động quảng bá phát hành âm nhạc, Studio NOL thu thập các địa chỉ liên hệ công vụ mà cơ quan báo chí, đơn vị truyền thông, đài phát thanh - truyền hình và nhà phân phối âm nhạc tự công khai (ban biên tập, kênh tiếp nhận tin báo, kênh nhận bài cộng tác, v.v.) để gửi thông cáo báo chí. Chúng tôi chỉ sử dụng trong phạm vi mà chủ thể thông tin đã công khai và không thu thập địa chỉ cá nhân dùng cho mục đích riêng tư. Trong mỗi email gửi đi, chúng tôi nêu rõ đã lấy địa chỉ từ đâu, và sẽ giải thích cách thu thập nếu bạn yêu cầu.',
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
        body: 'เราไม่เปิดเผยข้อมูลส่วนบุคคลให้บุคคลที่สาม แต่เราว่าจ้างประมวลผลดังนี้ Resend (ส่งอีเมลแจ้งเตือนคําถามถึงสตูดิโอ อีเมลยืนยันและยกเลิกการจอง/คําสั่งซื้อ และส่งต่ออีเมลที่ส่งไปยัง hello@) และ Vercel (โฮสติงเว็บไซต์และเซิร์ฟเวอร์) จะได้รับชื่อ เบอร์โทร อีเมล และเนื้อหาคําสอบถามของคุณ ส่วนการจองและการชําระเงิน (มีเฉพาะหน้าภาษาเกาหลี) ยังเกี่ยวข้องกับ Turso (ฐานข้อมูลการจองและคําสั่งซื้อ) Google LLC (สร้างกําหนดการในปฏิทินสําหรับการจองที่ยืนยันแล้ว) และ Toss Payments (อนุมัติ ยกเลิก และคืนเงิน) การว่าจ้างประมวลผลที่เกี่ยวกับการระดมทุน (การสั่งจองของตอบแทนล่วงหน้า) ระบุไว้ในข้อ 9 ของนโยบายฉบับภาษาเกาหลี และการจัดการข้อมูลติดต่อสื่อมวลชนอยู่ในข้อ 6 ถึง 8 ด้านล่าง',
      },
      {
        heading: '5. สิทธิของผู้ใช้',
        body: 'คุณสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลได้ทุกเมื่อ และเราจะดําเนินการโดยเร็ว',
      },
      {
        heading: '6. การประมวลผลข้อมูลติดต่อของสื่อมวลชนเพื่องานประชาสัมพันธ์',
        body: 'เพื่องานประชาสัมพันธ์การเผยแพร่ผลงานเพลง Studio NOL เก็บรวบรวมข้อมูลติดต่อเชิงธุรกิจที่สํานักข่าว สื่อมวลชน สถานีวิทยุโทรทัศน์ และผู้จัดจําหน่ายเพลงเปิดเผยไว้เอง (กองบรรณาธิการ ช่องทางแจ้งข่าว ช่องทางรับบทความ เป็นต้น) เพื่อส่งข่าวประชาสัมพันธ์ เราใช้เฉพาะในขอบเขตที่เจ้าของข้อมูลส่วนบุคคลเปิดเผยไว้เท่านั้น และไม่เก็บที่อยู่ที่บุคคลใช้เป็นการส่วนตัว อีเมลที่เราส่งจะระบุด้วยว่าได้ที่อยู่นั้นมาจากที่ใด และหากร้องขอ เราจะอธิบายวิธีการเก็บรวบรวมให้ทราบ',
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
        body: 'Shaxsiy ma\'lumotlar uchinchi tomonlarga berilmaydi. Biroq qayta ishlash topshirilgan: Resend (studiyaga murojaat haqida xabarnoma, bron/buyurtma tasdiqlash va bekor qilish xatlarini yuborish, hamda hello@ ga yuborilgan xatlarni yo\'naltirish) hamda Vercel (veb-sayt va server hostingi) siz yuborgan ism, telefon raqami, email manzili va murojaat mazmunini oladi. Bron va to\'lov (faqat koreys tilidagi sahifalarda) qo\'shimcha ravishda Turso (bron va buyurtma ma\'lumotlar bazasi), Google LLC (tasdiqlangan bron uchun kalendar tadbiri) va Toss Payments (to\'lovni tasdiqlash, bekor qilish, qaytarish) ishtirokida kechadi. Kraudfanding (mukofotlarni oldindan buyurtma qilish) bo\'yicha topshirish koreyscha maxfiylik siyosatining 9-bandida, matbuot aloqalari esa quyidagi 6-8-bandlarda keltirilgan.',
      },
      {
        heading: '5. Foydalanuvchi huquqlari',
        body: 'Siz istalgan vaqtda shaxsiy ma\'lumotlaringizni ko\'rish, tuzatish yoki o\'chirishni so\'rashingiz mumkin va biz buni tezkor ko\'rib chiqamiz.',
      },
      {
        heading: '6. Matbuot targ\'iboti uchun ommaviy axborot vositalari aloqa ma\'lumotlarini qayta ishlash',
        body: 'Studio NOL musiqa relizlarini targ\'ib qilish uchun nashrlar, ommaviy axborot vositalari, teleradiokanallar va musiqa distributorlari o\'zlari oshkor qilgan ish aloqa manzillarini (tahririyat, xabar berish, maqola qabul qilish kanallari va shu kabilar) yig\'adi va press-relizlar yuboradi. Ular faqat ma\'lumotlar subyekti oshkor qilgan doirada ishlatiladi va shaxslar shaxsiy maqsadda foydalanadigan manzillar yig\'ilmaydi. Manzilni qayerdan olganimizni yuboradigan xatimizda ko\'rsatamiz, so\'rasangiz qanday yig\'ilganini tushuntiramiz.',
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
