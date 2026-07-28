import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

/**
 * 연결은 첫 사용 때 만든다.
 *
 * 모듈을 불러오는 시점에 환경 변수를 검사하면, 값이 없는 환경에서는 계약 페이지의
 * 모듈을 읽는 것만으로 빌드가 통째로 실패한다(Next.js가 페이지 데이터를 수집할 때
 * 모듈을 로드한다). 계약 기능 하나의 설정 누락이 사이트 전체 배포를 막지 않도록,
 * 실패는 실제로 DB를 쓰는 요청에서만 나게 한다.
 *
 * 클라이언트를 Proxy로 감싸지 않는 이유: Proxy는 객체를 들여다보는 코드(메서드 존재
 * 확인, 속성 순회)를 가로채 조용히 깨뜨릴 수 있다. 호출부에서 getDb()를 부르는 편이
 * 안전하다.
 */
export const getDb = (): Database => {
  if (instance) return instance;

  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl || !authToken) {
    throw new Error(
      'Missing environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN. ' +
        '전자계약 기능을 쓰려면 두 값을 설정해야 합니다.',
    );
  }

  instance = drizzle(createClient({ url: databaseUrl, authToken }), { schema });
  return instance;
};
