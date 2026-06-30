import type { PricingBadge } from './PriceLeader';
import type { BenefitItem } from './PracticeRoomCards';

export interface TitleDescriptionItem {
  title: string;
  description: string;
}

const isRecord = (entry: unknown): entry is Record<string, unknown> => (
  Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
);

export const parseResidentBenefits = (raw: unknown): BenefitItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): BenefitItem | null => {
      if (!isRecord(entry) || typeof entry.title !== 'string' || !Array.isArray(entry.points)) {
        return null;
      }

      const points = entry.points.filter((point): point is string => typeof point === 'string');
      return {
        title: entry.title,
        points,
        ...(typeof entry.valueBadge === 'string' && { valueBadge: entry.valueBadge }),
      };
    })
    .filter((entry): entry is BenefitItem => entry !== null);
};

export const parsePricingBadges = (raw: unknown): PricingBadge[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): PricingBadge | null => {
      if (!isRecord(entry) || typeof entry.label !== 'string' || typeof entry.caption !== 'string') {
        return null;
      }
      return {
        label: entry.label,
        caption: entry.caption,
      };
    })
    .filter((entry): entry is PricingBadge => entry !== null);
};

export const parseTitleDescriptionItems = (raw: unknown): TitleDescriptionItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): TitleDescriptionItem | null => {
      if (!isRecord(entry) || typeof entry.title !== 'string' || typeof entry.description !== 'string') {
        return null;
      }
      return {
        title: entry.title,
        description: entry.description,
      };
    })
    .filter((entry): entry is TitleDescriptionItem => entry !== null);
};
