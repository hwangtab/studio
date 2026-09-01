/**
 * API 라우트와 getServerSideProps 양쪽에서 쓴다. NextApiRequest로 좁혀 두면 페이지의
 * context.req(IncomingMessage)를 못 받는데, 여기서 보는 것은 헤더와 소켓뿐이라
 * 그 둘만 요구한다.
 */
export interface IpBearingRequest {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string | undefined };
}

/**
 * 요청을 보낸 쪽의 IP.
 *
 * `x-forwarded-for`는 쓰지 않는다. 그 헤더는 누구나 요청에 직접 넣을 수 있어, 최좌측 값은
 * "클라이언트가 주장하는 IP"에 지나지 않는다. 서명 IP는 계약서에 증거로 인쇄되고 요청 제한의
 * 기준이 되므로, 주장한 값을 그대로 받으면 둘 다 무의미해진다 — 서명자는 남의 IP를 적어
 * 넣을 수 있고, 대입을 시도하는 쪽은 헤더만 바꿔 제한을 피할 수 있다.
 *
 * Vercel은 프록시 단에서 판단한 실제 접속 IP를 `x-vercel-forwarded-for`에 넣는다. 이 헤더는
 * 클라이언트가 보낸 같은 이름의 값을 덮어쓰므로 믿을 수 있다. 그것이 없는 환경(로컬 개발,
 * 직접 연결)에서는 소켓의 원격 주소를 쓴다.
 *
 * 어느 쪽으로도 얻지 못하면 null이다. 모르는 것을 아는 척 기록하는 것보다 비워 두는 편이 낫다.
 */
export const getClientIp = (req: IpBearingRequest): string | null => {
  const header = req.headers['x-vercel-forwarded-for'];
  const forwarded = Array.isArray(header) ? header[0] : header;

  const candidate = String(forwarded || req.socket.remoteAddress || '')
    .split(',')[0]
    .trim();

  return candidate || null;
};
