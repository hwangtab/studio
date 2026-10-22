/**
 * Bot / crawler user-agent pattern matcher.
 *
 * Maintained centrally so middleware.ts stays clean and new AI bots
 * (gptbot, claudebot, oai-searchbot, etc.) can be added in one place.
 *
 * Review cadence: quarterly, or when a new major AI/search bot emerges.
 * Last updated: 2026-09-09
 *
 * `[a-z]+-user` covers answer-engine "real-time fetch on behalf of a user"
 * bots (Claude-User, Perplexity-User, MistralAI-User, ...) as a class rather
 * than one literal per vendor. Chosen over enumerating each token because
 * this repo prioritizes GEO (AI-answer citation) over Google CTR, so a newly
 * launched "<Vendor>-User" bot should be caught without a code change.
 * False-positive risk checked against real browser UA strings (Chrome
 * desktop, Safari iOS, Android WebView) — none contain a "-user" token, so
 * the generalization does not misclassify ordinary visitors. individual
 * literals (chatgpt-user, oai-searchbot, etc.) are kept alongside for
 * bots whose token doesn't follow the "-user" suffix convention.
 */

// 맨 앞 `bot`은 "...Bot" 꼴 크롤러를 넓게 잡는다. 다만 휴대폰 제조사 CUBOT("CUBOT P50" 등)의 실제 모바일 UA까지
// 봇으로 보고 Accept-Language를 무시한 채 /ko로 308했다(2026-10-22 리뷰) — 앞이 "cu"인 경우만 뺀다.
export const BOT_PATTERN =
    /(?<!cu)bot|googlebot|google-extended|googleother|bingbot|bingpreview|adsbot|mediapartners|crawler|spider|robot|crawling|yeti|naverbot|daumoa|petalbot|slurp|duckduckbot|applebot|facebookexternalhit|linkedinbot|twitterbot|slackbot|whatsapp|discordbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|ccbot|bytespider|mj12bot|ahrefsbot|semrushbot|[a-z]+-user/i;
