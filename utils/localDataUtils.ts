const extractFirstImageUrl = (content: string | null | undefined): string | null => {
  if (!content) return null;
  
  const imageRegex = /!\[.*?\]\(([^)]+)\)/;
  const match = content.match(imageRegex);
  
  return match ? match[1] : null;
};

const stripMarkdown = (content: string | null | undefined): string => {
  if (!content) return '';
  
  return content
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
};

const summarizeContent = (content: string | null | undefined, maxLength: number = 150): string => {
  if (!content) return '';
  
  const plainText = stripMarkdown(content);
  
  if (plainText.length <= maxLength) return plainText;
  
  const lastSpaceIndex = plainText.lastIndexOf(' ', maxLength);
  const summary = plainText.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
  
  return summary + '...';
};

export {
  summarizeContent,
  extractFirstImageUrl,
  stripMarkdown
};
