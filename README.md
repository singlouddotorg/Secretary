# Secretary

A static local application for logging songs during a shape-note singing and turning that log into a clean, ready-to-publish record of minutes. Keep all distributed files together in the same folder — the app shares a tunebook data file that won't work correctly if it's separated from the rest.

Built for the Sacred Harp / shape-note singing community, but usable for any event where you need to log a running order of items, leaders, and page/tune references.

## Part of the Sing Loud Suite

Secretary is one of six apps, each in its own repository. Secretary and Bibliographer are the two
full-featured, editing-capable apps in the suite — functioning and robust in daily use, but
not yet called "release ready" the way the others are, simply because there's much more
surface area to a full editor than to a single-purpose tool.

| App | What it does | Status |
|---|---|---|
| **Secretary** (here) | Log a singing as it happens, then turn that log into publishable minutes. | Beta |
| [**Bibliographer**](https://github.com/singlouddotorg/Bibliographer) | Curate the shared tunebook data — editions, page indexes, Level 3 scholarly files. Most people recording a singing never need it. | Beta |
| [**Capture**](https://github.com/singlouddotorg/Simple-Minutes) | A phone-sized logger: page numbers only, no names. Its files import straight into Secretary. | 1.0 release |
| [**Compile**](https://github.com/singlouddotorg/Simple-Compile) | A one-page, no-editing version of Secretary: open a CSV, get readable minutes back. | 1.0 release |
| [**Singing Ledger**](https://github.com/singlouddotorg/Ledger) | Combines many finished singings into one master record and set of totals. | New (0.1) |
| [**Tunebook Registry**](https://github.com/singlouddotorg/Tunebook-Registry) | The published tunebook data the others read. | 1.0 release |

Secretary covers the whole life of a singing in four stages — Setup, Capture (recording live),
Compile (review and enrichment), and Export — shown as numbered steps down the left, with
the same singing carrying automatically from one stage to the next.

| File | What it's for |
|---|---|---|
| `index.html` | **The app.** Open this file directly — there's no separate start page. |
| `instructions.html` | Full instructions, quick start, and troubleshooting. |
| `minutes-version.js` | This app's version number, read by both pages above so they can't disagree. |
| `shared-utils.js` | Utilities shared with Bibliographer (CSV parsing, page sorting, title building). |
| `tunebook-library.js` | Tunebook data — every Work and Edition, with full page/title indexes. **Required**; the app shows a visible error if it is missing or moved out of the folder. Published by the Tunebook Registry. |
| `tunebook-files/` | Level 3 scholarly data for the books that have it. |
| `samples/` | 15 real historical Singing Records, as worked examples and test fixtures. |
| `SCHEMA-5.md` | The Singing Record file format, which this repository owns. |

**Secretary is built for a laptop, desktop computer, or a tablet with a physical keyboard.** It is not designed for phones or phone-sized screens; no development effort goes toward optimizing for that case.

## Getting started

No installation, no build step. Runs entirely in the browser, with no runtime network requests once the page has loaded.

1. Download this repository — the green **Code** button, then **Download ZIP** — or clone it. Keep the files together in one folder; the app loads its tunebook data from beside it.
2. Open `index.html` directly in any modern browser.
3. Everything runs locally in the page — zero runtime network requests of any kind once loaded.

See `instructions.html` for the full walkthrough.

## What the app does

- **Fast entry, built for the keyboard.** Type a leader's name and a page number, hit Enter — no button required. The song title looks itself up from the book's index as you type. Leader names already used that day (and everyone listed in Officers & Roles) show up as autocomplete suggestions.
- **Catches mistakes before they happen.** Warns if a page number could mean two different songs (top/bottom), flags pages that don't exist in the book's index, and gently notes if a page has already been logged that day. The same checks apply when editing an existing entry, not just a new one.
- **A growing set of songbooks fully indexed** with a complete page-title index (several of them with a full Level 3 scholarly file besides — richer per-song data such as meter, key, and attribution), plus every other tunebook the suite knows about at some level, and an "Other" option for anything not from a listed book. See [`TUNEBOOK-CHANGELOG.md`](https://github.com/singlouddotorg/Bibliographer/blob/main/TUNEBOOK-CHANGELOG.md) (in the Bibliographer repo, which owns it) and the Tunebook Library tab in Bibliographer for the current count and list.
- **Officers & Roles** — optional fields for Chair, Vice-Chair, Secretary, Treasurer, Arranger(s), Chaplain(s), and Memorial Lesson Leader, carried through on every row of the export.
- **Setup finds or starts a singing.** Recurring singings group by series automatically, with a randomly-generated Series Code linking occurrences together and a Previous Event ID chaining each one to the last — **New Singing in This Series** carries the venue and series forward while starting fresh on date, officers, and the song list. The same continuation is available from any currently-open singing directly, as **New Singing Based on This One** — not just from a series list.
- **Markers** for Recess, Lunch, and Announcements, plus a distinct **Start New Session** action for a new day, changed location, or otherwise distinct segment of the same event — it opens its own dedicated Date and Location fields (and, if this session's officers genuinely differ, an "Officers different for this session?" section you can expand), pre-filled from what's currently in effect so leaving them untouched simply carries everything forward, then writes a real session record rather than a plain marker. This stays inside the same singing; it's not the same as starting a whole new one. Deleting a session boundary that still has songs or markers attached asks explicitly what to do with them — delete the session and everything in it together, or merge it away and fold its entries into the previous session — rather than removing just the boundary and leaving its entries silently orphaned.
- **Tags** for Call Back, Memorial, and Special songs.
- **Everything stays in your browser.** No account, no server, no data leaving your device. Entries persist automatically as you go, with an optional periodic backup download (off by default) and a one-click Download CSV / Copy at any time.
- **The same singing carries across all four stages automatically** — recording live, then moving to Compile to review, needs no manual export/import step; visiting a stage for the first time after a change hands it the current data directly.

## Using the app at a singing

1. In **Setup**, open an existing singing (grouped by series, if it's a recurring one) or start a new one.
2. Fill in **Event**, **Date**, **Location**, and (optionally) **Officers & Roles**.
3. Move to **Capture** (Stage 2). For each song: type the **Leader**, then the **Page** (e.g. `123`, `45t`, `45b` for top/bottom pages), and hit Enter.
4. Use **Recess / Lunch / Announcements** to mark breaks, **Start New Session** for a new day or a change of venue, and tag a song as **Call Back / Memorial / Special** if it applies.
5. Move to **Compile** (Stage 3) after the singing to review and enrich what was logged, then **Export** (Stage 4) to preview and download the finished result.
6. Download the CSV (or copy it) whenever you like — it's safe to do this mid-singing, and again at the end.

`samples/` contains a growing set of historical Singing Records — 15 as of this release, including these four representative examples: a single-session convention (James River), a two-day convention demonstrating Start New Session, Singing School, and Business Meeting markers (Western Massachusetts, 1999), a full 3-day, 247-entry convention transcription (National Sacred Harp Convention, 2000), and a single-session singing where the non-default tunebook (American Christmas Harp) is used far more than the primary Sacred Harp book, testing default-book detection under a reversed-majority split (Christmas Harp Singing, 2018). The rest are real, multi-year runs of two recurring singing series (the B.F. White Sacred Harp Singing Convention, 2017–2024, and the Christmas Harp Singing, 2013–2019), each year linked to the last via Series Code and Previous Event ID.

## The CSV format

Every export (manual download, clipboard copy, or automatic backup) uses these 32 columns, in this order:

| Column | Notes |
|---|---|---|
| `Schema Version` | A version marker for the CSV shape itself (currently `5`), so the app can flag a mismatch clearly instead of failing silently. |
| `Order of entry` | Sequential position in the log. |
| `Record Type` | `song`, `marker`, `session`, or `metadata`. A row with any other Record Type is preserved exactly and flagged for review rather than reinterpreted as a song — a forward-compatibility safeguard for record kinds a future version of the suite might introduce. |
| `Session Label` | The label given (if any) when "Start New Session" was used — appears only on that one `session` boundary row. Blank on every song and marker row. This is purely a display label — see `Session ID` below for what actually identifies a session. |
| `Session ID` | A stable, randomly-generated identifier for the session, assigned once when it's created and never regenerated. This — not the label above — is what Compile actually uses to track which rows and overrides belong to which session, so two sessions sharing the same date, location, or (blank) label are still tracked as genuinely separate sessions rather than merging into one. |
| `Metadata Field` / `Metadata Value` | Populated only on `metadata` rows — these carry Compile's own enrichment (business fields, name corrections, output style choices, and so on) so the file stays a complete round-trip record. Blank on every song, marker, and session row. |
| `Event` | Sticky for the whole singing; unlike Date/Location, this doesn't normally change between sessions. Blank on `metadata` rows. |
| `Date` | `YYYY-MM-DD`. Blank on `metadata` rows. |
| `Location` | Free text — venue and place together (e.g. "St. Giles Presbyterian Church, Richmond, Virginia"). Blank on `metadata` rows. |
| `Chair`, `Vice-Chair`, `Secretary`, `Treasurer`, `Arranger(s)`, `Chaplain(s)` | Optional officer names, repeated on every song/marker/session row like Event/Date/Location. Blank on `metadata` rows. |
| `Memorial Lesson Leader` | Just the name of whoever gave the memorial lesson, if any — not the names being remembered (those live in the Notes of the Memorial/Special-tagged song rows themselves). |
| `Book` | One of the built-in book abbreviations (see [`TUNEBOOK-CHANGELOG.md`](https://github.com/singlouddotorg/Bibliographer/blob/main/TUNEBOOK-CHANGELOG.md) in the Bibliographer repo for the current list), or `OTHER`. Blank for markers, session, and metadata rows. |
| `Edition Code` | The book's edition-specific identifier (e.g. `SHM1991`), when Compile has assigned or auto-detected one. |
| `Leader(s)` | Free text; multiple leaders are comma-separated. Blank for markers, session, and metadata rows. |
| `Canonical Leader(s)` | A corrected/canonical spelling of the leader's name, when Compile has one. Normally paired with a raw `Leader(s)` value it corrects — but if it ever arrives on its own, with `Leader(s)` blank, it is kept and treated as that song's leader rather than discarded. A field carrying a real name is never dropped because a related field is empty. |
| `Page` | The page/call number as typed (e.g. `45t`). Blank for `OTHER` entries, markers, session, and metadata rows. |
| `Song` | Looked up automatically for indexed books; typed directly whenever no page lookup is available — `OTHER`, a custom source name, or a known-but-unindexed Edition — and, on `marker` rows specifically, this column instead carries Compile's custom prose override for that marker, if one was written. |
| `Tag` | For song rows: blank, `Call Back`, `Memorial`, or `Special`. For `marker` rows (specifically Business Meeting markers): blank, `Treasurer's Report`, `Secretary's Report`, `Chaplain's Report`, or `Chair's Remarks`. |
| `Notes` | Free text. |
| `Marker` | The marker label — `RECESS`, `LUNCH`, `PRAYER`, `ANNOUNCEMENTS`, `SINGING SCHOOL`, or `BUSINESS MEETING`. Blank for songs and session rows. |
| `Timestamp ISO` | The authoritative instant the entry was logged, in UTC. Used for sorting/auditing, and preserved exactly through Compile rather than being overwritten with export time. |
| `Time entered` | The display-formatted local time at the moment of entry (e.g. `10:03 AM`). **This is what the app shows and re-shows on import** — it won't shift if the file is opened in a different timezone later. |
| `Series Code` | Links occurrences of a recurring singing together. Generated by the app with one click (Setup's own Generate button), deliberately not a readable word — a short human-guessable code becomes a real collision risk once many singings are compiled over the years. The field stays manually editable too, for matching a code an existing series already uses. |
| `Event ID` | Derived from Series Code + Date. Identifies this specific occurrence. |
| `Previous Event ID` | The Event ID of the prior occurrence in the same series, if known — chains a series together across singings without needing every intermediate occurrence's data present. |
| `Status` | Set by Compile during review (e.g. reflecting SHMHA-submission readiness); blank until then. |

A file can be loaded back into the app to resume, correct entries, or merge onto a different device. The importer validates the header and schema version, and rejects a row only when it's missing data genuinely required to identify what happened (a missing page on a recognized indexed book, an Other entry with neither a page nor a title). An unrecognized Record Type or an unrecognized book code is accepted and flagged for review rather than rejected — either may be a legitimate row this build doesn't have data for yet, and losing a whole file over one such row would be a worse outcome than a warning. The one case that blocks a whole file outright rather than flagging a row: a Schema Version genuinely newer than what the current build understands, since re-exporting it through this build's own current-schema header could silently drop whatever that newer schema added. If a file's rows are out of physical order but their own `Order of entry` values are valid and unique, the importer reorders them by that value before interpreting sessions, so a file that's been sorted, hand-edited, or reassembled by another tool doesn't get its songs silently attached to the wrong session.

## One master file, not several project formats

**One singing, opened once.** Setup is the only place a Singing Record is opened or imported, and what it opens becomes the singing every stage is working on. Capture and Compile each used to carry their own Import control left over from when they were separate applications; a file opened through one of those loaded into that stage alone, so Capture could show a full log of 87 entries while Setup and Compile had no idea the singing existed. Those controls are gone. The stages still hand the record to each other automatically as you move between them — that is internal synchronization of the singing already open, not a second way to open a different one.

There is one authoritative Master CSV per singing — not a separate "Capture file" and "Compile file." Capture creates the initial Master CSV; moving to Compile and enriching it (corrections, business notes, session overrides, and everything else on Compile's tabs) produces an updated Master CSV that supersedes the one before it. The newest Master CSV is always the current authoritative record. Earlier copies are fine to keep as backups, but they aren't the "real" file once a newer one exists.

The other export formats — plain text, Markdown, HTML, PDF, the SHMHA submission — are one-way publication outputs generated *from* the Master CSV. None of them are meant to be re-opened or resumed, and none of them replace it.

**Metadata passthrough:** each stage only actively interprets some of the metadata a Master CSV can carry — Compile's own business fields, name corrections, and settings, for instance. Nothing deletes a metadata field it doesn't recognize; anything unfamiliar (a field from a newer suite version, anything a given build doesn't yet display) is preserved exactly and passed through unchanged. This is what keeps the file safe to open at any stage, in any order, including a build newer or older than the one that last touched it.

**What doesn't need to survive:** a tunebook selected in Capture's Song Sources but never actually used, or a tunebook code assigned to a book with no recorded entries, are temporary setup state, not part of the historical record. Capture warns before finishing a singing if a selected source has no attributed songs (see below) — once that's been reviewed, an unused selection is allowed to disappear from the Master CSV rather than being preserved indefinitely as clutter.

## Minutes that don't name individual leaders

Some singings don't collect leader names at all, and some publish their minutes without them by choice. Compile's Minutes Maker options include **"This singing's minutes don't name individual leaders"** for exactly that case.

**It's a publication preference, not a claim about the data.** Turning it on doesn't delete anything: whatever names are on file stay in the Master CSV, in the `Leader(s)` and `Canonical Leader(s)` columns, exactly as logged. It changes only how the narrative is written. Turn it back off and every name returns. That distinction matters because the two situations look identical in the finished minutes but are completely different in the record — a singing that never collected names, and a singing that collected them and chose not to print them, both produce name-free prose from a file that still says which was which.

**What it changes.** Every narrative path restructures around what was sung rather than who sang it — the opening sentence in all five styles, Recess and Lunch re-entry, subsequent-session openings, the Singing School run, the Memorial Lesson's own songs, the closing song, the "Leaders:" summary (which becomes "Songs led included…"), and the trailing count sentence. The **Memorial Lesson Leader** is deliberately exempt: that's a separate Officer field, like Chair or Chaplain, not a per-song leader, and it stays named. The other Officer fields behave the same way.

**What it doesn't change.** The setting governs attribution wording only. It doesn't override the other Minutes Maker output toggles — if **Number of songs** is unchecked, no song count is printed, with this option on or off. (The leader count is the one genuine exception: with no names being printed, "0 leaders led 4 songs" is literally accurate and still reads as a malfunction, so the count sentence drops the leader half entirely.)

**It travels with the singing.** The setting is written to the Master CSV as the metadata row `meta.mmNoNames` and restored on import. It survives moving between stages, reopening the file later, and opening it on another device — the Master CSV is the authoritative record of it, not the browser.

**It turns itself on for a nameless file.** Importing a record that has songs but not one leader name on any of them — Capture's own everyday output, or any other file logged without names — enables this setting automatically and says so in the import summary, so the minutes read properly without anyone having to know the checkbox exists. Left alone, such a file would otherwise compile as "called to order by the leader leading…" followed by "the leader" once per song.

The detection is deliberately narrow, because the cost of guessing wrong is publishing a singing with its leaders stripped out:

- **All or nothing.** A single name anywhere among the songs makes it a mixed record, and mixed records are left alone — each unnamed song reads as "the leader" individually, which is correct. A singing where two names went unrecorded never has its other forty erased.
- **The file wins.** Anything the imported file explicitly says about this setting is honored; detection only speaks when the file is silent on the subject.
- **Your choice wins, and it sticks.** Ticking or unticking the box yourself is recorded as a deliberate decision and written to the Master CSV either way — including `meta.mmNoNames,false`. So if a nameless singing genuinely wants "the leader" prose, untick it once and reimporting that file will not quietly switch it back on. This is the one setting the app will change on its own, which is exactly why "off by default" and "off on purpose" are stored as different things.
- **Officers are unaffected**, as always — a prayer or singing-school leader logged on a marker isn't song attribution, and Officer fields are named regardless.

One thing worth knowing when compiling a Capture file: Recess and Lunch markers print as bare `RECESS` / `LUNCH` lines unless you give them prose on Compile's Song List tab. That's long-standing behavior for every record, not something specific to nameless ones.

## Unused tunebook warning

If a songbook is checked in Capture's Song Sources but no songs end up logged from it, Capture asks — right at export time — whether that's a song that still needs logging, or a checkbox that was picked by mistake. This is deliberate: books aren't brought to a singing and simply not used, so an unused selection at export time is a signal worth a second look, not something to silently carry forward or silently discard.

## Data & privacy

Nothing in the app makes any runtime network request of any kind — no CDN scripts, no remote fonts, nothing. Everything — the running log, the session settings — lives in the browser's local storage on the device you're using, plus whatever CSV files you explicitly download.

That also means: **this is single-device.** There's no sync between a phone and a laptop. If you need to hand off between devices mid-singing, download or copy the CSV and load it into the app on the other device.

## Known limitations

- Single browser/device per session — no built-in multi-user sync. (Tracked as a future consideration — see the repo's Issues.)
- Setup's own Date, Location, and Officer fields specifically represent the *first* session — correcting any of them there updates that first session's own rows only, never reaching forward into a later one. A later session's own Date, Location, and (if it genuinely differs) Officers are set once, at the moment it's created, through Start New Session's own dedicated fields — not by returning to Setup, which always means "correct the first session," regardless of which session happens to be current at the time. Correcting the Event name is the one exception that's genuinely whole-singing, updating every row in the file.
- The book indexes are only as accurate as the data entered into this project; if you spot a wrong title or a missing page, please open an issue.
- Automatic periodic backup is a real file download, not a silent background save — browsers can't do the latter. It's off by default; treat it as a bonus if you turn it on, not your only backup.
- Not yet tested for screen-reader/keyboard-only accessibility beyond the basics already in place (labeled controls, keyboard-reachable actions, visible focus states).

## Contributing

Issues and pull requests are welcome — corrections to book indexes, bug reports, and feature suggestions all included. This suite is intentionally kept to plain HTML/CSS/JS with no build step and no runtime network requests (aside from the app loading its own shared `tunebook-library.js`, a same-folder file, not a network fetch); please keep contributions that way where possible.

## License

MIT — see `LICENSE`.
