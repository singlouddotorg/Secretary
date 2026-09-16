// Minutes / Tunebooks — Shared Utilities
//
// Plain global-scope script (attaches to window.EZMinutesShared), NOT an ES module -
// deliberately, since `import`/`export` modules are blocked by Chrome when a page is
// opened directly via file://, and this whole suite's core value proposition is "double-
// click the file, no server needed." This follows exactly the same loading pattern
// tunebook-library.js already uses successfully. Load this file before any script that
// calls into it.
//
// Extracted from real, live duplication found across the suite: parseCSV existed as
// three near-identical copies (capture.html, compile.html, setup.html) with three small
// but real behavioral differences between them (BOM-stripping, CRLF handling, blank-row
// filtering) that had to be reconciled, not just picked arbitrarily - see the version
// history below. esc()/escapeHtml() existed in four places, sortPages()/comparePageMisc()
// in three (including the Tunebook Registry), findMasterListMatch() in two.

(function(global){
  "use strict";

  // ---------------- Version ----------------
  // This is THIS FILE's version, not any application's.
  //
  // It briefly held the whole suite's version number, which was the right answer while one
  // repository held every app: the v156 review had found instructions.html six revisions
  // behind the running app, and a single literal that every page reads at runtime fixed it.
  // Splitting the suite made that answer wrong. Tunebooks carries its own copy of this file
  // and would have been shipping Minutes' version number inside it. Each app versions
  // itself now - see minutes-version.js and TUNEBOOK_EDITOR_VERSION - and what belongs here
  // is only the identity of these shared utilities, so an app can report which vintage of
  // them it is carrying.
  var SHARED_UTILS_VERSION = "1.2.0";

  // ---------------- CSV parsing ----------------
  // Reconciles the three prior copies' behavior: capture.html and setup.html stripped a
  // leading BOM and skipped bare \r; compile.html instead pre-normalized \r\n/\r to \n and
  // never explicitly stripped BOM (though its callers' own header.trim() calls happened
  // to strip it anyway, since \uFEFF falls in JS's whitespace class - confirmed by testing
  // a real BOM-prefixed import against compile.html before this consolidation, so this
  // isn't fixing a live bug, just making the behavior explicit and consistent rather than
  // accidental). capture.html and compile.html both filtered out fully-blank trailing
  // rows; setup.html didn't, but its own caller already defensively skips blank rows
  // itself, so adding the filter here is safe for all three original call sites.
  function parseCSV(text){
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++){
      var c = text[i];
      if (inQuotes){
        if (c === '"'){
          if (text[i+1] === '"'){ field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ""; }
        else if (c === '\r') { /* skip; \n below ends the row */ }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function(r){ return !(r.length === 1 && r[0] === ""); });
  }

  // A single CSV cell's escaping rules: guard against a leading =/+/-/@ being read as a
  // spreadsheet formula by whatever opens the file next, quote the cell if it contains a
  // comma, quote, or newline, and double up any internal quotes. Identical across every
  // prior copy - no reconciliation needed here, just consolidation.
  function csvCell(v){
    var s = String(v == null ? "" : v);
    if (s && "=+-@".indexOf(s[0]) !== -1) s = "'" + s;
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // ---------------- HTML escaping ----------------
  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  // ---------------- page sorting ----------------
  // Roman-numeral front matter sorts by true value (not alphabetically - "viii" must not
  // sort before "ix" just because 'v' < 'x'), then ordinary numbered pages, then anything
  // else (an appendix's "a184.2," say) grouped after them - matching where an appendix
  // actually sits in a real book, not wherever plain string sorting would put it.
  var ROMAN_VALUES = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10,
    xi:11, xii:12, xiii:13, xiv:14, xv:15, xvi:16, xvii:17, xviii:18, xix:19, xx:20,
    xxi:21, xxii:22, xxiii:23, xxiv:24, xxv:25, xxvi:26, xxvii:27, xxviii:28, xxix:29, xxx:30,
    xxxi:31, xxxii:32, xxxiii:33, xxxiv:34, xxxv:35, xxxvi:36, xxxvii:37, xxxviii:38, xxxix:39 };

  function romanValue(s){
    var v = ROMAN_VALUES[s.toLowerCase()];
    return v === undefined ? null : v;
  }

  // Compares two "anything else" page keys - an appendix's "a104," "A184.2," etc. - the
  // same way a person reading the appendix would: by its letter prefix, then the number
  // embedded in it, then whatever's left over (a t/b split, a decimal suffix). Plain
  // string comparison alone gets this wrong in a way that's easy to miss in review: "a108"
  // sorts before "a11" as text, because the character '0' is less than '1' at the third
  // position - nothing to do with the actual page numbers 108 and 11. Falls back to plain
  // string comparison only when a key has no digits in it at all (e.g. a bare label).
  function comparePageMisc(a, b){
    var ma = /^([A-Za-z]*)(\d+)(.*)$/.exec(a);
    var mb = /^([A-Za-z]*)(\d+)(.*)$/.exec(b);
    if (!ma || !mb) return a < b ? -1 : (a > b ? 1 : 0);
    var prefixA = ma[1].toLowerCase(), prefixB = mb[1].toLowerCase();
    if (prefixA !== prefixB) return prefixA < prefixB ? -1 : 1;
    var numA = parseInt(ma[2], 10), numB = parseInt(mb[2], 10);
    if (numA !== numB) return numA - numB;
    var sa = ma[3], sb = mb[3];
    if (sa === sb) return 0;
    if (sa === "t") return -1;
    if (sb === "t") return 1;
    return sa < sb ? -1 : 1;
  }

  function sortPages(pages){
    return pages.sort(function(a, b){
      var na = parseInt(a, 10), nb = parseInt(b, 10);
      var aIsNum = !isNaN(na), bIsNum = !isNaN(nb);
      var aRoman = aIsNum ? null : romanValue(a), bRoman = bIsNum ? null : romanValue(b);
      var aGroup = aRoman !== null ? 0 : (aIsNum ? 1 : 2);
      var bGroup = bRoman !== null ? 0 : (bIsNum ? 1 : 2);
      if (aGroup !== bGroup) return aGroup - bGroup;
      if (aGroup === 0) return aRoman - bRoman;
      if (aGroup === 2) return comparePageMisc(a, b);
      if (na !== nb) return na - nb;
      var sa = a.replace(/^\d+/, ""), sb = b.replace(/^\d+/, "");
      if (sa === sb) return 0;
      if (sa === "t") return -1;
      if (sb === "t") return 1;
      return sa < sb ? -1 : 1;
    });
  }

  // ---------------- Master Tunebook List lookup ----------------
  // Optional supplementary data (master-tunebook-list.js) - never required to load; a
  // book value that doesn't match anything here just returns null, same as before this
  // file existed. Matches by record key first, then by workCode/shmhaCode for a Level 2
  // record cited by one of those instead.
  function findMasterListMatch(bookVal){
    // Deliberately a bare typeof check, not global.EZ_MINUTES_MASTER_TUNEBOOK_LIST (a
    // window-property lookup) - master-tunebook-list.js declares its export with `const`,
    // and a top-level const in a <script> tag never becomes a property of window (only
    // var does). This is real JS/HTML semantics, confirmed directly, not a guess: every
    // classic script on a page shares one script-level lexical environment for let/const/
    // class, separate from the window object itself. The window-property check silently
    // never matched anything, in every real build, since this function was first written -
    // found by testing this feature against the actual shipping files, not assumed working
    // because it had "always" been there. This matches the same bare-identifier pattern
    // already used correctly everywhere else in this codebase for EZ_MINUTES_TUNEBOOKS.
    if (!bookVal || typeof EZ_MINUTES_MASTER_TUNEBOOK_LIST === "undefined") return null;
    var books = EZ_MINUTES_MASTER_TUNEBOOK_LIST.books || {};
    if (books[bookVal]) return books[bookVal];
    var needle = bookVal.trim().toLowerCase();
    var found = null;
    Object.keys(books).forEach(function(key){
      if (found) return;
      var rec = books[key];
      if (key.toLowerCase() === needle) { found = rec; return; }
      if (rec.workCode && rec.workCode.toLowerCase() === needle) { found = rec; return; }
      if (rec.shmhaCode && rec.shmhaCode.toLowerCase() === needle) { found = rec; return; }
    });
    return found;
  }

  // ---------------- Tunebook Library adapters ----------------
  // Projects EZ_MINUTES_TUNEBOOK_LIBRARY (the Work/Edition/State model) into the exact
  // shapes EZ_MINUTES_TUNEBOOKS and EZ_MINUTES_MASTER_TUNEBOOK_LIST have always had, so
  // every existing lookup throughout Capture, Compile, Tunebooks, and the Registry
  // keeps working completely unchanged - none of that code needs to know the Library
  // exists. This is deliberately the SAME projection logic Tunebooks' own "Generate
  // legacy projection" export uses (ported here so both call one real implementation
  // instead of two that could quietly drift apart), just returning a live object instead
  // of writing a file.
  function buildTunebookIndexFromLibrary(library){
    var books = {};
    if(!library || !library.editions || !library.works) return { books: books };
    Object.keys(library.editions).forEach(function(editionId){
      var e = library.editions[editionId];
      if(e.indexStatus !== "complete") return;
      var w = library.works[e.workId];
      if(!w) return;
      var rec = {
        fullTitle: buildFullTitle(e.titleProper || w.titleProper, e.subtitle),
        // This Edition's own effective title proper - e.titleProper when the Edition
        // overrides it, otherwise the owning Work's - with no subtitle folded in, unlike
        // fullTitle. Kevin's own request: Minutes' book-naming prose (the opening "Song
        // selections were from ___" sentence and its all-books variant) should read as
        // "The Sacred Harp", not "The Sacred Harp: 2025 Edition" - fullTitle is still the
        // right choice anywhere the subtitle actually disambiguates (dropdowns, warnings).
        titleProper: e.titleProper || w.titleProper,
        // The owning Work's own title, independent of this Edition's own titleProper
        // override or subtitle - lets a sort distinguish "which Work does this row
        // belong to" from "what does this specific Edition's own full title read as",
        // which fullTitle alone can't do once an Edition has a real subtitle.
        workTitleProper: w.titleProper,
        subtitle: e.subtitle,
        commonName: e.commonName,
        workCode: w.workCode,
        shmhaCode: e.shmhaCode,
        compiler: e.compiler,
        publisher: e.publisher,
        placePublished: e.placePublished,
        // V81 review, finding 8: this used to derive publicationYear purely from
        // editionIdentifierYear/editionFirstPublicationDate, completely ignoring the real
        // e.publicationYear field - invisible while every real bundled edition happened
        // to have both values coincide, but a real, latent bug the moment anyone edits
        // Publication Year to a genuinely different value (which the Library's own editor
        // has explicitly supported as a separate field since V79-01). The real field is
        // now preferred outright; the old derivation only fills in for an edition that
        // has never had Publication Year entered at all.
        publicationYear: e.publicationYear || (/^\d{4}$/.test(e.editionIdentifierYear || "") ? e.editionIdentifierYear : (e.editionFirstPublicationDate || e.editionIdentifierYear)),
        shapeSystem: e.shapeSystem,
        badgeColor: e.badgeColor,
        badgeTextColor: e.badgeTextColor,
        isSacredHarpDefault: e.isSacredHarpDefault,
        // v122: real, existing field on the Library data (Kevin's own "common" vs
        // "search" split, so Minutes can show a short, curated list by default and let
        // someone search for anything less frequently used) - genuinely missing from
        // this projection until now, meaning Minutes had no way to see it even for the
        // handful of editions already tagged with it. Confirmed live before fixing:
        // EZ_MINUTES_TUNEBOOKS.books[code].ezMinutesVisibility was undefined for every
        // single book, common or not.
        ezMinutesVisibility: e.ezMinutesVisibility,
        addedIn: e.addedIn,
        songs: e.songs || {}
      };
      Object.keys(rec).forEach(function(k){ if(rec[k] === undefined) delete rec[k]; });
      books[e.editionCode] = rec;
    });
    return { books: books };
  }

  function buildMasterListFromLibrary(library){
    var books = {};
    if(!library || !library.editions || !library.works) return { books: books };
    var workIdsWithCompleteEdition = {};
    var workIdsWithAnyEdition = {};
    Object.keys(library.editions).forEach(function(editionId){
      var e = library.editions[editionId];
      workIdsWithAnyEdition[e.workId] = true;
      if(e.indexStatus === "complete") workIdsWithCompleteEdition[e.workId] = true;
    });
    // V81-side-quest finding: this used to produce exactly one entry per Work lacking a
    // complete Edition, regardless of how many real, distinct Level 1 Editions actually
    // existed under it - a Work with five separate Level 1 Editions (five real, different
    // years, e.g. SHD1936 through SHD1987) collapsed into a single generic "SHD" entry,
    // with no way to tell the five apart or that they even existed as distinct records at
    // all. Confirmed live: added five real Level 1 Editions under one Work, and the
    // Registry - the one real consumer of this projection's actual output - showed
    // nothing where five real book rows should have been. Now: a real Edition (even at
    // Level 1, with nothing indexed yet) gets its own entry, keyed by its own Edition
    // Code; the original "bare Work, no Edition record exists at all yet" case is
    // preserved exactly as it was for a Work that genuinely has none.
    Object.keys(library.editions).forEach(function(editionId){
      var e = library.editions[editionId];
      if(e.indexStatus === "complete") return;
      var w = library.works[e.workId];
      var rec = {
        fullTitle: buildFullTitle(e.titleProper || (w && w.titleProper), e.subtitle),
        // Same rationale as buildTunebookIndexFromLibrary() above: the owning Work's own
        // title, separate from this Edition's own fullTitle (which folds in subtitle),
        // needed to group same-Work Editions together correctly when sorting - and
        // publicationYear, entirely missing from this projection before, needed to order
        // them correctly once grouped. Same preferred-field-with-fallback derivation as
        // the Level 2/3 projection above, for one real rule, not two that could drift.
        workTitleProper: w && w.titleProper,
        // Same titleProper/fullTitle split as buildTunebookIndexFromLibrary() above, kept
        // here too so a known-but-unindexed Edition (findMasterListMatch's own fallback)
        // gets the same subtitle-free name in Minutes' book-naming prose.
        titleProper: e.titleProper || (w && w.titleProper),
        publicationYear: e.publicationYear || (/^\d{4}$/.test(e.editionIdentifierYear || "") ? e.editionIdentifierYear : (e.editionFirstPublicationDate || e.editionIdentifierYear)),
        commonName: e.commonName || (w && w.titleProper),
        workCode: (w && w.workCodeStatus === "unknown") ? null : ((w && w.workCode) || null),
        workCodeStatus: w && w.workCodeStatus,
        shmhaCode: e.shmhaCode || (w && w.shmhaCode),
        editionCode: e.editionCode,
        editionId: e.editionId,
        supportLevel: 1
      };
      Object.keys(rec).forEach(function(k){ if(rec[k] === undefined || rec[k] === null) delete rec[k]; });
      books[e.editionCode || e.editionId] = rec;
    });
    Object.keys(library.works).forEach(function(workId){
      if(workIdsWithCompleteEdition[workId]) return;
      if(workIdsWithAnyEdition[workId]) return; // already covered above, per-Edition
      var w = library.works[workId];
      var rec = {
        fullTitle: buildFullTitle(w.titleProper, null),
        titleProper: w.titleProper,
        workTitleProper: w.titleProper,
        commonName: w.titleProper,
        workCode: w.workCodeStatus === "unknown" ? null : (w.workCode || null),
        workCodeStatus: w.workCodeStatus,
        shmhaCode: w.shmhaCode,
        supportLevel: 1
      };
      Object.keys(rec).forEach(function(k){ if(rec[k] === undefined) delete rec[k]; });
      var key = (w.workCodeStatus !== "unknown" && w.workCode) ? w.workCode : workId;
      books[key] = rec;
    });
    return { books: books };
  }

  // R68-13: Full Title is defined as Title Proper + Subtitle / Other Title, but every
  // consumer of this projection was just using titleProper alone - fullTitle was never
  // actually full for any edition with a real subtitle, which many bundled editions have,
  // Sacred Harp among them. One real builder, used everywhere a Full Title is needed,
  // rather than the same wrong shortcut reimplemented in more than one place.
  function buildFullTitle(titleProper, subtitle){
    var t = (titleProper || "").trim();
    var s = (subtitle || "").trim();
    if(!s) return t;
    if(!t) return s;
    return t + ": " + s;
  }

  var EZMinutesShared = {
    SHARED_UTILS_VERSION: SHARED_UTILS_VERSION,
    version: "1",
    parseCSV: parseCSV,
    csvCell: csvCell,
    escapeHtml: escapeHtml,
    esc: escapeHtml,
    ROMAN_VALUES: ROMAN_VALUES,
    romanValue: romanValue,
    comparePageMisc: comparePageMisc,
    sortPages: sortPages,
    findMasterListMatch: findMasterListMatch,
    buildTunebookIndexFromLibrary: buildTunebookIndexFromLibrary,
    buildMasterListFromLibrary: buildMasterListFromLibrary,
    buildFullTitle: buildFullTitle
  };

  if (typeof module !== "undefined" && module.exports) module.exports = EZMinutesShared;
  else global.EZMinutesShared = EZMinutesShared;

})(typeof window !== "undefined" ? window : this);
