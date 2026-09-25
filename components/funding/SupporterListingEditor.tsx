import { useState } from 'react';

import { inferPublicNameChoice, previewPublicName, type PublicNameStyle } from '../../lib/funding/publicName';
import { Button } from '../ui/Button';
import PublicNameChoice from './PublicNameChoice';

interface Props {
  orderNo: string;
  token: string;
  customerName: string;
  /** 저장된 공개 동의와 표시 이름(`funding_pledges.public_name`). */
  initialPublic: boolean;
  initialPublicName: string | null;
  /** 저장된 응원 메시지. 공개 권유 문구와 미리보기에 쓴다. */
  message: string | null;
  /**
   * `success` — 결제 완료 화면. 아직 공개하지 않은 사람에게 **한 번 권하는** 자리라, 공개한
   * 뒤에는 확인 문구만 남기고 더 고치게 하지 않는다(고치는 곳은 펀딩 확인 화면이다).
   * `manage` — 펀딩 확인 화면. 공개·표시 이름 변경·철회를 모두 한다(약관 제13조 2항).
   */
  variant: 'success' | 'manage';
  /**
   * 운영자가 명단에서 내렸는가(`listing_hidden_at`). 공개 동의와 별개라, 이 화면이 "올라가
   * 있습니다"라고 말하면 사실과 다르다. 후원자가 설정을 바꿔도 운영자 숨김은 풀리지 않는다.
   */
  hiddenByOperator?: boolean;
}

/**
 * 후원자 명단 공개 설정. 저장은 `/api/funding/display-name` 하나로 간다.
 *
 * 결제 완료 화면에 이 권유를 두는 이유: 후원 폼에서 공개 체크를 못 보고 지나간 사람이
 * 많았는데, 결제 뒤에는 그걸 바로잡을 자리가 메일 속 펀딩 확인 링크뿐이었다.
 * 누르는 것은 후원자 본인이므로 동의의 형식은 폼의 체크와 같다.
 */
export default function SupporterListingEditor({ orderNo, token, customerName, initialPublic, initialPublicName, message, variant, hiddenByOperator = false }: Props) {
  const initialChoice = inferPublicNameChoice(initialPublicName, customerName);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [savedName, setSavedName] = useState(initialPublicName);
  const [style, setStyle] = useState<PublicNameStyle>(initialChoice.style);
  const [nickname, setNickname] = useState(initialChoice.nickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasMessage = (message ?? '').trim() !== '';
  const savedDisplay = savedName ?? customerName;
  const choiceChanged = previewPublicName(style, customerName, nickname) !== savedDisplay;

  const save = async (nextPublic: boolean) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/funding/display-name', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo, token, displayNamePublic: nextPublic,
          // 공개할 때만 방식을 보낸다 — 내릴 때 보내면 서버가 표시 이름을 건드릴 이유가 없다.
          ...(nextPublic ? { publicNameStyle: style, publicNickname: nickname } : {}),
        }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) { setError('서버 오류가 발생했습니다.'); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '명단 공개 설정을 바꾸지 못했습니다.'); return; }
      setIsPublic(Boolean(json.displayNamePublic));
      setSavedName(typeof json.publicName === 'string' ? json.publicName : null);
      // 공개 명단은 상태 API 응답(s-maxage=60 · SWR 300)을 거쳐 나가므로 즉시 뜨지 않는다 —
      // 그걸 말하지 않으면 "공개가 안 됐다"는 문의가 온다.
      setNotice(json.displayNamePublic
        ? '후원자 명단에 올렸습니다. 프로젝트 페이지에는 최대 몇 분 뒤 반영됩니다.'
        : '후원자 명단에서 내렸습니다. 프로젝트 페이지에는 최대 몇 분 뒤 반영됩니다.');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally { setBusy(false); }
  };

  const feedback = (
    <>
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-gray-700 dark:text-gray-200">{notice}</p>}
    </>
  );

  /**
   * **운영자가 내린 뒤에는 올리기·이름 편집을 그리지 않는다. 동의 철회만 남긴다.**
   *
   * `/api/funding/display-name`이 이 상태에서 **켜는** 요청만 409로 거부하므로
   * (pages/api/funding/display-name.ts) 올리기·표시 이름 저장 버튼을 남겨 두면 눌러도 실패만
   * 한다. 예전에는 그 저장이 200으로 성공해 "명단에 올렸습니다"라는 거짓 성공을 돌려줬다 —
   * 실제로는 `listing_hidden_at`이 남아 명단에 뜨지 않는다.
   *
   * 반면 **철회는 약관 제13조 2항이 이 화면에서 약속한 것**이고 서버도 받아 준다. 운영자가
   * 내려 뒀다는 사정이 그 권리를 없앨 이유가 없으므로(숨김이 풀리면 저장한 값이 그대로
   * 적용된다) 공개에 동의해 둔 상태라면 내리기 버튼 하나는 남긴다.
   */
  if (hiddenByOperator) {
    return (
      <div className="mt-6 rounded-xl border border-gray-200 p-4 text-left dark:border-gray-700">
        <p className="break-keep text-sm text-gray-900 dark:text-white">
          운영 기준에 따라 후원자 명단에서 내려 두었습니다. 표시 이름·메시지는 공개되지 않습니다.
          다시 올리기를 원하시면 문의해 주세요.
        </p>
        {isPublic && (
          <>
            <p className="typo-card-meta mt-1">공개 동의는 아직 켜져 있습니다 — 여기서 거둘 수 있습니다.</p>
            <div className="mt-4">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save(false)}>공개 동의 철회</Button>
            </div>
          </>
        )}
        {feedback}
      </div>
    );
  }

  if (variant === 'success' && isPublic) {
    return (
      <div className="mt-6 rounded-xl border border-gray-200 p-4 text-left dark:border-gray-700">
        <p className="break-keep text-sm text-gray-900 dark:text-white">
          후원자 명단에 <span className="whitespace-nowrap"><span className="font-semibold">{savedDisplay}</span>(으)로</span> 올라갑니다.
        </p>
        <p className="typo-card-meta mt-1">표시 이름을 바꾸거나 내리려면 펀딩 확인 페이지를 이용해 주세요.</p>
        {feedback}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 p-4 text-left dark:border-gray-700">
      {isPublic ? (
        <p className="break-keep text-sm text-gray-900 dark:text-white">
          후원자 명단에 <span className="whitespace-nowrap"><span className="font-semibold">{savedDisplay}</span>(으)로</span> 올라가 있습니다.
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">후원자 명단에 이름을 올리시겠어요?</p>
          <p className="typo-card-meta mt-1">
            {hasMessage
              ? '남겨 주신 응원 메시지는 명단에 올려야 프로젝트 페이지에 보입니다.'
              : '프로젝트 페이지 후원자 명단에 함께한 사람으로 이름이 올라갑니다.'}
            {' '}실명 대신 가린 이름이나 닉네임도 고를 수 있습니다.
          </p>
        </>
      )}

      <PublicNameChoice
        customerName={customerName}
        style={style}
        nickname={nickname}
        onStyleChange={setStyle}
        onNicknameChange={setNickname}
        message={message ?? undefined}
        disabled={busy}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {isPublic ? (
          <>
            <Button type="button" size="sm" disabled={busy || !choiceChanged} onClick={() => void save(true)}>표시 이름 저장</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void save(false)}>명단에서 내리기</Button>
          </>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={() => void save(true)}>명단에 올리기</Button>
        )}
      </div>
      {feedback}
    </div>
  );
}
