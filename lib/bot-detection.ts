/**
 * Bot / crawler user-agent pattern matcher.
 *
 * Maintained centrally so middleware.ts stays clean and new AI bots
 * (gptbot, claudebot, oai-searchbot, etc.) can be added in one place.
 *
 * Review cadence: quarterly, or when a new major AI/search bot emerges.
 * Last updated: 2026-04-20
 */

export const BOT_PATTERN =
    /bot|googlebot|google-extended|googleother|bingbot|bingpreview|adsbot|mediapartners|crawler|spider|robot|crawling|yeti|naverbot|daumoa|petalbot|slurp|duckduckbot|applebot|facebookexternalhit|linkedinbot|twitterbot|slackbot|whatsapp|discordbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|ccbot|bytespider|mj12bot|ahrefsbot|semrushbot/i;
