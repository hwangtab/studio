#!/usr/bin/env node
/**
 * fix-onlinemix-concentration.js
 * Reduces onlinemix1 link concentration from ~535 files to under 230.
 * Only removes links from footer cross-link lines (pipe-delimited link rows).
 * Keeps links in files whose slug matches audio/mixing-related keywords.
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');

// Slugs that should KEEP the onlinemix1 link
const KEEP_KEYWORDS = [
  'mix', 'master', 'eq', 'compress', 'daw', 'plugin', 'reverb', 'delay',
  'sidechain', 'gain', 'limiter', 'bus', 'stem', 'audio-format', 'recording',
  'online', 'remote', 'nationwide', 'vocal-prep', 'home-vs-studio', 'guide1',
  'onlinemix'
];

function shouldKeep(slug) {
  return KEEP_KEYWORDS.some(kw => slug.includes(kw));
}

// Detect if a line is a footer cross-link line:
// Entirely composed of [text](/stories/slug) separated by |
function isFooterCrosslinkLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Strip all link patterns and pipes, see if anything meaningful remains
  const stripped = trimmed
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')  // remove markdown links
    .replace(/\|/g, '')                     // remove pipes
    .trim();
  // If nothing remains (or only whitespace), it's a pure cross-link line
  // Also require at least one link to be present
  return stripped === '' && /\[[^\]]*\]\(/.test(trimmed);
}

function extractSlugFromFilename(filename) {
  // e.g., gangnam1.md -> gangnam1
  return filename.replace(/\.md$/, '');
}

function removeOnlinemix1FromLine(line) {
  // Pattern: ` | [text](/stories/onlinemix1)` at end
  let result = line.replace(/\s*\|\s*\[[^\]]*\]\(\/stories\/onlinemix1\)\s*$/g, '');
  if (result !== line) return result;

  // Pattern: `[text](/stories/onlinemix1) | ` at start
  result = line.replace(/^\s*\[[^\]]*\]\(\/stories\/onlinemix1\)\s*\|\s*/g, '');
  if (result !== line) return result;

  // Pattern: ` | [text](/stories/onlinemix1) | ` in middle
  result = line.replace(/\s*\|\s*\[[^\]]*\]\(\/stories\/onlinemix1\)/g, '');
  if (result !== line) return result;

  return result;
}

function processFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');

  // Check if file contains onlinemix1 at all
  if (!content.includes('/stories/onlinemix1')) return false;

  const lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip if line doesn't contain onlinemix1
    if (!line.includes('/stories/onlinemix1')) continue;

    // Skip shortcodes
    if (line.includes('%%online-fallback%%')) continue;

    // Only process footer cross-link lines
    if (!isFooterCrosslinkLine(line)) continue;

    // Check if onlinemix1 is the ONLY link on this line
    const linkCount = (line.match(/\[[^\]]*\]\([^)]*\)/g) || []).length;
    if (linkCount === 1) {
      // Remove the entire line
      lines[i] = null; // mark for removal
      modified = true;
      continue;
    }

    // Remove just the onlinemix1 link
    const newLine = removeOnlinemix1FromLine(line);
    if (newLine !== line) {
      lines[i] = newLine;
      modified = true;
    }
  }

  if (modified) {
    const newContent = lines.filter(l => l !== null).join('\n');
    fs.writeFileSync(filepath, newContent, 'utf8');
    return true;
  }
  return false;
}

// Main
const files = fs.readdirSync(STORIES_DIR).filter(f => {
  if (!f.endsWith('.md')) return false;
  // Exclude non-Korean locale files
  if (/\.(en|zh|es|vi|th|uz)\.md$/.test(f)) return false;
  return true;
});

let removedCount = 0;
let keptCount = 0;
let alreadyClean = 0;

for (const file of files) {
  const slug = extractSlugFromFilename(file);
  const filepath = path.join(STORIES_DIR, file);

  const content = fs.readFileSync(filepath, 'utf8');
  if (!content.includes('/stories/onlinemix1')) continue;

  if (shouldKeep(slug)) {
    keptCount++;
    continue;
  }

  if (processFile(filepath)) {
    removedCount++;
  } else {
    alreadyClean++;
  }
}

console.log(`Removed onlinemix1 footer links from ${removedCount} files`);
console.log(`Kept onlinemix1 links in ${keptCount} files (keyword match)`);
console.log(`Files with onlinemix1 in non-footer context (untouched): ${alreadyClean}`);

// Verify final count by scanning files directly
let finalCount = 0;
for (const file of files) {
  const filepath = path.join(STORIES_DIR, file);
  const content = fs.readFileSync(filepath, 'utf8');
  if (content.includes('/stories/onlinemix1') || content.includes('onlinemix1')) {
    finalCount++;
  }
}
console.log(`Final onlinemix1 file count (Korean only): ${finalCount}`);
