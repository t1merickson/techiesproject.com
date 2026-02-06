# techiesproject.com

An archive of [The Techies Project](https://techiesproject.com), a collection of 100 interviews with people working in tech. The project and interviews are from January 2016. Originally a WordPress site, now a static site hosted on Netlify.

## How it works

A Node.js build script generates the full site from JSON data and HTML templates. No dependencies required.

- `src/data/people.json` — 100 interview records (name, bio, content, images, etc.)
- `src/data/categories.json` — 28 category groupings
- `src/templates/` — HTML templates for person pages, homepage, category pages, about, and submit
- `scripts/build.js` — generates all pages into `_output/`

## Local development

```sh
node scripts/build.js
```

This creates the `_output/` directory with the full static site. Open `_output/index.html` in a browser or serve it locally:

```sh
npx serve _output
```

## Deployment

Netlify runs `node scripts/build.js` on push and publishes the `_output/` directory. Config is in `netlify.toml`.

## Project structure

```
assets/
  css/          # stylesheets
  js/           # scripts (jQuery plugins, category filter, slider)
  fonts/        # web fonts
  images/       # logos and sponsor images
d1lhy388c2xgxf/
  portraits/    # full-size interview portraits
  thumbnails/   # gallery thumbnail images
src/
  data/         # people.json, categories.json
  templates/    # HTML templates and partials
scripts/
  build.js      # generates _output/ from templates + data
  extract.js    # one-time script that extracted data from the original WordPress HTML
  verify.js     # post-build verification (checks links, assets, URL coverage)
```

## Other scripts

- `node scripts/verify.js` — checks the build output for broken local links, missing assets, and WordPress remnants
- `node scripts/extract.js` — the one-time extraction script used to parse the original wget archive into JSON (kept for reference)
