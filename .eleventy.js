// ---------------- helper functions (plain JS, unit-testable) ----------------

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Builds a map of "repo-relative file path" -> "timestamp (ms) of the most
// recent git commit that touched it", in a single `git log` call. Used to
// automatically surface the most recently updated people on the homepage.
// Falls back gracefully (empty map) if git isn't available or the checkout
// has no history (e.g. a shallow clone) — callers then fall back to the
// file's filesystem mtime.
let _gitLastModifiedMap = null;
function getGitLastModifiedMap() {
  if (_gitLastModifiedMap) return _gitLastModifiedMap;
  const map = {};
  try {
    const out = execFileSync(
      "git",
      ["log", "--name-only", "--format=%x00%ct"],
      { cwd: __dirname, maxBuffer: 1024 * 1024 * 100 }
    ).toString();
    let currentTime = null;
    out.split("\n").forEach((line) => {
      if (line.startsWith("\x00")) {
        currentTime = parseInt(line.slice(1), 10) * 1000;
      } else if (line.trim() && currentTime) {
        if (!(line in map)) map[line] = currentTime; // first hit = most recent, since git log is newest-first
      }
    });
  } catch (e) {
    // No git history available at build time — map stays empty.
  }
  _gitLastModifiedMap = map;
  return map;
}

function lastModifiedOf(inputPath) {
  const rel = path.relative(__dirname, path.resolve(inputPath)).split(path.sep).join("/");
  const map = getGitLastModifiedMap();
  if (rel in map) return map[rel];
  try {
    return fs.statSync(inputPath).mtimeMs; // fallback: filesystem modified time
  } catch (e) {
    return 0;
  }
}

function surnameOf(name) {
  const cleaned = (name || "").replace(/\(\?\)/g, "").trim();
  const parts = cleaned.split(/\s+/);
  let last = parts[parts.length - 1] || cleaned;
  if (/^\d+$/.test(last) && parts.length > 1) last = parts[0];
  return last.replace(/[^\p{L}\p{N}]/gu, "");
}

function firstLetterOf(surname) {
  const ch = (surname || "").charAt(0).toUpperCase();
  return ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function combineGallery(cover, extra) {
  const out = [];
  if (cover) out.push({ src: cover, caption: "" });
  (extra || []).forEach((g) => {
    if (!g) return;
    if (typeof g === "string") {
      out.push({ src: g, caption: "" }); // legacy flat-string entries, just in case
    } else if (g.image) {
      out.push({ src: g.image, caption: g.caption || "" });
    }
  });
  return out;
}

function jsonAttr(obj) {
  return JSON.stringify(obj || []).replace(/'/g, "&#39;");
}

function normalizeGalleryList(list) {
  return (list || [])
    .map((g) => {
      if (!g) return null;
      if (typeof g === "string") return { src: g, caption: "" }; // legacy flat-string entries
      if (g.image) return { src: g.image, caption: g.caption || "" };
      return null;
    })
    .filter(Boolean);
}

function catDisplay(cat) {
  return (cat || "").toUpperCase().replace("CAT-", "CAT. ");
}

function renderFilmCards(filmObjs, root) {
  return (filmObjs || []).map((f) => {
    const cat = catDisplay(f.data.cat_num);
    const img = f.data.still
      ? `<img src="${root}${f.data.still}" alt="${f.data.title}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
      : `<span class="placeholder-mark">Still, to be added</span>`;
    return `<a class="card card-link" href="${root}films/${f.data.slug}.html">
        <div class="placeholder-frame">${img}</div>
        <div class="card-body">
          <span class="card-kicker">${cat}</span>
          <span class="card-title">${f.data.title}</span>
          <span class="tag alt" style="margin-top:6px;">Edition ${f.data.edition}</span>
        </div>
      </a>`;
  }).join("\n");
}

function renderStoryCards(storyObjs, root) {
  return (storyObjs || []).map((s) => {
    const imageBlock = s.data.image
      ? `<div class="story-card-image"><img src="${root}${s.data.image}" alt="${s.data.title}"></div>`
      : "";
    const attribParts = [];
    if (s.data.source) attribParts.push(s.data.source);
    if (s.data.edition) attribParts.push("Edition " + s.data.edition);
    const attrib = attribParts.length ? attribParts.join(" &middot; ") : "";
    return `<a class="story-card story-card-link" href="${root}stories/${s.data.slug}.html">
      ${imageBlock}
      <span class="quote-mark">&ldquo;</span>
      <p>${s.data.excerpt || s.data.title}</p>
      ${attrib ? `<p class="story-attrib">${attrib}</p>` : ""}
    </a>`;
  }).join("\n");
}

function renderPersonHighlightCards(peopleObjs, root) {
  return (peopleObjs || []).map((p) => {
    const d = p.data;
    const img = d.photo
      ? `<img src="${root}${d.photo}" alt="${d.name}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
      : `<span class="placeholder-mark">Portrait, TK</span>`;
    const metaParts = [];
    if (d.country) metaParts.push(d.country);
    if (d.editions_label) {
      metaParts.push(d.editions_label);
    } else if ((d.editions || []).length) {
      metaParts.push(d.editions.length > 1 ? "Multiple editions" : `${d.editions[0]} edition`);
    }
    const meta = metaParts.join(" &middot; ");
    return `<a class="card card-link" href="${root}people/${d.slug}.html">
        <div class="placeholder-frame" style="aspect-ratio:3/4;">${img}</div>
        <div class="card-body">
          <span class="card-kicker">${d.role || "Filmmaker"}</span>
          <span class="card-title">${d.name}</span>
          ${meta ? `<p class="card-desc">${meta}</p>` : ""}
        </div>
      </a>`;
  }).join("\n");
}

function renderPersonRow(p, root) {
  const editions = p.data.editions || [];
  const edTxt = editions.length === 1 ? `${editions[0]} edition` : (editions.length > 1 ? "Multiple editions" : "\u2014");
  return `<a class="person-row" href="${root}people/${p.data.slug}.html">
      <span class="person-name">${p.data.name}</span>
      <span class="person-role">${p.data.role || "Filmmaker"}</span>
      <span class="person-edition">${edTxt}</span>
      <span aria-hidden="true">&nearr;</span>
    </a>`;
}

function normalizeText(s) {
  return (s || "").toString().trim().toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function renderDirectorLinks(names, people, root) {
  const parts = (names || []).map((n) => {
    const match = (people || []).find((p) => normalizeText(p.data.name) === normalizeText(n));
    return match ? `<a href="${root}people/${match.data.slug}.html">${match.data.name}</a>` : n;
  });
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts.join(" &amp; ");
  return parts.slice(0, -1).join(", ") + ", &amp; " + parts[parts.length - 1];
}

function renderEditionSection(ed, root) {
  const d = ed.data;
  const posterImgs = combineGallery(d.poster, d.poster_gallery);
  const galleryImgs = normalizeGalleryList(d.gallery);
  const posterInner = d.poster
    ? `<img src="${root}${d.poster}" alt="Poster for ${d.label}" style="width:100%;height:100%;object-fit:contain;">`
    : `<span class="placeholder-mark">Poster, to be added</span>`;
  const posterAttrs = posterImgs.length > 1
    ? ` data-gallery-images='${jsonAttr(posterImgs)}' data-gallery-title="${d.label} \u2014 Poster" data-gallery-root="${root}"`
    : "";

  const resourceRows = (d.resources || []).map((r, i) => `
      <div class="doc-row">
        <span class="doc-num">DOC.${String(i + 1).padStart(2, "0")}</span>
        <div><span class="doc-name">${r.name}</span></div>
        ${r.file
          ? `<a class="doc-status" href="${root}${r.file}" target="_blank" rel="noopener">View</a>`
          : r.url
            ? `<a class="doc-status" href="${r.url}" target="_blank" rel="noopener">View</a>`
            : `<span class="doc-status">To be added</span>`}
      </div>`).join("");

  const photoNum = String((d.resources || []).length + 1).padStart(2, "0");
  const photoRow = galleryImgs.length > 1
    ? `<button class="doc-status gallery-btn" data-gallery-images='${jsonAttr(galleryImgs)}' data-gallery-title="${d.label} \u2014 Photographs" data-gallery-root="${root}">View Gallery</button>`
    : `<span class="doc-status">To be added</span>`;

  return `
  <section class="shell section" id="${d.year}">
    <div class="two-col">
      <div class="placeholder-frame poster-frame" style="aspect-ratio:3/4;"${posterAttrs}>
        ${posterInner}
      </div>
      <div class="stack">
        <span class="tag">${d.year}</span>
        <h2>${d.label}</h2>
        <p class="body-copy">${d.blurb || ""}</p>
        <a class="link-arrow" href="${root}films.html#films-${d.year}">See films tagged ${d.year} &rarr;</a>
      </div>
    </div>
    <div class="doc-list" style="margin-top:28px;">${resourceRows}
      <div class="doc-row">
        <span class="doc-num">DOC.${photoNum}</span>
        <div><span class="doc-name">Photographs</span>${galleryImgs.length > 1 ? `<span class="doc-sub">${galleryImgs.length} photos</span>` : ""}</div>
        ${photoRow}
      </div>
    </div>
  </section>`;
}

function peopleGroupsOf(peopleColl, root) {
  const bySurname = (peopleColl || []).slice().sort((a, b) => {
    const sa = surnameOf(a.data.name), sb = surnameOf(b.data.name);
    return sa.localeCompare(sb) || a.data.name.localeCompare(b.data.name);
  });
  const groups = {};
  bySurname.forEach((p) => {
    const letter = firstLetterOf(surnameOf(p.data.name));
    if (!letter) return;
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(renderPersonRow(p, root));
  });
  return Object.keys(groups).sort().map((letter) => ({ letter, rows: groups[letter] }));
}

function buildSearchIndex(films, people) {
  const entries = [];
  (films || []).forEach((f) => {
    const cat = catDisplay(f.data.cat_num);
    const dirNames = (f.data.directors || []).join(", ");
    entries.push({
      t: f.data.title,
      s: `${dirNames}${dirNames ? " \u00b7 " : ""}Edition ${f.data.edition}`,
      u: `films/${f.data.slug}.html`,
      k: "Film",
      c: cat,
    });
  });
  (people || []).forEach((p) => {
    const editions = p.data.editions || [];
    const edTxt = editions.length ? `Edition${editions.length > 1 ? "s" : ""} ${editions.join(", ")}` : "";
    entries.push({
      t: p.data.name,
      s: `${p.data.role || "Filmmaker"}${edTxt ? " \u00b7 " + edTxt : ""}`,
      u: `people/${p.data.slug}.html`,
      k: "Person",
      c: "",
    });
  });
  return "const EXPRMNTL_SEARCH_INDEX = " + JSON.stringify(entries) + ";";
}

// ---------------- eleventy config ----------------

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/script.js");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/documents");
  eleventyConfig.addPassthroughCopy({ admin: "admin" });

  eleventyConfig.addCollection("filmsSorted", (api) =>
    api.getFilteredByTag("films").sort((a, b) => a.data.title.localeCompare(b.data.title))
  );
  eleventyConfig.addCollection("peopleSorted", (api) =>
    api.getFilteredByTag("people").sort((a, b) => a.data.name.localeCompare(b.data.name))
  );
  eleventyConfig.addCollection("editionsSorted", (api) =>
    api.getFilteredByTag("editions").sort((a, b) => a.data.year - b.data.year)
  );
  eleventyConfig.addCollection("storiesSorted", (api) =>
    api.getFilteredByTag("stories").sort((a, b) => a.data.title.localeCompare(b.data.title))
  );
  // Homepage "Highlights": Jacques Ledoux, always, plus the 3 most recently
  // updated people (by git commit history), most recent first.
  eleventyConfig.addCollection("peopleHighlights", (api) => {
    const people = api.getFilteredByTag("people");
    const ledoux =
      people.find((p) => p.data.slug === "jacques-ledoux") ||
      people.find((p) => normalizeText(p.data.name) === normalizeText("Jacques Ledoux"));

    const byRecency = (list) =>
      list
        .map((p) => ({ item: p, time: lastModifiedOf(p.inputPath) }))
        .sort((a, b) => b.time - a.time)
        .map((x) => x.item);

    if (!ledoux) {
      // Fallback: Ledoux entry not found (e.g. slug was changed) — still
      // show 4 cards rather than breaking the section.
      return byRecency(people).slice(0, 4);
    }

    const others = byRecency(people.filter((p) => p !== ledoux)).slice(0, 3);
    return [ledoux, ...others];
  });

  eleventyConfig.addFilter("catDisplay", catDisplay);
  eleventyConfig.addFilter("json", (obj) => JSON.stringify(obj || []));
  eleventyConfig.addFilter("findBySlug", (items, slug) => (items || []).find((i) => i.data.slug === slug));
  eleventyConfig.addFilter("byEdition", (items, ed) => (items || []).filter((i) => String(i.data.edition) === String(ed)));
  eleventyConfig.addFilter("combineGallery", combineGallery);
  eleventyConfig.addFilter("docLabel", (index0, offset) => "DOC." + String(index0 + (offset || 0)).padStart(2, "0"));
  eleventyConfig.addFilter("directorLinks", (names, people, root) => renderDirectorLinks(names, people, root));
  eleventyConfig.addFilter("filmCards", (titles, films, root) => {
    const found = (titles || [])
      .map((t) => (films || []).find((f) => normalizeText(f.data.title) === normalizeText(t)))
      .filter(Boolean)
      .sort((a, b) => (Number(a.data.edition) - Number(b.data.edition)) || a.data.title.localeCompare(b.data.title));
    return renderFilmCards(found, root);
  });
  eleventyConfig.addFilter("filmCardsFromList", (filmObjs, root) => renderFilmCards(filmObjs, root));
  eleventyConfig.addFilter("peopleGroups", (peopleColl, root) => peopleGroupsOf(peopleColl, root));
  eleventyConfig.addFilter("personHighlightCards", (peopleObjs, root) => renderPersonHighlightCards(peopleObjs, root));
  eleventyConfig.addFilter("editionSection", (ed, root) => renderEditionSection(ed, root));
  eleventyConfig.addFilter("searchIndexJs", (films, people) => buildSearchIndex(films, people));
  eleventyConfig.addFilter("editionLabel", (year) => {
    const labels = { 1949: "EXPRMNTL 1", 1958: "EXPRMNTL 2", 1963: "EXPRMNTL 3", 1967: "EXPRMNTL 4", 1974: "EXPRMNTL 5" };
    return labels[year] || ("EXPRMNTL " + year);
  });
  eleventyConfig.addFilter("storyCards", (storyObjs, root) => renderStoryCards(storyObjs, root));
  eleventyConfig.addFilter("randomImage", (items, field, root) => {
    const withImages = (items || []).filter((i) => i.data && i.data[field]);
    if (!withImages.length) return "";
    const pick = withImages[Math.floor(Math.random() * withImages.length)];
    return root + pick.data[field];
  });


  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
