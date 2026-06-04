export const normalizePageNumber = (
  value: string | string[] | number | undefined,
  totalPages: number,
): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  const maxPage = Math.max(1, Math.floor(totalPages));

  if (!Number.isFinite(parsed)) return 1;

  const page = Math.floor(parsed);
  if (page < 1) return 1;
  return Math.min(page, maxPage);
};
