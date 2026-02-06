#!/usr/bin/env node
/**
 * build.js — Generates the static site from JSON data + templates.
 * Run: node scripts/build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, '_output');
const SRC = path.join(ROOT, 'src');

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirSync(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

function readTemplate(name) {
  return fs.readFileSync(path.join(SRC, 'templates', name), 'utf8');
}

function render(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Use split+join for global replace (no regex escaping needed)
    result = result.split(`{{${key}}}`).join(value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

console.log('Loading data...');
const people = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'people.json'), 'utf8'));
const categories = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'categories.json'), 'utf8'));

// Build lookup by post_id
const peopleByPostId = {};
people.forEach(p => { peopleByPostId[p.post_id] = p; });

// ---------------------------------------------------------------------------
// Load templates
// ---------------------------------------------------------------------------

console.log('Loading templates...');
const partials = {
  head: readTemplate('partials/head.html'),
  nav: readTemplate('partials/nav.html'),
  footer: readTemplate('partials/footer.html'),
  scripts: readTemplate('partials/scripts.html'),
};

const personTemplate = readTemplate('person.html');
const homepageTemplate = readTemplate('homepage.html');
const categoryTemplate = readTemplate('category.html');
const aboutTemplate = readTemplate('about.html');
const submitTemplate = readTemplate('submit.html');

// ---------------------------------------------------------------------------
// Clean and create output
// ---------------------------------------------------------------------------

console.log('Preparing output directory...');
fs.rmSync(OUTPUT, { recursive: true, force: true });
mkdirp(OUTPUT);

// ---------------------------------------------------------------------------
// Copy static assets
// ---------------------------------------------------------------------------

console.log('Copying assets...');
copyDirSync(path.join(ROOT, 'assets'), path.join(OUTPUT, 'assets'));
copyDirSync(path.join(ROOT, 'd1lhy388c2xgxf'), path.join(OUTPUT, 'd1lhy388c2xgxf'));
fs.copyFileSync(path.join(ROOT, 'favicon.ico'), path.join(OUTPUT, 'favicon.ico'));

// Write a clean robots.txt
fs.writeFileSync(path.join(OUTPUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');

// ---------------------------------------------------------------------------
// Helper: build head with extras
// ---------------------------------------------------------------------------

function buildHead(headExtra) {
  return render(partials.head, { HEAD_EXTRA: headExtra || '' });
}

function buildNav(aboutActive, submitActive) {
  return render(partials.nav, {
    ABOUT_ACTIVE: aboutActive ? 'active' : '',
    SUBMIT_ACTIVE: submitActive ? 'active' : '',
  });
}

// ---------------------------------------------------------------------------
// Generate person pages
// ---------------------------------------------------------------------------

console.log('Generating person pages...');
people.forEach(person => {
  // Head extras: canonical + prev/next
  let headExtra = `<link rel="canonical" href="/${person.slug}/" />`;
  if (person.prev) {
    headExtra += `\n<link rel='prev' title='${person.prev.name}' href='/${person.prev.slug}/' />`;
  }
  if (person.next) {
    headExtra += `\n<link rel='next' title='${person.next.name}' href='/${person.next.slug}/' />`;
  }

  // Personal links HTML
  const linksHtml = person.personal_links.map(l =>
    `        <li><a href="${l.url}">${l.label}</a></li>`
  ).join('\n');

  const html = render(personTemplate, {
    HEAD: buildHead(headExtra),
    NAV: buildNav(false, false),
    FOOTER: partials.footer,
    SCRIPTS: partials.scripts,
    NAME: person.name,
    HERO_IMAGE: person.hero_image,
    THUMBNAIL: person.thumbnail,
    YEARS_IN_TECH: person.years_in_tech,
    ROLE: person.role,
    LOCATION: person.location,
    INTERVIEW_DATE: person.interview_date,
    ABSTRACT: person.abstract,
    PERSONAL_LINKS: linksHtml,
    INTERVIEW_CONTENT: person.interview_content,
  });

  const dir = path.join(OUTPUT, person.slug);
  mkdirp(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
});
console.log(`  Generated ${people.length} person pages`);

// ---------------------------------------------------------------------------
// Generate homepage
// ---------------------------------------------------------------------------

console.log('Generating homepage...');

// Category list for homepage (nicely formatted, one per line)
const categoryListHtml = categories.map(cat =>
  `              <li id="${cat.slug}" class="cat-item"><a href="/category/${cat.slug}/">${cat.display_name}</a></li>`
).join('\n');

// Gallery cards for homepage (all people, in order)
const homepageCardsHtml = people.map(person => {
  return `  <div id="post-${person.post_id}" class="techie-gallery col-xs-6 col-sm-4 col-md-3">
    <a class="techie-thumbnail" href="/${person.slug}/">
      <img src="/d1lhy388c2xgxf/thumbnails/${person.thumbnail}" width="280px" height="390px">
      <div class="techie-info">
        <p class="name">${person.name}</p>
        <p class="title">${person.title}&nbsp</p>
      </div>
    </a>
  </div>`;
}).join('\n\n  <!-- end loop -->\n  ');

const homepageHtml = render(homepageTemplate, {
  HEAD: buildHead(''),
  NAV: buildNav(false, false),
  FOOTER: partials.footer,
  SCRIPTS: partials.scripts,
  CATEGORY_LIST: categoryListHtml,
  GALLERY_CARDS: homepageCardsHtml,
});

fs.writeFileSync(path.join(OUTPUT, 'index.html'), homepageHtml);
console.log('  Generated homepage');

// ---------------------------------------------------------------------------
// Generate category pages
// ---------------------------------------------------------------------------

console.log('Generating category pages...');

// Category list for category pages (inline format, matching original)
const categoryListInline = categories.map(cat =>
  `<li id=${cat.slug} class='cat-item'><a href='/category/${cat.slug}/'>${cat.display_name}</a></li>`
).join('');

categories.forEach(cat => {
  const catPeople = cat.post_ids
    .map(id => peopleByPostId[id])
    .filter(Boolean);

  // Gallery cards for category pages (different format than homepage)
  const cardsHtml = catPeople.map(person => {
    return `  <div id="post-${person.post_id}" class="techie-gallery col-lg-3 col-md-4 col-sm-6">
    <a class="techie-thumbnail" href="/${person.slug}/">
      <img src="/d1lhy388c2xgxf/thumbnails/${person.thumbnail}" width="280px" height="390px">
      <p class="name">${person.name}</p>
      <p class="title">${person.title}&nbsp;</p>
    </a>
  </div>`;
  }).join('\n\n<!-- end loop -->\n');

  const categoryHtml = render(categoryTemplate, {
    HEAD: buildHead(''),
    NAV: buildNav(false, false),
    FOOTER: partials.footer,
    SCRIPTS: partials.scripts,
    CATEGORY_LIST_INLINE: categoryListInline,
    GALLERY_CARDS: cardsHtml,
  });

  const dir = path.join(OUTPUT, 'category', cat.slug);
  mkdirp(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), categoryHtml);
});
console.log(`  Generated ${categories.length} category pages`);

// ---------------------------------------------------------------------------
// Generate about page
// ---------------------------------------------------------------------------

console.log('Generating about page...');
const aboutHtml = render(aboutTemplate, {
  HEAD: buildHead('<link rel="canonical" href="/about/" />'),
  NAV: buildNav(true, false),
  FOOTER: partials.footer,
  SCRIPTS: partials.scripts,
});

mkdirp(path.join(OUTPUT, 'about'));
fs.writeFileSync(path.join(OUTPUT, 'about', 'index.html'), aboutHtml);

// ---------------------------------------------------------------------------
// Generate submit page
// ---------------------------------------------------------------------------

console.log('Generating submit page...');
const submitHtml = render(submitTemplate, {
  HEAD: buildHead('<link rel="canonical" href="/submit/" />\n<link rel=\'stylesheet\' href=\'/assets/css/wpgform.css\' type=\'text/css\' media=\'all\' />'),
  NAV: buildNav(false, true),
  FOOTER: partials.footer,
  SCRIPTS: partials.scripts,
});

mkdirp(path.join(OUTPUT, 'submit'));
fs.writeFileSync(path.join(OUTPUT, 'submit', 'index.html'), submitHtml);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n--- Build complete ---');
console.log(`Person pages: ${people.length}`);
console.log(`Category pages: ${categories.length}`);
console.log(`Static pages: homepage, about, submit`);
console.log(`Output: ${OUTPUT}`);
