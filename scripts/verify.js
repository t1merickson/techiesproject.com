#!/usr/bin/env node
/**
 * verify.js — Post-build verification script.
 * Checks that all URLs resolve and content is intact.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, '_output');
const SRC = path.join(ROOT, 'src');

let errors = 0;
let warnings = 0;

function check(condition, msg) {
  if (!condition) {
    console.error(`  ERROR: ${msg}`);
    errors++;
  }
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`);
  warnings++;
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

const people = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'people.json'), 'utf8'));
const categories = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'categories.json'), 'utf8'));

// ---------------------------------------------------------------------------
// 1. Check all person pages exist
// ---------------------------------------------------------------------------

console.log('Checking person pages...');
people.forEach(p => {
  const filePath = path.join(OUTPUT, p.slug, 'index.html');
  check(fs.existsSync(filePath), `Missing: ${p.slug}/index.html`);

  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8');
    check(html.includes(p.name), `${p.slug}: name "${p.name}" not found in output`);
    check(html.includes(p.hero_image), `${p.slug}: hero image "${p.hero_image}" not found in output`);
    check(html.includes(p.thumbnail), `${p.slug}: thumbnail "${p.thumbnail}" not found in output`);
    if (p.interview_content.length > 100) {
      // Check a snippet of interview content is present
      const snippet = p.interview_content.substring(0, 80);
      check(html.includes(snippet), `${p.slug}: interview content not found in output`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Check all category pages exist
// ---------------------------------------------------------------------------

console.log('Checking category pages...');
categories.forEach(cat => {
  const filePath = path.join(OUTPUT, 'category', cat.slug, 'index.html');
  check(fs.existsSync(filePath), `Missing: category/${cat.slug}/index.html`);

  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8');
    // Check that all expected people are in this category page
    cat.post_ids.forEach(pid => {
      check(html.includes(`id="post-${pid}"`), `category/${cat.slug}: missing post-${pid}`);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Check static pages exist
// ---------------------------------------------------------------------------

console.log('Checking static pages...');
check(fs.existsSync(path.join(OUTPUT, 'index.html')), 'Missing: index.html');
check(fs.existsSync(path.join(OUTPUT, 'about', 'index.html')), 'Missing: about/index.html');
check(fs.existsSync(path.join(OUTPUT, 'submit', 'index.html')), 'Missing: submit/index.html');
check(fs.existsSync(path.join(OUTPUT, 'favicon.ico')), 'Missing: favicon.ico');
check(fs.existsSync(path.join(OUTPUT, 'robots.txt')), 'Missing: robots.txt');

// ---------------------------------------------------------------------------
// 4. Check homepage has all people
// ---------------------------------------------------------------------------

console.log('Checking homepage completeness...');
const homepageHtml = fs.readFileSync(path.join(OUTPUT, 'index.html'), 'utf8');
people.forEach(p => {
  check(homepageHtml.includes(`id="post-${p.post_id}"`), `Homepage missing: post-${p.post_id} (${p.slug})`);
  check(homepageHtml.includes(`href="/${p.slug}/"`), `Homepage missing link to: ${p.slug}`);
});

// ---------------------------------------------------------------------------
// 5. Check asset files referenced in HTML exist
// ---------------------------------------------------------------------------

console.log('Checking asset references...');
const htmlFiles = [];

function findHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(fullPath);
    } else if (entry.name.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  }
}
findHtmlFiles(OUTPUT);

const checkedPaths = new Set();
htmlFiles.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  // Find local src= and href= references
  const refRegex = /(?:src|href)=["'](\/(assets|d1lhy388c2xgxf)[^"']+)["']/g;
  let match;
  while ((match = refRegex.exec(html)) !== null) {
    const ref = match[1].split('?')[0]; // strip query params
    if (checkedPaths.has(ref)) continue;
    checkedPaths.add(ref);

    const assetPath = path.join(OUTPUT, ref);
    if (!fs.existsSync(assetPath)) {
      const relFile = path.relative(OUTPUT, file);
      warn(`${relFile} references ${ref} but file not found in output`);
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Check CSS url() references
// ---------------------------------------------------------------------------

console.log('Checking CSS url() references...');
const cssPath = path.join(OUTPUT, 'assets', 'css', 'techies.css');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const urlRegex = /url\(['"]?(\/(assets|d1lhy388c2xgxf)[^'")]+)['"]?\)/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(css)) !== null) {
    const ref = urlMatch[1].split('?')[0].split('#')[0];
    if (checkedPaths.has(ref)) continue;
    checkedPaths.add(ref);

    const assetPath = path.join(OUTPUT, ref);
    if (!fs.existsSync(assetPath)) {
      warn(`techies.css references ${ref} but file not found in output`);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Check no WordPress remnants in output
// ---------------------------------------------------------------------------

console.log('Checking for WordPress remnants...');
htmlFiles.forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  const relFile = path.relative(OUTPUT, file);
  if (html.includes('wp-content/')) warn(`${relFile} still references wp-content/`);
  if (html.includes('wp-includes/')) warn(`${relFile} still references wp-includes/`);
  if (html.includes('wp-json/')) warn(`${relFile} still references wp-json/`);
  if (html.includes('xmlrpc.php')) warn(`${relFile} still references xmlrpc.php`);
  if (html.includes('wpemojiSettings')) warn(`${relFile} still contains WordPress emoji script`);
  if (html.includes('s3-us-west-2')) warn(`${relFile} still references s3-us-west-2`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n--- Verification complete ---`);
console.log(`Files checked: ${htmlFiles.length} HTML files, ${checkedPaths.size} asset references`);
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}`);

if (errors > 0) {
  process.exit(1);
}
