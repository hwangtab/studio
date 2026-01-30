export const SECTION_BG: Record<string, string> = {
  hero: 'bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent',
  light: 'bg-white dark:bg-gray-800',
  alternate: 'bg-gray-50 dark:bg-gray-900/50',
  highlight: 'bg-gradient-to-r from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10',
  cta: 'bg-gray-50 dark:bg-gray-950',
  transparent: 'bg-transparent',
};

export const SECTION_PADDING: Record<string, string> = {
  standard: 'py-16',
  large: 'py-20',
  small: 'py-12',
};

export const getSectionClass = (bgType: string = 'light', paddingType: string = 'standard'): string => {
  return `${SECTION_BG[bgType]} ${SECTION_PADDING[paddingType]}`;
};

export default SECTION_BG;
