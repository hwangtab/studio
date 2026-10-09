import { useId } from 'react';

import { PLEDGE_TEXT_LIMITS } from '../../lib/funding/policy';
import { maskName, previewPublicName, type PublicNameStyle } from '../../lib/funding/publicName';
import { TextInput } from '../ui/Field';
import { ChoiceCard, ChoiceGroup } from '../ui/Choice';

interface Props {
  /** 결제자 이름. 실명·가린 이름 선택지의 라벨과 미리보기에 쓴다. 비어 있으면 자리표시를 보인다. */
  customerName: string;
  style: PublicNameStyle;
  nickname: string;
  onStyleChange: (style: PublicNameStyle) => void;
  onNicknameChange: (nickname: string) => void;
  /** 미리보기에 함께 보일 응원 메시지. 없으면 이름만 보인다. */
  message?: string;
  disabled?: boolean;
}

/**
 * 후원자 명단에 **어떤 이름으로** 올릴지 고르는 칸과 미리보기.
 *
 * 공개에 동의한 뒤에만 그린다(호출부가 판단). 후원 폼·결제 완료 화면·펀딩 확인 화면이 같은
 * 컴포넌트를 쓴다 — 세 곳의 선택지와 미리보기가 갈리면 "여기선 닉네임이 됐는데 저기선
 * 실명"이 된다. 미리보기는 서버 검증과 같은 함수(`previewPublicName`)로 만든다.
 */
export default function PublicNameChoice({ customerName, style, nickname, onStyleChange, onNicknameChange, message, disabled }: Props) {
  const uid = useId();
  const name = customerName.trim();
  const shown = previewPublicName(style, name, nickname);
  const trimmedMessage = (message ?? '').trim();

  return (
    <div className="mt-3 rounded-xl bg-white/80 p-4 dark:bg-gray-900/50">
      {/* flex-wrap이었을 때는 줄바꿈 지점이 이름 길이·화면 너비 조합에 따라 매번 달라졌다
          (2줄+1줄 / 3칸 한 줄 / 칸마다 2줄로 접힘이 뒤섞여 나타났다, 2026-09-30 지적 —
          "모바일에서 해상도에 따라 UI 요소 배열이 뒤바뀌는 증상"). grid로 바꿔 모바일은
          항상 한 칸씩 쌓고(sm 미만), sm 이상에서만 3칸 한 줄로 — 어느 폭에서나 배열이
          고정된다(ChoiceGroup columns={3}). 칸이 전체 폭을 쓰므로 "실명 (긴 이름)"도 한 줄에
          들어간다. 그룹 이름은 fieldset/legend가 라디오 그룹 의미를 준다. */}
      <ChoiceGroup label="명단에 표시할 이름" columns={3}>
        <ChoiceCard
          name={`${uid}-style`}
          checked={style === 'real'}
          disabled={disabled}
          onChange={() => onStyleChange('real')}
          title={`실명${name ? ` (${name})` : ''}`}
        />
        <ChoiceCard
          name={`${uid}-style`}
          checked={style === 'masked'}
          disabled={disabled}
          onChange={() => onStyleChange('masked')}
          title={`가린 이름${name ? ` (${maskName(name)})` : ''}`}
        />
        <ChoiceCard
          name={`${uid}-style`}
          checked={style === 'nickname'}
          disabled={disabled}
          onChange={() => onStyleChange('nickname')}
          title="닉네임"
        />
      </ChoiceGroup>
      {style === 'nickname' && (
        <TextInput
          aria-label="명단에 표시할 닉네임"
          className="mt-2"
          placeholder="예: 연대하는 청취자"
          maxLength={PLEDGE_TEXT_LIMITS.publicNickname}
          required
          value={nickname}
          disabled={disabled}
          onChange={(e) => onNicknameChange(e.target.value)}
        />
      )}
      {/* 동의한 것이 실제로 어떻게 보이는지를 보여 준다. 무엇이 공개되는지 눈으로 확인되면
          동의를 망설일 이유가 줄고, 기대와 다르면 여기서 고칠 수 있다. */}
      {/* 이름은 한 덩어리로 보여야 한다. 한 줄에 이어 두면 좁은 화면에서 한글이 글자 단위로
          끊겨 "홍*" / "동"처럼 이름이 두 줄로 갈렸다(2026-09-26 모바일 실측). 라벨을 윗줄로
          떼고, 이름은 줄을 바꾸지 않으며, 한글 줄바꿈은 어절 단위(break-keep)로 한다. */}
      <div className="mt-3 text-sm" aria-live="polite">
        <p className="typo-card-meta">이렇게 보여요</p>
        <p className="mt-1 break-keep text-gray-600 dark:text-gray-300">
          {shown ? (
            <span className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">{shown}</span>
          ) : (
            // 실제 값이 아직 없을 때 "이름"을 굵게 검게 보여주면 미리보기 결과처럼 읽힌다
            // (2026-09-30 지적 — "이렇게 보입니다 / 이름"이 실제 표시값처럼 보였다).
            // 옅은 색 + 안내 문구로 "아직 안 채워졌다"는 뜻을 분명히 한다.
            <span className="font-normal text-gray-400 dark:text-gray-500">
              {style === 'nickname' ? '닉네임을 입력해 주세요' : '이름을 입력해 주세요'}
            </span>
          )}
          {trimmedMessage && <span className="break-words"> “{trimmedMessage.length > 60 ? `${trimmedMessage.slice(0, 60)}…` : trimmedMessage}”</span>}
        </p>
      </div>
    </div>
  );
}
