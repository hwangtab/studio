import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from './AdminShell';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

/**
 * 관리자 주소의 404(없는 예약·계약·펀딩 id, 지워진 기록) — 사이트 404 대신 관리자 껍데기 안에서 보여 준다.
 * 위의 상단 바로 다른 구역에 갈 수 있고, 대시보드로 돌아가는 버튼을 둔다.
 */
export const AdminNotFound = () => (
  <>
    <Head>
      <title>찾을 수 없음 | 관리자</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
    <AdminShell title="찾을 수 없는 화면입니다" width="narrow">
      <Notice tone="warning" light title="주소의 기록이 없거나 지워졌습니다">
        목록에서 다시 찾아 들어가 주세요. 개인정보 보관 기간이 끝나 파기된 기록일 수도 있습니다.
      </Notice>
      <div className="mt-6">
        <Button asChild light>
          <Link href="/admin">대시보드로</Link>
        </Button>
      </div>
    </AdminShell>
  </>
);

export default AdminNotFound;
