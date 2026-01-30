export function summarizeText(text: string, maxLength: number = 100): string {
  if (!text) return '';
  
  if (text.length <= maxLength) return text;
  
  const lastSpaceIndex = text.lastIndexOf(' ', maxLength);
  const summary = text.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
  
  return summary + (text.length > maxLength ? '...' : '');
}
