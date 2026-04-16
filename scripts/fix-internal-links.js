#!/usr/bin/env node
/**
 * fix-internal-links.js
 *
 * Fixes two problems in practice-room story markdown files:
 * 1. Self-links: lines like `**→ **→ [text](/stories/SELF-SLUG)**` that link to the same file
 * 2. Single-link files: files with only 1 internal link (the bold-arrow line) need 5 pipe-separated peer links
 *
 * Strategy:
 * - Remove all `**→ **→ [text](/stories/slug)**` lines
 * - If the file ends up with 0 internal links, append a proper link footer:
 *   `---\n\n[title1](/stories/slug1) | [title2](/stories/slug2) | ... | [title5](/stories/slug5)`
 * - Pick 5 sibling files from the same instrument category (bass/drum/guitar/piano/vocal)
 * - Use the frontmatter title of each sibling as the link text
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');

// ── Identify the 37 problematic files ──────────────────────────────
const BOLD_ARROW_RE = /^\*\*→\s*\*\*→\s*\[.*?\]\(\/stories\/[\w-]+\)\*\*\s*$/;
const INTERNAL_LINK_RE = /\]\(\/stories\//g;

function getKoreanFiles() {
  return fs.readdirSync(STORIES_DIR)
    .filter(f => f.endsWith('.md') && !f.match(/\.(en|es|th|uz|vi|zh)\.md$/))
    .sort();
}

function getSlug(filename) {
  return filename.replace(/\.md$/, '');
}

function getCategory(slug) {
  if (slug.startsWith('practice-room-bass-')) return 'bass';
  if (slug.startsWith('practice-room-drum-')) return 'drum';
  if (slug.startsWith('practice-room-guitar-')) return 'guitar';
  if (slug.startsWith('practice-room-piano-')) return 'piano';
  if (slug.startsWith('practice-room-vocal-')) return 'vocal';
  return null;
}

function getTitle(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const match = content.match(/^title:\s*(.+)$/m);
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function countInternalLinks(content) {
  return (content.match(/\]\(\/stories\//g) || []).length;
}

function hasSelfLink(content, slug) {
  return content.includes(`](/stories/${slug})`);
}

// ── Build sibling pools per category ───────────────────────────────
function buildSiblingPools(koreanFiles, problematicSlugs) {
  const pools = { bass: [], drum: [], guitar: [], piano: [], vocal: [] };

  for (const file of koreanFiles) {
    const slug = getSlug(file);
    const cat = getCategory(slug);
    if (!cat) continue;
    // Include all files in the pool (even problematic ones can be link targets)
    // but skip self when selecting
    const filepath = path.join(STORIES_DIR, file);
    const title = getTitle(filepath);
    if (title) {
      pools[cat].push({ slug, title });
    }
  }

  return pools;
}

// Deterministic selection of 5 siblings, avoiding self and varying per file
function selectSiblings(pool, selfSlug, count = 5) {
  // Filter out self
  const candidates = pool.filter(p => p.slug !== selfSlug);
  if (candidates.length <= count) return candidates;

  // Use a hash of the slug to pick a deterministic starting point
  let hash = 0;
  for (let i = 0; i < selfSlug.length; i++) {
    hash = ((hash << 5) - hash + selfSlug.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);

  const step = Math.max(1, Math.floor(candidates.length / count));
  const start = hash % candidates.length;
  const selected = [];
  for (let i = 0; i < count; i++) {
    const idx = (start + i * step) % candidates.length;
    selected.push(candidates[idx]);
  }
  return selected;
}

// ── Main ───────────────────────────────────────────────────────────
function main() {
  const koreanFiles = getKoreanFiles();
  console.log(`총 한국어 파일: ${koreanFiles.length}`);

  // Find problematic files (those with bold-arrow lines)
  const problematic = [];
  for (const file of koreanFiles) {
    const filepath = path.join(STORIES_DIR, file);
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    const hasBoldArrow = lines.some(line => BOLD_ARROW_RE.test(line));
    if (hasBoldArrow) {
      problematic.push(file);
    }
  }

  console.log(`볼드 화살표 링크 파일: ${problematic.length}`);

  const problematicSlugs = new Set(problematic.map(getSlug));
  const pools = buildSiblingPools(koreanFiles, problematicSlugs);

  let fixedSelfLink = 0;
  let addedLinks = 0;
  let removedBoldArrow = 0;

  for (const file of problematic) {
    const filepath = path.join(STORIES_DIR, file);
    const slug = getSlug(file);
    const cat = getCategory(slug);
    let content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');

    // Count links before removing
    const linksBefore = countInternalLinks(content);
    const isSelf = hasSelfLink(content, slug);

    // Remove all bold-arrow lines
    const cleanedLines = lines.filter(line => !BOLD_ARROW_RE.test(line));

    // Also clean up any trailing empty lines that were left
    while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
      cleanedLines.pop();
    }

    let newContent = cleanedLines.join('\n');
    const linksAfter = countInternalLinks(newContent);

    removedBoldArrow++;
    if (isSelf) fixedSelfLink++;

    // If the file now has 0 internal links, add a footer
    if (linksAfter === 0 && cat && pools[cat]) {
      const siblings = selectSiblings(pools[cat], slug, 5);
      if (siblings.length > 0) {
        const linkParts = siblings.map(s => `[${s.title}](/stories/${s.slug})`);
        const footer = `\n\n---\n\n${linkParts.join(' | ')}`;
        newContent += footer;
        addedLinks++;
      }
    } else if (linksAfter > 0) {
      // File still has links (e.g., practice-room-piano-ballad-technique1)
      // Just make sure it ends with a newline
    }

    // Ensure file ends with a single newline
    newContent = newContent.replace(/\n*$/, '\n');

    fs.writeFileSync(filepath, newContent, 'utf8');
  }

  console.log(`\n=== 결과 ===`);
  console.log(`볼드 화살표 제거: ${removedBoldArrow}개 파일`);
  console.log(`셀프 링크 제거: ${fixedSelfLink}개 파일`);
  console.log(`신규 링크 푸터 추가: ${addedLinks}개 파일`);

  // ── Verification ─────────────────────────────────────────────────
  console.log(`\n=== 검증 ===`);
  let selfLinkRemaining = 0;
  let singleLinkCount = 0;
  let zeroLinkCount = 0;

  for (const file of koreanFiles) {
    const filepath = path.join(STORIES_DIR, file);
    const content = fs.readFileSync(filepath, 'utf8');
    const slug = getSlug(file);
    const linkCount = countInternalLinks(content);

    if (hasSelfLink(content, slug)) {
      selfLinkRemaining++;
      console.log(`  ⚠️  셀프 링크 잔존: ${slug}`);
    }
    if (linkCount === 1) {
      singleLinkCount++;
    }
    if (linkCount === 0) {
      zeroLinkCount++;
    }
  }

  console.log(`셀프 링크 잔존: ${selfLinkRemaining}개`);
  console.log(`내부 링크 0개 파일: ${zeroLinkCount}개`);
  console.log(`내부 링크 1개 파일: ${singleLinkCount}개`);
}

main();
