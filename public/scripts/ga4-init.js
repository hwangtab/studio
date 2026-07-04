window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
// GA4 초기화는 프로덕션 도메인에서만 수행. localhost·Vercel 프리뷰(*.vercel.app) 등에서
// 실제 프로퍼티(G-KYGP18G36J)로 page_view가 전송돼 애널리틱스가 오염되는 것을 차단한다.
// 화이트리스트 방식이라 로컬·프리뷰·기타 미러 호스트는 자동으로 모두 제외된다.
// (dataLayer/gtag 스텁은 항상 정의 — gtag.js 및 다른 스크립트의 참조 오류 방지.)
if (['studionol.co.kr', 'www.studionol.co.kr'].indexOf(location.hostname) !== -1) {
  gtag('js', new Date());
  var isBot = document.cookie.split('; ').some(function(c){ return c === '__bt=1'; });
  gtag('config', 'G-KYGP18G36J', isBot ? { traffic_type: 'internal' } : {});
}
