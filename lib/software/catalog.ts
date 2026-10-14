import { SOFTWARE_PRODUCTS, type SoftwareProduct, type SoftwareRelease } from '../../data/software/catalog';
import { SOFTWARE_DEFAULT_MAX_ACTIVATIONS, SOFTWARE_DEFAULT_TRIAL_DAYS } from '../../data/software/policy';

/** 공개된 상품 목록(정본 순서). */
export const listPublishedSoftware = (): SoftwareProduct[] => SOFTWARE_PRODUCTS.filter((p) => p.published);

/** 공개된 상품 하나. 없거나 비공개면 null. */
export const getPublishedSoftware = (slug: unknown): SoftwareProduct | null =>
  typeof slug === 'string' ? SOFTWARE_PRODUCTS.find((p) => p.slug === slug && p.published) ?? null : null;

/** 비공개 포함 — 관리자 발급(출시 전 시험 키)용. */
export const getAnySoftware = (slug: unknown): SoftwareProduct | null =>
  typeof slug === 'string' ? SOFTWARE_PRODUCTS.find((p) => p.slug === slug) ?? null : null;

export const latestReleaseOf = (product: SoftwareProduct): SoftwareRelease | null => product.releases[0] ?? null;

export const trialDaysOf = (product: SoftwareProduct): number => product.trialDays ?? SOFTWARE_DEFAULT_TRIAL_DAYS;

export const maxActivationsOf = (product: SoftwareProduct): number => product.maxActivations ?? SOFTWARE_DEFAULT_MAX_ACTIVATIONS;
