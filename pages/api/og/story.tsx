import type { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0 && lines.length < maxLines) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      break;
    }
    let breakIndex = maxCharsPerLine;
    const spaceIndex = remaining.lastIndexOf(' ', maxCharsPerLine);
    if (spaceIndex > maxCharsPerLine * 0.4) {
      breakIndex = spaceIndex;
    }
    let line = remaining.substring(0, breakIndex);
    if (lines.length === maxLines - 1 && remaining.length > breakIndex) {
      line = line.trimEnd() + '...';
    }
    lines.push(line);
    remaining = remaining.substring(breakIndex).trimStart();
  }

  return lines;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { title, category, date } = req.query;

    const titleText = typeof title === 'string' ? title : 'Studio NOL';
    const categoryText = typeof category === 'string' ? category : '';
    const dateText = typeof date === 'string' ? date : '';

    const titleLines = wrapText(titleText, 20, 3);
    const titleSvgLines = titleLines
      .map(
        (line, i) =>
          `<text x="80" y="${280 + i * 64}" font-family="sans-serif" font-weight="bold" font-size="48" fill="white">${escapeXml(line)}</text>`
      )
      .join('\n');

    const metaY = 280 + titleLines.length * 64 + 20;
    const metaParts = [categoryText, dateText].filter(Boolean).join('  ·  ');

    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo', 'logo.png');
      const logoBuffer = fs.readFileSync(logoPath);
      const resizedLogo = await sharp(logoBuffer).resize(180, null, { fit: 'inside' }).png().toBuffer();
      logoBase64 = `data:image/png;base64,${resizedLogo.toString('base64')}`;
    } catch {
      // Logo not available — continue without it
    }

    const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="50%" stop-color="#16213e"/>
      <stop offset="100%" stop-color="#0f3460"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#e94560"/>
      <stop offset="100%" stop-color="#ff6b6b"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Decorative accent bar -->
  <rect x="80" y="230" width="60" height="4" fill="url(#accent)" rx="2"/>

  <!-- Title -->
  ${titleSvgLines}

  <!-- Meta info -->
  ${metaParts ? `<text x="80" y="${metaY}" font-family="sans-serif" font-size="22" fill="#a0a0b0">${escapeXml(metaParts)}</text>` : ''}

  <!-- Logo area -->
  ${logoBase64 ? `<image href="${logoBase64}" x="80" y="60" width="180" height="60" preserveAspectRatio="xMinYMid meet"/>` : `<text x="80" y="100" font-family="sans-serif" font-weight="bold" font-size="28" fill="white">Studio NOL</text>`}

  <!-- Bottom line -->
  <rect x="0" y="${HEIGHT - 6}" width="${WIDTH}" height="6" fill="url(#accent)"/>

  <!-- Decorative circles -->
  <circle cx="1050" cy="120" r="80" fill="none" stroke="#e94560" stroke-opacity="0.15" stroke-width="2"/>
  <circle cx="1100" cy="180" r="120" fill="none" stroke="#e94560" stroke-opacity="0.08" stroke-width="2"/>

  <!-- Domain -->
  <text x="1120" y="${HEIGHT - 30}" font-family="sans-serif" font-size="16" fill="#606070" text-anchor="end">studionol.co.kr</text>
</svg>`;

    const image = await sharp(Buffer.from(svg)).png().toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).end(image);
  } catch (error) {
    console.error('OG image generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
}
