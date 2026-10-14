import Link from 'next/link';

import { ImageUploadField } from '../../funding/creator/ImageUploadField';
import { Button } from '../../ui/Button';
import { Field, TextArea, TextInput } from '../../ui/Field';
import { Panel } from '../../ui/Panel';
import SectionHeading from '../../ui/SectionHeading';
import { ArrowDown, ArrowUp, Plus, X } from '../../../lib/lucide-icons';
import { MIN_LEAD_DAYS, MIN_TICKET_PRICE, SHOW_DRAFT_LIMITS as L, type ShowSubmissionDraft } from '../../../lib/shows/organizer/draft';
import { showUploadUrl } from './api';

interface Props {
  submissionId: string;
  value: ShowSubmissionDraft;
  onChange: (next: ShowSubmissionDraft) => void;
  /** 심사 중·반려 — 모든 칸이 잠긴다. */
  readOnly: boolean;
  /**
   * 승인 뒤 — 판매 조건(관람 등급·공연 시간·장소·회차·정원·티켓 종류)만 잠긴다.
   * 서버(`mergeApprovedEdit`)가 어차피 승인본 값으로 되돌리므로 이 값은 안내다.
   */
  locked: boolean;
}

/** 빈 칸은 null — 숫자 칸을 비워 두는 것과 0을 적는 것을 가른다(서버 intOrNull과 같은 규칙). */
const toNumberOrNull = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw));

const LOCKED_HINT = '판매 조건은 운영자에게 요청해 주세요.';

/**
 * 주최자 공연 초안 편집 폼 — 한 페이지 네 절(공연 정보·장소·회차와 티켓·출연진).
 * 값은 부모(편집 화면)가 들고 있다가 "임시 저장"·제출 때 통째로 보낸다(PUT body = 초안 전체).
 * 이미지 업로드도 저장이 아니다 — 받은 주소를 초안에 넣을 뿐이다(펀딩 ImageUploadField와 같다).
 */
export function ShowDraftForm({ submissionId, value: d, onChange, readOnly, locked }: Props) {
  const set = <K extends keyof ShowSubmissionDraft>(key: K, v: ShowSubmissionDraft[K]) => onChange({ ...d, [key]: v });
  const saleLocked = readOnly || locked;

  const setShowtime = (i: number, v: string) => set('showtimes', d.showtimes.map((s, j) => (j === i ? v : s)));
  const setTicket = (i: number, patch: Partial<ShowSubmissionDraft['ticketTypes'][number]>) =>
    set('ticketTypes', d.ticketTypes.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const setPerformer = (i: number, patch: Partial<ShowSubmissionDraft['performers'][number]>) =>
    set('performers', d.performers.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const movePerformer = (i: number, delta: -1 | 1) => {
    const next = [...d.performers];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    set('performers', next);
  };

  return (
    <div className="flex flex-col gap-14">
      <section aria-labelledby="show-section-info">
        <SectionHeading eyebrow="공연 정보" index="01" title={<span id="show-section-info">어떤 공연인가요</span>} as="h2" className="mb-6 md:mb-8" />
        <div className="flex flex-col gap-5">
          <Field id="show-title" label="공연 제목" required hint="부제는 아래 칸에 따로 적어요.">
            <TextInput value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={L.title} disabled={readOnly} />
          </Field>
          <Field id="show-subtitle" label="부제">
            <TextInput value={d.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={L.subtitle} disabled={readOnly} />
          </Field>
          <Field id="show-presenter" label="주최 이름" required hint="공연 페이지에 주최로 적히는 이름이에요.">
            <TextInput value={d.presenterName} onChange={(e) => set('presenterName', e.target.value)} maxLength={L.presenterName} disabled={readOnly} />
          </Field>
          <ImageUploadField
            uploadUrl={showUploadUrl(submissionId, 'poster')}
            value={d.posterUrl ?? ''}
            onChange={(url) => set('posterUrl', url)}
            disabled={readOnly}
            label="포스터"
            hint="세로 포스터를 올려 주세요."
          />
          <Field id="show-description" label="공연 소개" required hint="빈 줄로 문단을 나눠요.">
            <TextArea
              value={d.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={L.description}
              rows={10}
              disabled={readOnly}
            />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="show-age" label="관람 등급" required hint={locked ? LOCKED_HINT : '예: 전체 관람가, 만 7세 이상'}>
              <TextInput value={d.ageRating} onChange={(e) => set('ageRating', e.target.value)} maxLength={L.ageRating} disabled={saleLocked} />
            </Field>
            <Field id="show-running" label="공연 시간(분)" required hint={locked ? LOCKED_HINT : undefined}>
              <TextInput
                type="number"
                inputMode="numeric"
                min={1}
                max={L.runningMinutes}
                step={1}
                value={d.runningMinutes ?? ''}
                onChange={(e) => set('runningMinutes', toNumberOrNull(e.target.value))}
                disabled={saleLocked}
              />
            </Field>
          </div>
        </div>
      </section>

      <section aria-labelledby="show-section-venue">
        <SectionHeading eyebrow="장소" index="02" title={<span id="show-section-venue">어디서 하나요</span>} as="h2" className="mb-6 md:mb-8" />
        <div className="flex flex-col gap-5">
          {locked && <p className="typo-caption text-gray-600 dark:text-gray-400">{LOCKED_HINT}</p>}
          <Field id="show-venue-name" label="공연장 이름" required>
            <TextInput value={d.venueName} onChange={(e) => set('venueName', e.target.value)} maxLength={L.venueName} disabled={saleLocked} />
          </Field>
          <Field id="show-venue-address" label="주소" required hint="공연 페이지의 지도에 쓰여요.">
            <TextInput value={d.venueAddress} onChange={(e) => set('venueAddress', e.target.value)} maxLength={L.venueAddress} disabled={saleLocked} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="show-section-tickets">
        <SectionHeading eyebrow="회차·티켓" index="03" title={<span id="show-section-tickets">언제, 얼마에 파나요</span>} as="h2" className="mb-6 md:mb-8" />
        <div className="flex flex-col gap-8">
          {locked && <p className="typo-caption text-gray-600 dark:text-gray-400">{LOCKED_HINT}</p>}

          <fieldset className="flex flex-col gap-3">
            <legend className="typo-card-title mb-1 text-gray-900 dark:text-white">회차</legend>
            <p className="typo-caption text-gray-600 dark:text-gray-400">
              첫 회차는 오늘로부터 {MIN_LEAD_DAYS}일 뒤부터 잡을 수 있어요. 심사와 판매에 그만큼 걸려요.
            </p>
            {d.showtimes.map((s, i) => (
              <div key={i} className="flex items-end gap-2">
                <Field id={`show-time-${i}`} label={`${i + 1}회차`} className="min-w-0 flex-1">
                  <TextInput type="datetime-local" value={s} onChange={(e) => setShowtime(i, e.target.value)} disabled={saleLocked} />
                </Field>
                {!saleLocked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    shape="pill"
                    aria-label={`${i + 1}회차 지우기`}
                    onClick={() => set('showtimes', d.showtimes.filter((_, j) => j !== i))}
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {!saleLocked && d.showtimes.length < L.showtimes && (
              <div>
                <Button type="button" variant="weak" size="sm" onClick={() => set('showtimes', [...d.showtimes, ''])}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  회차 추가
                </Button>
              </div>
            )}
          </fieldset>

          <Field id="show-capacity" label="정원(석)" required hint="모든 회차에 같은 정원이 적용돼요.">
            <TextInput
              type="number"
              inputMode="numeric"
              min={1}
              max={L.capacity}
              step={1}
              value={d.capacity ?? ''}
              onChange={(e) => set('capacity', toNumberOrNull(e.target.value))}
              disabled={saleLocked}
            />
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="typo-card-title mb-1 text-gray-900 dark:text-white">티켓 종류</legend>
            <p className="typo-caption text-gray-600 dark:text-gray-400">
              {L.ticketTypes}개까지 만들 수 있어요. 가격은 {MIN_TICKET_PRICE.toLocaleString('ko-KR')}원 이상이에요.
            </p>
            {d.ticketTypes.map((t, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                  <Field id={`show-ticket-name-${i}`} label="이름">
                    <TextInput value={t.name} onChange={(e) => setTicket(i, { name: e.target.value })} maxLength={L.ticketName} disabled={saleLocked} />
                  </Field>
                  <Field id={`show-ticket-price-${i}`} label="가격(원)">
                    <TextInput
                      type="number"
                      inputMode="numeric"
                      min={MIN_TICKET_PRICE}
                      max={L.price}
                      step={1}
                      value={t.price ?? ''}
                      onChange={(e) => setTicket(i, { price: toNumberOrNull(e.target.value) })}
                      disabled={saleLocked}
                    />
                  </Field>
                </div>
                {!saleLocked && d.ticketTypes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    shape="pill"
                    aria-label={`${t.name || `${i + 1}번째`} 티켓 지우기`}
                    onClick={() => set('ticketTypes', d.ticketTypes.filter((_, j) => j !== i))}
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {!saleLocked && d.ticketTypes.length < L.ticketTypes && (
              <div>
                <Button type="button" variant="weak" size="sm" onClick={() => set('ticketTypes', [...d.ticketTypes, { name: '', price: null }])}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  티켓 종류 추가
                </Button>
              </div>
            )}
            <p className="typo-caption text-gray-600 dark:text-gray-400">
              환불 규정은 모든 공연이 같아요.{' '}
              <Link href="/ko/shows" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 dark:text-primary-lighter">
                환불 규정 보기
              </Link>
            </p>
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="show-section-lineup">
        <SectionHeading eyebrow="출연진" index="04" title={<span id="show-section-lineup">누가 나오나요</span>} as="h2" className="mb-6 md:mb-8" />
        <div className="flex flex-col gap-4">
          <p className="typo-caption text-gray-600 dark:text-gray-400">
            팀이면 팀 이름 하나로 적어도 돼요. 공연 페이지에 이 순서대로 보여요.
          </p>
          {d.performers.map((p, i) => (
            <Panel key={i} variant="outline" role="group" aria-labelledby={`show-performer-head-${i}`} className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h3 id={`show-performer-head-${i}`} className="typo-card-meta min-w-0 truncate font-medium text-gray-900 dark:text-white">
                  {p.name || `출연진 ${i + 1}`}
                </h3>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" shape="pill" aria-label="위로" disabled={i === 0} onClick={() => movePerformer(i, -1)}>
                      <ArrowUp className="h-5 w-5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      shape="pill"
                      aria-label="아래로"
                      disabled={i === d.performers.length - 1}
                      onClick={() => movePerformer(i, 1)}
                    >
                      <ArrowDown className="h-5 w-5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      shape="pill"
                      aria-label={`${p.name || `출연진 ${i + 1}`} 지우기`}
                      onClick={() => set('performers', d.performers.filter((_, j) => j !== i))}
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
              <Field id={`show-performer-name-${i}`} label="이름" required>
                <TextInput value={p.name} onChange={(e) => setPerformer(i, { name: e.target.value })} maxLength={L.performerName} disabled={readOnly} />
              </Field>
              <Field id={`show-performer-bio-${i}`} label="소개">
                <TextArea value={p.bio} onChange={(e) => setPerformer(i, { bio: e.target.value })} maxLength={L.performerBio} rows={3} disabled={readOnly} />
              </Field>
              <ImageUploadField
                uploadUrl={showUploadUrl(submissionId, 'photo')}
                value={p.photoUrl ?? ''}
                onChange={(url) => setPerformer(i, { photoUrl: url })}
                disabled={readOnly}
                label="사진"
              />
            </Panel>
          ))}
          {!readOnly && d.performers.length < L.performers && (
            <div>
              <Button type="button" variant="weak" size="sm" onClick={() => set('performers', [...d.performers, { name: '', bio: '', photoUrl: null }])}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                출연진 추가
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
