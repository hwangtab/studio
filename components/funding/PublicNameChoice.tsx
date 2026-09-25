import { useId } from 'react';

import { PLEDGE_TEXT_LIMITS } from '../../lib/funding/policy';
import { maskName, previewPublicName, type PublicNameStyle } from '../../lib/funding/publicName';
import { TextInput } from '../ui/Field';

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

const optionClass =
  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-gray-900 dark:has-[:checked]:border-primary-light dark:has-[:checked]:bg-primary-light/10 dark:has-[:checked]:text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';

/**
 * 서포터 명단에 **어떤 이름으로** 올릴지 고르는 칸과 미리보기.
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
      <p id={`${uid}-label`} className="text-sm font-medium text-gray-900 dark:text-white">명단에 표시할 이름</p>
      <div role="radiogroup" aria-labelledby={`${uid}-label`} className="mt-2 flex flex-wrap gap-2">
        <label className={optionClass}>
          <input type="radio" name={`${uid}-style`} className="h-4 w-4 accent-primary" checked={style === 'real'} disabled={disabled} onChange={() => onStyleChange('real')} />
          실명{name ? ` (${name})` : ''}
        </label>
        <label className={optionClass}>
          <input type="radio" name={`${uid}-style`} className="h-4 w-4 accent-primary" checked={style === 'masked'} disabled={disabled} onChange={() => onStyleChange('masked')} />
          가린 이름{name ? ` (${maskName(name)})` : ''}
        </label>
        <label className={optionClass}>
          <input type="radio" name={`${uid}-style`} className="h-4 w-4 accent-primary" checked={style === 'nickname'} disabled={disabled} onChange={() => onStyleChange('nickname')} />
          닉네임
        </label>
      </div>
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
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300" aria-live="polite">
        <span className="typo-card-meta">이렇게 보입니다 · </span>
        <span className="font-semibold text-gray-900 dark:text-white">{shown || (style === 'nickname' ? '닉네임을 입력해 주세요' : '이름')}</span>
        {trimmedMessage && <span className="break-words"> “{trimmedMessage.length > 60 ? `${trimmedMessage.slice(0, 60)}…` : trimmedMessage}”</span>}
      </p>
    </div>
  );
}
