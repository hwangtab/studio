const extractFirstImageUrl = (content: string | null | undefined): string | null => {
  if (!content) return null;

  const imageRegex = /!\[.*?\]\(([^)]+)\)/;
  const match = content.match(imageRegex);

  return match ? match[1] : null;
};

export {
  extractFirstImageUrl,
};
