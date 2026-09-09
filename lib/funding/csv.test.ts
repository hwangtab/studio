import { toCsv } from './csv';

it('BOM·CRLF·따옴표 이스케이프', () => {
  const out = toCsv([{ a: '김 "후원"', b: 5, c: null }, { a: '줄\n바꿈', b: 0, c: 'x' }], ['a', 'b', 'c']);
  expect(out.startsWith('﻿')).toBe(true);
  expect(out).toBe('﻿a,b,c\r\n"김 ""후원""",5,\r\n"줄\n바꿈",0,x\r\n');
});

it('수식 인젝션 방어: =,+,-,@,탭,CR로 시작하는 문자열은 앞에 \' 추가, number는 그대로', () => {
  const out = toCsv([{ a: '=SUM(1)', b: '-1', c: -1 }, { a: '+1', b: '@cmd', c: '\t1' }], ['a', 'b', 'c']);
  expect(out).toBe('﻿a,b,c\r\n\'=SUM(1),\'-1,-1\r\n\'+1,\'@cmd,\'\t1\r\n');
});
