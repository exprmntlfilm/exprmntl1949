// ---------------- helper functions (plain JS, unit-testable) ----------------

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
  if (cover) out.push(cover);
  (extra || []).forEach((g) => { if (g) out.push(g); });
  return out;
}

function jsonAttr(obj) {
  return JSON.stringify(obj || []).replace(/'/g, "&#39;");
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

function renderDirectorLinks(slugs, people, root) {
  const found = (slugs || [])
    .map((s) => (people || []).find((p) => p.data.slug === s))
    .filter(Boolean);
  const links = found.map((d) => `<a href="${root}people/${d.data.slug}.html">${d.data.name}</a>`);
  if (links.length === 0) return "";
  if (links.length === 1) return links[0];
  if (links.length === 2) return links.join(" &amp; ");
  return links.slice(0, -1).join(", ") + ", &amp; " + links[links.length - 1];
}

function renderEditionSection(ed, root) {
  const d = ed.data;
  const posterImgs = combineGallery(d.poster, d.poster_gallery);
  const galleryImgs = d.gallery || [];
  const posterInner = d.poster
    ? `<img src="${root}${d.poster}" alt="Poster for ${d.label}" style="width:100%;height:100%;object-fit:contain;">`
    : `<span class="placeholder-mark">Poster, to be added</span>`;
  const posterAttrs = posterImgs.length > 1
    ? ` data-gallery-images='${jsonAttr(posterImgs)}' data-gallery-title="${d.label} \u2014 Poster" data-gallery-root="${root}"`
    : "";

  const resourceRows = (d.resources || []).map((r, i) => `
      <div class="doc-row">
        <span class="doc-num">DOC.${String(i + 1).padStart(2, "0")}</span>
        <div><span class="doc-name">${r.name}</span><span class="doc-sub">${d.year} &middot; pending digitization</span></div>
        ${r.file
          ? `<a class="doc-status" href="${root}${r.file}" target="_blank" rel="noopener">View PDF</a>`
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
        <div><span class="doc-name">Photographs</span><span class="doc-sub">${d.year} &middot; ${galleryImgs.length > 1 ? galleryImgs.length + " photos" : "pending digitization"}</span></div>
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
    const dirNames = (f.data.directors || [])
      .map((s) => (people || []).find((p) => p.data.slug === s))
      .filter(Boolean)
      .map((p) => p.data.name)
      .join(", ");
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

  eleventyConfig.addFilter("catDisplay", catDisplay);
  eleventyConfig.addFilter("json", (obj) => JSON.stringify(obj || []));
  eleventyConfig.addFilter("findBySlug", (items, slug) => (items || []).find((i) => i.data.slug === slug));
  eleventyConfig.addFilter("byEdition", (items, ed) => (items || []).filter((i) => i.data.edition === ed));
  eleventyConfig.addFilter("combineGallery", combineGallery);
  eleventyConfig.addFilter("docLabel", (index0, offset) => "DOC." + String(index0 + (offset || 0)).padStart(2, "0"));
  eleventyConfig.addFilter("directorLinks", (slugs, people, root) => renderDirectorLinks(slugs, people, root));
  eleventyConfig.addFilter("filmCards", (slugs, films, root) => {
    const found = (slugs || [])
      .map((s) => (films || []).find((f) => f.data.slug === s))
      .filter(Boolean)
      .sort((a, b) => (a.data.edition - b.data.edition) || a.data.title.localeCompare(b.data.title));
    return renderFilmCards(found, root);
  });
  eleventyConfig.addFilter("filmCardsFromList", (filmObjs, root) => renderFilmCards(filmObjs, root));
  eleventyConfig.addFilter("peopleGroups", (peopleColl, root) => peopleGroupsOf(peopleColl, root));
  eleventyConfig.addFilter("editionSection", (ed, root) => renderEditionSection(ed, root));
  eleventyConfig.addFilter("searchIndexJs", (films, people) => buildSearchIndex(films, people));
  eleventyConfig.addFilter("editionLabel", (year) => {
    const labels = { 1949: "EXPRMNTL 1", 1958: "EXPRMNTL 2", 1963: "EXPRMNTL 3", 1967: "EXPRMNTL 4", 1974: "EXPRMNTL 5" };
    return labels[year] || ("EXPRMNTL " + year);
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
