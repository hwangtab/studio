/**
 * 정산 때 모금액에서 빼는 스튜디오 서비스 대금(설계비·제작비, 부가세 포함) — **순수 함수**라 화면과 정산이 함께 쓴다.
 *
 * 규칙(개설자 약관 제6조, lib/funding/payout.ts): 서비스가 지정돼 있고(`none` 아님) 설계비를 정산 밖에서 이미 받지 않았으면
 * 설계비를, 그리고 약정 제작비를 뺀다. 직접 개설로 되돌린 행(`none`)은 옛 약정 보존용이라 빼지 않는다.
 *
 * 관리자 화면은 서비스 종류를 바꾸기 전에 이 함수로 "바꾸기 전 → 뒤" 공제액을 보여 준다(2026-10-22 운영자 결정 — 버튼 한 번에
 * 정산 공제액이 바뀌는데 확인이 없었다). DB를 물지 않는다 — 클라이언트 번들에 실려도 된다.
 */
export interface ServiceChargeInput {
  kind: 'none' | 'design' | 'release';
  designFee: number;
  designFeePaidAt: string | Date | null;
  productionFee: number;
}

export interface ServiceCharges {
  designFee: number;
  productionFee: number;
}

export const chargesFromService = (service: ServiceChargeInput | null | undefined): ServiceCharges =>
  service && service.kind !== 'none'
    ? { designFee: service.designFeePaidAt ? 0 : service.designFee, productionFee: service.productionFee }
    : { designFee: 0, productionFee: 0 };

/**
 * 서비스 종류를 `nextKind`로 바꾼 뒤의 공제액. 바꾸는 쪽은 종류만 바꾸고 약정가·입금 기록은 보존한다
 * (lib/funding/projectServices.ts setProjectService) — 행이 없으면 새로 만들며 설계비는 지금 정가(`defaultDesignFee`), 제작비 0.
 */
export const chargesAfterKindChange = (
  current: ServiceChargeInput | null | undefined,
  nextKind: ServiceChargeInput['kind'],
  defaultDesignFee: number,
): ServiceCharges =>
  chargesFromService(
    current
      ? { ...current, kind: nextKind }
      : { kind: nextKind, designFee: defaultDesignFee, designFeePaidAt: null, productionFee: 0 },
  );
