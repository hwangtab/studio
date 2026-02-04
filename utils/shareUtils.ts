/**
 * 공유 데이터를 소셜 미디로나 클립보드로 공유합니다.
 */
export async function shareContent(data: {
    title: string;
    text: string;
    url: string;
}): Promise<void> {
    try {
        if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share(data);
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(`${data.title}\n${data.url}`);
            alert('링크가 클립보드에 복사되었습니다.');
        } else {
            throw new Error('공유 기능을 지원하지 않는 브라우저입니다.');
        }
    } catch (error) {
        // 사용자가 공유를 취소한 경우는 에러로 처리하지 않음
        if (error instanceof Error && error.name === 'AbortError') {
            return;
        }
        console.error('공유 오류:', error);
    }
}
