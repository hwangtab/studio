import { useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ChoiceCard, ChoiceGroup } from '../ui/Choice';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import {
  SESSION_CONSENT_SUMMARY,
  SESSION_GENRES,
  SESSION_INSTRUMENTS,
  SESSION_LIMITS,
  SESSION_READING_OPTIONS,
  SESSION_REGIONS,
} from '../../data/sessionMusicians';

/**
 * 세션 연주자 등록·수정 폼 — 공개 등록 화면과 본인 관리 화면이 같이 쓴다.
 * 선택지·한도는 `data/sessionMusicians.ts`(서버 검증과 같은 목록)에서 온다.
 *
 * - `mode="register"`: 만 19세 확인·동의 체크, 봇 트랩(허니팟·작성 시간)이 붙는다.
 * - `mode="manage"`: 이메일은 바꿀 수 없다(관리 링크를 받는 주소라서). 확인·동의는 다시 받지 않는다.
 * 제출 버튼은 파랑 solid — 목적지가 카카오톡이 아니라 폼이므로 노란색 금지(CLAUDE.md 카카오 CTA 배색 규칙).
 */

export interface SessionFormValues {
  stageName: string;
  realName: string;
  primaryInstrument: string;
  instruments: string[];
  otherInstruments: string;
  genres: string[];
  yearsExperience: string;
  reading: string;
  remoteRecording: boolean;
  region: string;
  bio: string;
  sampleLinks: Array<{ url: string; label: string }>;
  /** 숫자만 담는다(쉼표는 화면에서만 붙인다). */
  ratePerSong: string;
  rateNote: string;
  phone: string;
  email: string;
  kakaoId: string;
}

export const EMPTY_SESSION_FORM: SessionFormValues = {
  stageName: '',
  realName: '',
  primaryInstrument: '',
  instruments: [],
  otherInstruments: '',
  genres: [],
  yearsExperience: '',
  reading: '',
  remoteRecording: false,
  region: '',
  bio: '',
  sampleLinks: [{ url: '', label: '' }],
  ratePerSong: '',
  rateNote: '',
  phone: '',
  email: '',
  kakaoId: '',
};

export interface SubmitResult {
  ok: boolean;
  message?: string;
  field?: string;
}

interface Props {
  mode: 'register' | 'manage';
  initial?: SessionFormValues;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<SubmitResult>;
  /** 제출 버튼 아래 추가 블록(관리 화면의 확인·삭제 버튼 등). */
  footer?: React.ReactNode;
}

/** 직접 입력 악기: 쉼표·가운뎃점·줄바꿈으로 나눠 최대 개수까지. */
export const parseOtherInstruments = (raw: string): string[] =>
  raw
    .split(/[,，、·\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, SESSION_LIMITS.otherInstrument.count + 1);

export default function SessionMusicianForm({ mode, initial = EMPTY_SESSION_FORM, submitLabel, onSubmit, footer }: Props) {
  const [values, setValues] = useState<SessionFormValues>(initial);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const openedAt = useRef<number>(Date.now());
  const register = mode === 'register';

  const set = <K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const toggle = (key: 'instruments' | 'genres', id: string) =>
    setValues((prev) => ({ ...prev, [key]: prev[key].includes(id) ? prev[key].filter((v) => v !== id) : [...prev[key], id] }));
  const setLink = (index: number, patch: Partial<{ url: string; label: string }>) =>
    setValues((prev) => ({ ...prev, sampleLinks: prev.sampleLinks.map((link, i) => (i === index ? { ...link, ...patch } : link)) }));

  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const payload: Record<string, unknown> = {
      stageName: values.stageName,
      realName: values.realName,
      primaryInstrument: values.primaryInstrument,
      instruments: [...values.instruments, ...parseOtherInstruments(values.otherInstruments).map((other) => ({ other }))],
      genres: values.genres,
      yearsExperience: values.yearsExperience.trim() === '' ? null : values.yearsExperience.trim(),
      reading: values.reading || null,
      remoteRecording: values.remoteRecording,
      region: values.region || null,
      bio: values.bio,
      sampleLinks: values.sampleLinks.filter((link) => link.url.trim() !== ''),
      ratePerSong: values.ratePerSong,
      rateNote: values.rateNote,
      phone: values.phone,
      email: values.email,
      kakaoId: values.kakaoId,
    };
    if (register) {
      payload.adultConfirmed = adultConfirmed;
      payload.consent = consent;
      payload.company = honeypot;
      payload._formFillMs = Date.now() - openedAt.current;
    }
    setBusy(true);
    try {
      const result = await onSubmit(payload);
      if (!result.ok) setError({ message: result.message || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.', field: result.field });
    } catch {
      setError({ message: '네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = register
    ? adultConfirmed && consent && values.stageName.trim() !== '' && values.realName.trim() !== '' && values.primaryInstrument !== ''
    : values.stageName.trim() !== '' && values.realName.trim() !== '' && values.primaryInstrument !== '';

  return (
    <form onSubmit={submit} noValidate className="space-y-10">
      {register && (
        // 봇 트랩 — 사람 눈에는 보이지 않고 키보드로도 닿지 않는다.
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            회사
            <input type="text" name="company" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </label>
        </div>
      )}

      <section className="space-y-4" aria-labelledby="sm-basic">
        <h2 id="sm-basic" className="typo-card-title">기본 정보</h2>
        <Field id="sm-stageName" label="활동명" required error={fieldError('stageName')} hint="연주할 때 쓰는 이름이에요.">
          <TextInput value={values.stageName} maxLength={SESSION_LIMITS.stageName.max} onChange={(e) => set('stageName', e.target.value)} autoComplete="nickname" />
        </Field>
        <Field id="sm-realName" label="실명" required error={fieldError('realName')} hint="섭외와 계약에만 쓰고 운영자만 봐요. 사이트에 공개하지 않아요.">
          <TextInput value={values.realName} maxLength={SESSION_LIMITS.realName.max} onChange={(e) => set('realName', e.target.value)} autoComplete="name" />
        </Field>
        {register && (
          <Checkbox
            checked={adultConfirmed}
            onChange={(e) => setAdultConfirmed(e.target.checked)}
            emphasis
            label="만 19세 이상이에요"
            hint="지금은 만 19세 이상만 등록할 수 있어요."
          />
        )}
        {fieldError('adultConfirmed') && <p role="alert" className="typo-caption text-red-600 dark:text-red-400">{fieldError('adultConfirmed')}</p>}
      </section>

      <section className="space-y-4" aria-labelledby="sm-play">
        <h2 id="sm-play" className="typo-card-title">연주</h2>
        <Field id="sm-primary" label="주 악기" required error={fieldError('primaryInstrument')}>
          <Select value={values.primaryInstrument} onChange={(e) => set('primaryInstrument', e.target.value)}>
            <option value="">고르세요</option>
            {SESSION_INSTRUMENTS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </Select>
        </Field>
        <ChoiceGroup label="다룰 수 있는 악기" variant="pill" hint="주 악기 말고 연주할 수 있는 악기를 모두 골라 주세요." error={fieldError('instruments')}>
          {SESSION_INSTRUMENTS.map((option) => (
            <ChoiceCard
              key={option.id}
              type="checkbox"
              variant="pill"
              title={option.label}
              checked={values.instruments.includes(option.id)}
              onChange={() => toggle('instruments', option.id)}
            />
          ))}
        </ChoiceGroup>
        <Field id="sm-other" label="목록에 없는 악기" hint={`쉼표로 나눠 적어 주세요. 최대 ${SESSION_LIMITS.otherInstrument.count}개.`}>
          <TextInput value={values.otherInstruments} onChange={(e) => set('otherInstruments', e.target.value)} placeholder="예: 우쿨렐레, 가야금" />
        </Field>
        <ChoiceGroup label="장르" variant="pill" error={fieldError('genres')}>
          {SESSION_GENRES.map((option) => (
            <ChoiceCard
              key={option.id}
              type="checkbox"
              variant="pill"
              title={option.label}
              checked={values.genres.includes(option.id)}
              onChange={() => toggle('genres', option.id)}
            />
          ))}
        </ChoiceGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sm-years" label="경력(년)" error={fieldError('yearsExperience')}>
            <TextInput value={values.yearsExperience} onChange={(e) => set('yearsExperience', e.target.value)} type="number" inputMode="numeric" min={0} max={70} />
          </Field>
          <Field id="sm-reading" label="악보 리딩" error={fieldError('reading')}>
            <Select value={values.reading} onChange={(e) => set('reading', e.target.value)}>
              <option value="">선택 안 함</option>
              {SESSION_READING_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="sm-region" label="스튜디오 방문 가능 지역" error={fieldError('region')} hint="스튜디오 놀은 서울 은평에 있어요. 방문해서 녹음할 수 있는 지역을 골라 주세요.">
          <Select value={values.region} onChange={(e) => set('region', e.target.value)}>
            <option value="">선택 안 함</option>
            {SESSION_REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </Select>
        </Field>
        <Checkbox
          checked={values.remoteRecording}
          onChange={(e) => set('remoteRecording', e.target.checked)}
          label="원격 녹음 가능해요"
          hint="내 장비로 녹음해서 파일로 보내는 방식이에요."
        />
      </section>

      <section className="space-y-4" aria-labelledby="sm-intro">
        <h2 id="sm-intro" className="typo-card-title">소개와 샘플</h2>
        <Field id="sm-bio" label="경력·참여작 소개" error={fieldError('bio')} hint={`${values.bio.length}/${SESSION_LIMITS.bio.max}자`}>
          <TextArea value={values.bio} maxLength={SESSION_LIMITS.bio.max} onChange={(e) => set('bio', e.target.value)} rows={6} />
        </Field>
        <div className="space-y-3">
          <p className="typo-card-meta font-medium text-gray-700 dark:text-gray-300">
            연주 샘플 링크 <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
          </p>
          <p className="typo-caption">유튜브·사운드클라우드·인스타그램·드라이브 같은 링크를 1~{SESSION_LIMITS.sampleLinks.max}개 붙여 넣어 주세요. 음원 파일을 따로 만들 필요는 없어요.</p>
          {values.sampleLinks.map((link, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <Field id={`sm-link-${index}`} label={`링크 ${index + 1}`} error={index === 0 ? fieldError('sampleLinks') : undefined}>
                <TextInput value={link.url} onChange={(e) => setLink(index, { url: e.target.value })} type="text" inputMode="url" autoComplete="off" placeholder="예: youtube.com/watch?v=…" maxLength={SESSION_LIMITS.sampleUrl.max} />
              </Field>
              <Field id={`sm-link-label-${index}`} label="설명(선택)">
                <TextInput value={link.label} onChange={(e) => setLink(index, { label: e.target.value })} maxLength={SESSION_LIMITS.sampleLabel.max} />
              </Field>
            </div>
          ))}
          {values.sampleLinks.length < SESSION_LIMITS.sampleLinks.max && (
            <Button type="button" variant="weak" size="sm" onClick={() => set('sampleLinks', [...values.sampleLinks, { url: '', label: '' }])}>
              링크 추가
            </Button>
          )}
        </div>
        <Field
          id="sm-rate-per-song"
          label="곡당 희망 연주비(원, 선택)"
          error={fieldError('ratePerSong')}
          hint="원격 녹음이든 스튜디오에 와서 하든 곡당 기준이에요. 참고용이고, 실제 연주비는 곡마다 협의해요."
        >
          <TextInput
            value={values.ratePerSong === '' ? '' : Number(values.ratePerSong).toLocaleString('ko-KR')}
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            placeholder="예: 150,000"
            onChange={(e) => set('ratePerSong', e.target.value.replace(/\D/g, '').slice(0, 9))}
          />
        </Field>
        <Field id="sm-rate" label="연주비 메모(선택)" error={fieldError('rateNote')} hint="예: 편곡 포함 시 별도, 협의 가능">
          <TextInput value={values.rateNote} maxLength={SESSION_LIMITS.rateNote.max} onChange={(e) => set('rateNote', e.target.value)} />
        </Field>
      </section>

      <section className="space-y-4" aria-labelledby="sm-contact">
        <h2 id="sm-contact" className="typo-card-title">연락처</h2>
        <p className="typo-caption">운영자만 볼 수 있어요. 섭외할 일이 생겼을 때만 연락드려요.</p>
        <Field id="sm-phone" label="휴대전화" required error={fieldError('phone')}>
          <TextInput value={values.phone} onChange={(e) => set('phone', e.target.value)} type="tel" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field
          id="sm-email"
          label="이메일"
          required
          error={fieldError('email')}
          hint={register ? '등록 확인과, 등록 정보를 고치거나 지우는 링크를 이 주소로 보내요.' : '이메일은 바꿀 수 없어요. 바꾸려면 등록을 지우고 다시 등록해 주세요.'}
        >
          <TextInput value={values.email} onChange={(e) => set('email', e.target.value)} type="email" inputMode="email" autoComplete="email" disabled={!register} />
        </Field>
        <Field id="sm-kakao" label="카카오톡 ID(선택)" error={fieldError('kakaoId')}>
          <TextInput value={values.kakaoId} maxLength={SESSION_LIMITS.kakaoId.max} onChange={(e) => set('kakaoId', e.target.value)} />
        </Field>
      </section>

      {register && (
        <section className="space-y-3" aria-labelledby="sm-consent">
          <h2 id="sm-consent" className="typo-card-title">개인정보 수집·이용 동의</h2>
          <Panel variant="filled" padding="compact">
            <dl className="space-y-2 text-sm">
              {SESSION_CONSENT_SUMMARY.map((row) => (
                <div key={row.label} className="grid gap-1 sm:grid-cols-[6.5rem_1fr]">
                  <dt className="font-semibold text-gray-900 dark:text-white">{row.label}</dt>
                  <dd>{row.text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm">
              자세한 내용은{' '}
              {/* 폼을 쓰던 자리를 지키려고 새 탭으로 연다 — 새 탭은 문서 이동이라 <a>가 맞다. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/ko/privacy-policy" className="underline" target="_blank" rel="noopener noreferrer">
                개인정보 처리방침
              </a>
              에서 볼 수 있어요.
            </p>
          </Panel>
          <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} emphasis label="위 내용에 동의해요 (필수)" />
          {fieldError('consent') && <p role="alert" className="typo-caption text-red-600 dark:text-red-400">{fieldError('consent')}</p>}
        </section>
      )}

      {error && <Notice tone="error">{error.message}</Notice>}

      <Button type="submit" fullWidth size="lg" disabled={busy || !canSubmit}>
        {busy ? '보내는 중…' : submitLabel}
      </Button>
      {footer}
    </form>
  );
}
