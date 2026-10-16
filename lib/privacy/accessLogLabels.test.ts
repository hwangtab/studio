import { privacyAccessActionEnum } from '../../db/schema';
import { ACTION_LABEL } from './accessLogLabels';

it('접속기록의 모든 행동에 한글 이름이 있다 — 빠지면 화면에 영문 코드가 그대로 보인다', () => {
  const missing = privacyAccessActionEnum.filter((action) => !ACTION_LABEL[action]);
  expect(missing).toEqual([]);
});

it('열거에 없는 옛 이름이 남아 있지 않다', () => {
  const stale = Object.keys(ACTION_LABEL).filter((key) => !(privacyAccessActionEnum as readonly string[]).includes(key));
  expect(stale).toEqual([]);
});
