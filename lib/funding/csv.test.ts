import { toCsv } from './csv';

it('BOM·CRLF·따옴표 이스케이프', () => {
  const out = toCsv([{ a: '김 "후원"', b: 5, c: null }, { a: '줄\n바꿈', b: 0, c: 'x' }], ['a', 'b', 'c']);
  expect(out.startsWith('﻿')).toBe(true);
  expect(out).toBe('﻿a,b,c\r\n"김 ""후원""",5,\r\n"줄\n바꿈",0,x\r\n');
});
