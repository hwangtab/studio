import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

const createDatabase = (): Database => {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl || !authToken) {
    throw new Error(
      'Missing environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN. ' +
        '전자계약 기능을 쓰려면 두 값을 설정해야 합니다.',
    );
  }

  return drizzle(createClient({ url: databaseUrl, authToken }), { schema });
};

/**
 * 연결은 첫 쿼리 때 만든다.
 *
 * 모듈을 불러오는 시점에 환경 변수를 검사하면, 값이 없는 환경에서는 계약 페이지의
 * 모듈을 읽는 것만으로 빌드가 통째로 실패한다(Next.js가 페이지 데이터를 수집할 때
 * 모듈을 로드한다). 계약 기능 하나 때문에 사이트 전체를 배포하지 못하는 상황을 막기
 * 위해, 실패는 실제로 DB를 쓰는 요청에서만 나게 한다.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    if (!instance) {
      instance = createDatabase();
    }

    const value = Reflect.get(instance, property, receiver);
    // drizzle 내부가 this에 의존하므로 메서드는 실제 인스턴스에 묶어 넘긴다.
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
