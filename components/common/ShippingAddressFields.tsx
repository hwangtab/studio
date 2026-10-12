import { useEffect, useRef, useState } from 'react';

import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { formatKakaoAddress, loadKakaoPostcode } from '../funding/kakaoPostcode';

export interface ShippingAddressValue {
  postcode: string;
  address1: string;
  address2: string;
  memo: string;
}

export const EMPTY_SHIPPING_ADDRESS: ShippingAddressValue = { postcode: '', address1: '', address2: '', memo: '' };

/**
 * 배송지 입력 — 우편번호·주소는 카카오(다음) 우편번호 검색으로 채우고, 상세주소·배송 메모만 손으로 적는다.
 * 펀딩 후원 폼(PledgeWizard)의 같은 구획을 옮긴 공용 부품이다(상점이 먼저 쓴다). 검색 스크립트는 처음 누를 때 받고,
 * 불러오지 못하면 두 칸을 직접 적게 연다. CSP는 middleware.ts가 이미 허용한다(components/funding/kakaoPostcode.ts).
 */
export default function ShippingAddressFields({ idPrefix, value, onChange, limits }: {
  idPrefix: string;
  value: ShippingAddressValue;
  onChange: (next: ShippingAddressValue) => void;
  limits: { postcode: number; address1: number; address2: number; memo: number };
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const embedRef = useRef<HTMLDivElement>(null);
  const address2Ref = useRef<HTMLInputElement>(null);
  // 검색 완료 콜백이 최신 값을 덮어쓰지 않게(상세주소를 먼저 적은 경우) 참조로 읽는다.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    loadKakaoPostcode()
      .then((Postcode) => {
        const el = embedRef.current;
        if (cancelled || !el) return;
        el.innerHTML = '';
        new Postcode({
          width: '100%', height: '100%',
          oncomplete: (data) => {
            onChange({ ...valueRef.current, postcode: data.zonecode, address1: formatKakaoAddress(data) });
            setSearchOpen(false);
            window.setTimeout(() => address2Ref.current?.focus(), 0);
          },
        }).embed(el);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchOpen(false);
        setManual(true);
      });
    return () => { cancelled = true; };
  }, [searchOpen, onChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-end gap-2 sm:col-span-2">
        <Field id={`${idPrefix}-post`} label="우편번호" required className="w-32 shrink-0">
          <TextInput
            required
            readOnly={!manual}
            inputMode="numeric"
            maxLength={limits.postcode}
            value={value.postcode}
            onClick={() => { if (!manual) setSearchOpen(true); }}
            onChange={(e) => onChange({ ...value, postcode: e.target.value })}
          />
        </Field>
        {!manual && (
          <Button type="button" variant="weak" onClick={() => setSearchOpen((open) => !open)} aria-expanded={searchOpen}>
            {searchOpen ? '검색 닫기' : '주소 검색'}
          </Button>
        )}
      </div>
      {searchOpen && (
        <div className="sm:col-span-2">
          <div ref={embedRef} className="h-[440px] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700" />
        </div>
      )}
      {manual && (
        <p className="typo-card-meta sm:col-span-2" role="status">주소 검색을 불러오지 못했어요. 우편번호와 주소를 직접 적어 주세요.</p>
      )}
      <div className="sm:col-span-2">
        <Field id={`${idPrefix}-addr1`} label="주소" required>
          <TextInput
            required
            readOnly={!manual}
            maxLength={limits.address1}
            value={value.address1}
            placeholder={manual ? undefined : '주소 검색을 눌러 찾아 주세요'}
            onClick={() => { if (!manual && !value.address1) setSearchOpen(true); }}
            onChange={(e) => onChange({ ...value, address1: e.target.value })}
          />
        </Field>
      </div>
      <div>
        <Field id={`${idPrefix}-addr2`} label="상세주소">
          <TextInput ref={address2Ref} maxLength={limits.address2} value={value.address2} onChange={(e) => onChange({ ...value, address2: e.target.value })} />
        </Field>
      </div>
      <div>
        <Field id={`${idPrefix}-memo`} label="배송 메모">
          <TextInput maxLength={limits.memo} value={value.memo} onChange={(e) => onChange({ ...value, memo: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
