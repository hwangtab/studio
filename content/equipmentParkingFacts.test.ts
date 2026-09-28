/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-28 운영자 확인 — 없는 장비·주차를 있다고 말한 문장이 7개 언어 스토리에 템플릿처럼 퍼져 있었다(#322).
 * 녹음 마이크의 정본은 data/equipment.ts(U87AI·C414 XLS·C1·TG-X81·SM58·SM57)이고 모니터는 Genelec이 아니다.
 * 건물 주차는 없다(KT은평지사 유료 도보 2분, 연신중 지하 공영 24시간 약 1km).
 * 연습실 비치 장비(PA·스탠드·피아노·앰프)와 대조동 공영주차장은 storyFactAudit.test.ts가 본다.
 * 일반 마이크·모니터 가이드("SM7B는 록 보컬에…")는 대상이 아니다 — 보유·비치 서술만 본다.
 */
const RULES: Array<[string, RegExp]> = [
  ['보유하지 않은 마이크를 비치·보유했다고 말함', /(TLM ?103|SM7B)[^.\n]{0,40}(비치되|보유하고|모두 비치)|(비치|보유)[^.\n]{0,10}(TLM ?103|SM7B)|(TLM ?103|SM7B)[^\n]{0,80}스튜디오 놀에는 모두 비치|스튜디오 놀에는 이 네 가지가 모두 비치/],
  ['없는 Genelec 모니터 체인', /Genelec (모니터 체인|监听|monitoring chain)|配备 Genelec|monitoreo Genelec|giám sát Genelec|Genelec monitoring zanjiri|ระบบมอนิเตอร์ Genelec/],
  ['건물 주차가 되는 것처럼 말함', /주차 가능\(일부|일부 주차 공간 제공|자체 주차 공간은 협소|자체 주차가 협소/],
];

describe('없는 장비·주차 서술 가드 (2026-09-28)', () => {
  it.each(RULES)('%s', (_label, re) => {
    const dir = path.join(process.cwd(), 'content/stories');
    const hits: string[] = [];
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      fs.readFileSync(path.join(dir, file), 'utf-8').split('\n').forEach((line, i) => {
        if (re.test(line)) hits.push(`${file}:${i + 1}: ${line.slice(0, 90)}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
