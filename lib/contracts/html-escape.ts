/**
 * Escape user-controlled strings that are interpolated into HTML/Markdown output.
 */
export const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Escape a string for safe interpolation into Markdown table cells.
 */
export const escapeMarkdown = (unsafe: string): string =>
  unsafe
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
