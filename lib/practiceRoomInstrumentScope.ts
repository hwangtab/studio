/**
 * 스튜디오 놀 연습실은 드럼과 관악기를 받지 않는다(보컬·건반·기타·베이스 등 소리가 작은 악기용).
 * 드럼·관악기 주제 스토리가 연습실 CTA·연습실 브릿지·연습실 후기를 받으면 "여기서 연습할 수
 * 있다"는 약속이 되므로, 그 슬러그는 어떤 경로로도 연습실 오퍼를 받지 않는다.
 *
 * 슬러그 토큰으로 판정한다. `drumless`처럼 토큰이 이어 붙은 글(드럼 없는 연습실)은 걸리지 않는다.
 * `drum-mixing1`·`drum-recording1`처럼 연습실 글이 아닌 것은 애초에 연습실 오퍼를 받지 않아 영향이 없다.
 */
export const UNSUPPORTED_PRACTICE_INSTRUMENT_SLUG_PATTERN =
  /(^|[-_])(drums?|percussion|wind|saxophone|sax|trumpet|trombone|flute|clarinet|oboe|bassoon|horn|brass|tuba|harmonica|ocarina|cajon|snare|cymbal|rudiments?)\d*($|[-_])/i;

export const isUnsupportedPracticeInstrumentSlug = (slug: string): boolean =>
  UNSUPPORTED_PRACTICE_INSTRUMENT_SLUG_PATTERN.test(slug);
