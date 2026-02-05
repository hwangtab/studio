/**
 * 공유 데이터를 소셜 미디로나 클립보드로 공유합니다.
 */
export async function shareContent(data: {
  title: string;
  text: string;
  url: string;
  messages?: {
    copied?: string;
    unsupported?: string;
  };
}): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${data.title}\n${data.url}`);
      alert(data.messages?.copied || 'Link copied to clipboard.');
    } else {
      throw new Error(data.messages?.unsupported || 'Sharing is not supported in this browser.');
    }
  } catch (error) {
    // 사용자가 공유를 취소한 경우는 에러로 처리하지 않음
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    console.error('Share failed:', error);
  }
}
