#!/usr/bin/env node
/**
 * extract.js — One-time script to parse existing HTML files into JSON data.
 * Run from repo root: node scripts/extract.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function readFile(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
}

function extractBetween(html, startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return '';
  const afterStart = startIdx + startMarker.length;
  const endIdx = html.indexOf(endMarker, afterStart);
  if (endIdx === -1) return '';
  return html.substring(afterStart, endIdx);
}

function extractMatch(html, regex) {
  const m = html.match(regex);
  return m ? m[1] : '';
}

function trim(s) {
  return s.replace(/&nbsp;?/g, '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Parse homepage for person order and gallery titles
// ---------------------------------------------------------------------------

function parseHomepage() {
  const html = readFile('index.html');
  const entries = [];
  // Match each gallery card: <div id="post-XXX" ... href="/slug/" ... <p class="name">Name</p> <p class="title">Title&nbsp</p>
  const cardRegex = /<div id="post-(\d+)"[^>]*class="techie-gallery[^"]*"[^>]*>\s*<a[^>]*href="\/([^"]+?)\/"[^>]*>[\s\S]*?<p class="name">([^<]+)<\/p>\s*<p class="title">([^<]*)<\/p>/g;
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    entries.push({
      post_id: parseInt(match[1], 10),
      slug: match[2],
      name: match[3].trim(),
      title: trim(match[4]),
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Parse a single person page
// ---------------------------------------------------------------------------

function parsePersonPage(slug) {
  const filePath = `${slug}/index.html`;
  if (!fs.existsSync(path.join(ROOT, filePath))) {
    console.warn(`  WARNING: ${filePath} not found, skipping`);
    return null;
  }
  const html = readFile(filePath);

  // post_id from shortlink
  const post_id = parseInt(extractMatch(html, /href='\/?[?]p=(\d+)'/), 10) || 0;

  // Hero image
  const hero_image = extractMatch(html, /<div class="featured-image[^"]*">\s*<img src="\/d1lhy388c2xgxf\/portraits\/([^"]+)"/);

  // Name
  const name = extractMatch(html, /<div class="techie-name col-md-12">\s*([\s\S]*?)\s*<\/div>/).trim();

  // Thumbnail
  const thumbnail = extractMatch(html, /<div class="col-xs-12 col-md-3 photo">\s*<img src="\/d1lhy388c2xgxf\/thumbnails\/([^"]+)"/);

  // Meta fields
  const yearsBlock = extractBetween(html, '<li class="icon years">', '</li>');
  const years_in_tech = extractMatch(yearsBlock, /<p class="text">([^<]*)<\/p>/).trim();

  const roleBlock = extractBetween(html, '<li class="icon role">', '</li>');
  const role = trim(extractMatch(roleBlock, /<p class="col-xs-12 col-md-8 text">([^<]*)<\/p>/));

  const locationBlock = extractBetween(html, '<li class="icon location">', '</li>');
  const location = extractMatch(locationBlock, /<p class="text">([^<]*)<\/p>/).trim();

  const dateBlock = extractBetween(html, '<li class="icon date">', '</li>');
  const interview_date = extractMatch(dateBlock, /<p class="text">([^<]*)<\/p>/).trim();

  // Abstract — content of <div class="col-md-6 abstract">
  const abstractStart = html.indexOf('<div class="col-md-6 abstract">');
  let abstract = '';
  if (abstractStart !== -1) {
    const afterAbstract = abstractStart + '<div class="col-md-6 abstract">'.length;
    // Find the closing </div> that matches this level
    const abstractEnd = html.indexOf('\n  </div>\n</div>\n<div class="row">', afterAbstract);
    if (abstractEnd !== -1) {
      abstract = html.substring(afterAbstract, abstractEnd).trim();
    } else {
      // fallback: grab until next </div>
      const fallbackEnd = html.indexOf('</div>', afterAbstract);
      abstract = html.substring(afterAbstract, fallbackEnd).trim();
    }
  }

  // Personal links
  const personal_links = [];
  const linksSection = extractBetween(html, '<div class="personal-links">', '</div>');
  const linkRegex = /<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(linksSection)) !== null) {
    personal_links.push({ url: linkMatch[1], label: linkMatch[2] });
  }

  // Interview content — everything inside <div class="col-xs-12 col-md-6 post">
  const postStart = html.indexOf('<div class="col-xs-12 col-md-6 post">');
  let interview_content = '';
  if (postStart !== -1) {
    const afterPost = postStart + '<div class="col-xs-12 col-md-6 post">'.length;
    // Find closing: it's followed by the sidebar photo div
    const postEnd = html.indexOf('\n  </div>\n  <div class="col-xs-12 col-md-3 photo">', afterPost);
    if (postEnd !== -1) {
      interview_content = html.substring(afterPost, postEnd).trim();
    }
  }

  // Prev/Next
  const prevMatch = html.match(/<link rel='prev' title='([^']+)' href='\/([^']+)\/' \/>/);
  const nextMatch = html.match(/<link rel='next' title='([^']+)' href='\/([^']+)\/' \/>/);
  const prev = prevMatch ? { name: prevMatch[1], slug: prevMatch[2] } : null;
  const next = nextMatch ? { name: nextMatch[1], slug: nextMatch[2] } : null;

  return {
    slug,
    post_id,
    name,
    hero_image,
    thumbnail,
    years_in_tech,
    role,
    location,
    interview_date,
    abstract,
    personal_links,
    interview_content,
    prev,
    next,
  };
}

// ---------------------------------------------------------------------------
// Parse category pages
// ---------------------------------------------------------------------------

function parseCategories() {
  const categoryDir = path.join(ROOT, 'category');
  if (!fs.existsSync(categoryDir)) return [];

  const categories = [];
  const slugs = fs.readdirSync(categoryDir).filter(f => {
    return fs.statSync(path.join(categoryDir, f)).isDirectory() && f !== 'feed';
  });

  for (const slug of slugs) {
    const filePath = `category/${slug}/index.html`;
    if (!fs.existsSync(path.join(ROOT, filePath))) continue;
    const html = readFile(filePath);

    // Display name from RSS link title: "Techies &raquo; Developer Category Feed"
    let display_name = extractMatch(html, /Techies &raquo; ([^"]+?) Category Feed/);
    if (!display_name) {
      // Fallback: get it from the categories list on the homepage
      display_name = slug;
    }

    // Post IDs in order
    const post_ids = [];
    const postIdRegex = /<div id="post-(\d+)"/g;
    let m;
    while ((m = postIdRegex.exec(html)) !== null) {
      post_ids.push(parseInt(m[1], 10));
    }

    categories.push({ slug, display_name, post_ids });
  }

  // Sort categories alphabetically by slug to match the filter bar order
  categories.sort((a, b) => a.slug.localeCompare(b.slug));
  return categories;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Parsing homepage...');
const homepageEntries = parseHomepage();
console.log(`  Found ${homepageEntries.length} people on homepage`);

// Build a lookup for title from homepage
const titleBySlug = {};
for (const entry of homepageEntries) {
  titleBySlug[entry.slug] = entry.title;
}

console.log('Parsing person pages...');
const people = [];
for (const entry of homepageEntries) {
  process.stdout.write(`  ${entry.slug}...`);
  const person = parsePersonPage(entry.slug);
  if (person) {
    // Add the gallery title from homepage (may differ from role)
    person.title = titleBySlug[entry.slug] || '';
    // Use post_id from homepage if person page didn't have one
    if (!person.post_id) person.post_id = entry.post_id;
    people.push(person);
    console.log(' OK');
  } else {
    console.log(' SKIP');
  }
}

console.log(`\nParsing categories...`);
const categories = parseCategories();
console.log(`  Found ${categories.length} categories`);

// Also extract the category display names from the homepage filter bar
const homepageHtml = readFile('index.html');
const catNameRegex = /<li id="([^"]*)" class="cat-item"><a href="[^"]*">([^<]+)<\/a><\/li>/g;
const catDisplayNames = {};
let catMatch;
while ((catMatch = catNameRegex.exec(homepageHtml)) !== null) {
  catDisplayNames[catMatch[1]] = catMatch[2];
}
// Update category display names from homepage (more reliable than RSS title)
for (const cat of categories) {
  if (catDisplayNames[cat.slug]) {
    cat.display_name = catDisplayNames[cat.slug];
  }
}

// Write output
const dataDir = path.join(ROOT, 'src', 'data');
fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(
  path.join(dataDir, 'people.json'),
  JSON.stringify(people, null, 2)
);
console.log(`\nWrote src/data/people.json (${people.length} people)`);

fs.writeFileSync(
  path.join(dataDir, 'categories.json'),
  JSON.stringify(categories, null, 2)
);
console.log(`Wrote src/data/categories.json (${categories.length} categories)`);

// Summary
console.log('\n--- Summary ---');
console.log(`People: ${people.length}`);
console.log(`Categories: ${categories.length}`);
const missing = people.filter(p => !p.hero_image || !p.interview_content);
if (missing.length) {
  console.log(`\nWARNING: ${missing.length} people with missing data:`);
  for (const p of missing) {
    const issues = [];
    if (!p.hero_image) issues.push('no hero_image');
    if (!p.interview_content) issues.push('no interview_content');
    console.log(`  ${p.slug}: ${issues.join(', ')}`);
  }
}
