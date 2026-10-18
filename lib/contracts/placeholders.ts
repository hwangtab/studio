/**
 * 계약서 템플릿의 `{{name}}` 자리표시자를 **한 번에** 채운다.
 *
 * 자리표시자마다 차례로 replaceAll 하면, 먼저 넣은 값 안의 `{{…}}`가 뒤 차례에서 다시 치환된다 — 서명자가 주소에
 * `{{refundRows}}`를 적으면 환불표 행이 의뢰인 표 안에 끼어 들어가고, 그 본문이 지문·PDF에 묶인다. 한 번의 정규식
 * 치환은 원문 템플릿만 훑으므로 넣은 값은 다시 해석되지 않는다. 값은 함수로 돌려준다 — 문자열이면 `$'`·`$&` 같은
 * 치환 패턴이 해석된다. 표에 없는 자리표시자는 그대로 둔다(findUnfilledPlaceholders가 잡는다).
 */
export const fillPlaceholders = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(/\{\{([a-zA-Z]+)\}\}/g, (match: string, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match,
  );
