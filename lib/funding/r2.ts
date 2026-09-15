import { AwsClient } from 'aws4fetch';

import { isSafeObjectKey } from './objectKey';

/**
 * 디지털 리워드 저장소(Cloudflare R2)의 **만료되는 내려받기 주소**를 발급한다.
 *
 * 왜 이 파일이 생겼나: 예전에는 저장소의 공개 주소를 확정 메일과 후원 확인 페이지에
 * 그대로 실어 보냈다. 그러면 후원자가 게이트(`pages/api/funding/download.ts`)를 거치지
 * 않고 그 주소를 직접 열 수 있고, 그 순간 `downloaded_at`이 안 찍혀 **파일을 전부 받은 뒤
 * 전액 셀프 환불**이 성립한다. 약관 제8조 2항이 고지한 청약철회 제한이 집행되지 않았다.
 * 같은 이유로 티어 간 파일명을 바꿔 상위 음질을 가져가는 것도 막을 수 없었다.
 *
 * 이제 밖으로 나가는 것은 **파일 키**뿐이고, 실제 주소는 요청 시점에 서명해 만든다.
 * 버킷의 공개 접근이 꺼져 있어야 이 장치가 의미가 있다 — 공개 도메인이 열려 있으면
 * 서명을 떼고 같은 객체를 받을 수 있다.
 */

/**
 * 만료 시간. 내려받기를 **시작**하기에 충분하면 된다 — 서명 검증은 연결을 시작할 때
 * 한 번 일어나므로, 1.9GB 파일을 10분 안에 다 받아야 한다는 뜻이 아니다. 길게 잡을수록
 * 주소가 유효한 채로 공유될 수 있는 창이 넓어진다.
 */
const TTL_SECONDS = 10 * 60;

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name}이(가) 없어 내려받기 주소를 발급할 수 없습니다.`);
  return value;
};


export const presignFundingDownload = async (key: string): Promise<string> => {
  if (!isSafeObjectKey(key)) throw new Error(`내려받기 키 형식이 올바르지 않습니다: ${key}`);

  const client = new AwsClient({
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  });

  const url = new URL(`${requireEnv('R2_ACCOUNT_ENDPOINT')}/${requireEnv('R2_BUCKET')}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(TTL_SECONDS));
  // 키는 무작위 경로라 그대로 저장되면 파일 이름이 뜻을 잃는다. 받는 쪽에 원래 이름으로
  // 저장되게 지정한다.
  const filename = key.slice(key.lastIndexOf('/') + 1);
  url.searchParams.set('response-content-disposition', `attachment; filename="${filename}"`);

  const signed = await client.sign(url.toString(), { method: 'GET', aws: { signQuery: true } });
  return signed.url;
};
