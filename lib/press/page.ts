/**
 * 수신거부 확인 화면.
 *
 * React 페이지가 아니라 문자열이다. 원클릭 POST가 List-Unsubscribe의 그 URL로 오고
 * Pages Router의 페이지 컴포넌트는 POST를 못 받으므로 이 경로는 API 라우트여야
 * 한다. 그러면 화면도 여기서 만드는 편이 낫다 — 로케일 페이지를 만들면 사이트맵
 * 등록·lastmod 생성·robots disallow·privatePaths 등록이 따라오는데 전부 불필요하다.
 */
type State = 'confirm' | 'done' | 'invalid';

const COPY: Record<string, Record<State, { title: string; body: string; button?: string }>> = {
  ko: {
    confirm: {
      title: '수신거부',
      body: '아래 버튼을 누르시면 이 주소로 더 이상 보도자료를 보내지 않습니다.',
      button: '수신거부',
    },
    done: {
      title: '수신거부되었습니다',
      body: '더 이상 보내지 않습니다. 실수로 누르셨다면 받으신 메일에 회신해 주세요.',
    },
    invalid: {
      title: '수신거부',
      body: '이 링크로는 처리할 수 없습니다. 받으신 메일에 회신해 주시면 직접 처리해 드립니다.',
    },
  },
  ja: {
    confirm: {
      title: '配信停止',
      body: '下のボタンを押していただくと、このアドレスへのプレスリリース送付を停止します。',
      button: '配信停止',
    },
    done: {
      title: '配信を停止しました',
      body: '今後お送りしません。誤って押された場合は、受信されたメールにご返信ください。',
    },
    invalid: {
      title: '配信停止',
      body: 'このリンクでは処理できません。受信されたメールにご返信いただければ、こちらで対応いたします。',
    },
  },
  en: {
    confirm: {
      title: 'Unsubscribe',
      body: 'Press the button below and we will stop sending press releases to this address.',
      button: 'Unsubscribe',
    },
    done: {
      title: 'You have been unsubscribed',
      body: 'We will not write again. If you pressed this by mistake, just reply to the email you received.',
    },
    invalid: {
      title: 'Unsubscribe',
      body: 'This link cannot be processed. Reply to the email you received and we will take care of it.',
    },
  },
};

const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const renderUnsubPage = (state: State, locale: string, token: string): string => {
  // ko·ja·en만 둔다. 그 밖의 언어 수신자에게도 메일 본문은 그 언어로 가지만, 이
  // 화면까지 아홉 언어를 유지하면 문구가 갈린 채 아무도 안 보게 된다.
  const lang = COPY[locale] ? locale : 'en';
  const copy = COPY[lang][state];

  const form =
    state === 'confirm'
      ? `<form method="post" action="/u/${esc(token)}">
      <button type="submit">${esc(copy.button ?? '')}</button>
    </form>`
      : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(copy.title)}</title>
<style>
  body { margin: 0; padding: 48px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #141414; background: #faf8f4; }
  main { max-width: 420px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 14px; }
  p { font-size: 15px; line-height: 1.75; color: #4a4a4a; margin: 0 0 24px; }
  button { font: inherit; font-size: 15px; padding: 13px 26px; border: 0; border-radius: 7px; background: #c2410c; color: #fff; cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>${esc(copy.title)}</h1>
  <p>${esc(copy.body)}</p>
  ${form}
</main>
</body>
</html>`;
};
