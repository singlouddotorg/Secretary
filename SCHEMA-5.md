# Singing Record — Schema 5

The file format for one singing. **Secretary** reads and writes it; **Simple Minutes** writes
it; anything else that wants to hand a singing to Secretary should produce it.

This document exists because Schema 5 is a contract between applications that no longer
share a repository. Before the split it was described only inside Secretary's own README, which
was fine while both sides were edited together and is not fine now: the first time either
side adds a column without the other knowing, files start failing in ways neither app can
explain.

**Owned by the Secretary repository.** Secretary holds the importer, the validator, and the
tests that enforce this. A change to the format is a change here first.

---

## Shape

A single CSV file. One header row, then one row per thing that happened, in the order it
happened. **32 columns, always all of them, always in this order**, whatever the row type —
a row that has nothing to say in a column leaves it empty rather than omitting it.

```
Schema Version, Order of entry, Record Type, Session Label, Session ID,
Metadata Field, Metadata Value, Event, Date, Location,
Chair, Vice-Chair, Secretary, Treasurer, Arranger(s), Chaplain(s), Memorial Lesson Leader,
Book, Edition Code, Leader(s), Canonical Leader(s), Page, Song, Tag, Notes, Marker,
Timestamp ISO, Time entered, Series Code, Event ID, Previous Event ID, Status
```

Ordinary CSV quoting: a field containing a comma, quote or newline is wrapped in double
quotes, and a literal quote inside it is doubled. UTF-8. A leading BOM is tolerated on read
and not written.

---

## Record types

The `Record Type` column says what a row is. Five are defined:

| Type | What it is |
|---|---|
| `session` | A session boundary — a new day, a changed venue, or another distinct segment of the same singing. Carries that session's own Date, Location and Officers. |
| `song` | One song, as called. |
| `marker` | Something that happened that isn't a song: a recess, lunch, a prayer, announcements, a business meeting. |
| `metadata` | Not an event at all. Carries one `Metadata Field` / `Metadata Value` pair — settings and enrichment that belong to the singing as a whole. |
| `namesuggestion` | A proposed correction to a leader's name, kept with the record rather than applied silently. |

**An unrecognized Record Type is preserved exactly and flagged for review — never
reinterpreted as a song and never dropped.** A row type a future version introduces must
survive a round trip through an older build. This is a hard rule, not a nicety: losing a
whole file's worth of unfamiliar rows is a far worse outcome than a warning.

---

## Columns

### Identity and order

| Column | Notes |
|---|---|
| `Schema Version` | `5`. See *Version gate* below. |
| `Order of entry` | Sequential position. If rows are out of physical order but their own values are valid and unique, an importer must reorder by this before interpreting sessions — a file that has been sorted or reassembled by another tool must not get its songs attached to the wrong session. |
| `Record Type` | One of the five above. |

### Sessions

| Column | Notes |
|---|---|
| `Session Label` | A human label ("Day 2", "Saturday Afternoon"), on the `session` boundary row only. Display only. |
| `Session ID` | A stable, generated identifier, assigned once and never regenerated. **This, not the label, is what identifies a session.** Two sessions sharing a date, a venue, or a blank label are still distinct. Every song and marker carries the ID of the session it belongs to. |

Two session boundaries sharing one `Session ID` is a malformed file: an importer cannot tell
those sessions apart, and should refuse the file rather than guess.

### The singing

| Column | Notes |
|---|---|
| `Event` | Sticky for the whole singing. Blank on `metadata` rows. |
| `Date` | `YYYY-MM-DD`. Per-session — a two-day convention has two values. Blank on `metadata` rows. |
| `Location` | Free text, venue and place together. Per-session. Blank on `metadata` rows. |

### Officers

`Chair`, `Vice-Chair`, `Secretary`, `Treasurer`, `Arranger(s)`, `Chaplain(s)`,
`Memorial Lesson Leader` — repeated on every song, marker and session row, per session.
Blank on `metadata` rows.

`Memorial Lesson Leader` is the person who conducted the memorial lesson. It is **not** a
per-song leader, and publication settings that suppress song attribution do not suppress it.

### The song

| Column | Notes |
|---|---|
| `Book` | A book abbreviation, or `OTHER`. Blank for markers, sessions and metadata. |
| `Edition Code` | The specific printing (`SHM2025`), where known. |
| `Leader(s)` | Free text; several leaders comma-separated. |
| `Canonical Leader(s)` | A corrected spelling of that row's leader. **Normally paired with a raw `Leader(s)` it corrects — but valid on its own.** If it carries a name and `Leader(s)` is blank, that name is the row's leader. It must not be discarded because a related field is empty. |
| `Page` | The page or call number as spoken (`45t`, `45b`, `123`). Blank for `OTHER` entries, markers, sessions and metadata. |
| `Song` | The title. Looked up from the book's index where possible, typed where not. **On `marker` rows this column instead carries custom prose for that marker**, if any was written. |
| `Tag` | On song rows: blank, `Call Back`, `Memorial (Sick)`, `Memorial (Deceased)`, `Special`, `Singing School`, or `Closing`. On Business Meeting markers: blank, `Treasurer's Report`, `Secretary's Report`, `Chaplain's Report`, `Chair's Remarks`. |
| `Notes` | Free text. On memorial songs this often carries the names being remembered. |
| `Marker` | The marker label — `RECESS`, `LUNCH`, `PRAYER`, `ANNOUNCEMENTS`, `SINGING SCHOOL`, `BUSINESS MEETING`. Blank for songs and sessions. |

### Time

| Column | Notes |
|---|---|
| `Timestamp ISO` | The authoritative instant, in UTC. Used for sorting and auditing; preserved exactly through a round trip, never overwritten with export time. |
| `Time entered` | The local time as displayed when the entry was made (`10:03 AM`). **This is what is shown and re-shown on import**, so a file opened in another timezone still reads as the singing actually ran. |

### Series identity

| Column | Notes |
|---|---|
| `Series Code` | Links occurrences of a recurring singing. Generated, deliberately not a readable word — a guessable code becomes a real collision risk over years of compiled singings. |
| `Event ID` | `{Series Code}-{Date}`. Identifies this occurrence. Derived, not a second thing to maintain. |
| `Previous Event ID` | The prior occurrence's Event ID, chaining a series without needing every intermediate year present. |
| `Status` | Set during review (e.g. SHMHA submission readiness). Blank until then. |

---

## Metadata rows

A `metadata` row carries one `Metadata Field` and one `Metadata Value`; its event, date,
officer and song columns are blank. This is how a singing's settings and enrichment survive
a round trip.

Fields currently defined:

- `meta.ordinal`, `meta.eventType`, `meta.outputType`, `meta.recurringDate`,
  `meta.openingStyle`, `meta.presidingTitle`, `meta.prayerStyle`, `meta.closingPrayerStyle`,
  `meta.host`, `meta.present`, `meta.defaultBook`, `meta.books`, `meta.suiteVersion`
- Publication booleans (`true`/`false`): `meta.mmSongNumber`, `meta.mmSongTitle`,
  `meta.mmAllSources`, `meta.mmSingers`, `meta.mmLeaders`, `meta.mmSongs`,
  `meta.mmSongIndex`, `meta.mmTitleCaps`, `meta.mmStateDefaultBook`, `meta.mmNoNames`
- `roles.pitcher`, `roles.localhost`, `roles.chairTitle`, `roles.vicechairTitle`,
  `roles.secretaryTitle`
- `business.*` and `lists.*` — the compiled narrative's own content
- `nameMap.{normalized name}` — a leader-name correction, kept independently of whether any
  surviving row still uses that name
- `sessionOverride.{role}` — an officer who differs for one session, keyed by Session ID

**`meta.mmNoNames` deserves its own note**, because it is the one setting an application may
turn on by itself. It means *this singing's minutes do not name individual leaders* — a
publication preference, never a claim that names weren't collected. Two rules follow:

1. Absent means "nobody has decided." Present means someone did — including
   `meta.mmNoNames,false`, which is how a record whose songs carry no names at all records a
   deliberate choice to publish "the leader" prose anyway. An importer that infers this
   setting from the data must not overrule an explicit value in the file.
2. It changes wording only. It never removes names from the columns above.

### Unrecognized metadata is passed through

A `metadata` field an application doesn't understand is **kept verbatim and re-exported
unchanged**. This is what lets one file move between applications, and between builds of
different ages, without one of them quietly deleting what another relies on. The same
principle as unrecognized Record Types, and the same reasoning.

---

## Version gate

`Schema Version` is a number, currently `5`. Versions `1`–`5` are readable.

A file declaring a version **newer** than the reading application understands is refused
outright — not partially imported. Re-exporting it through an older build's header would
silently drop whatever the newer schema added, and a file that quietly loses data is worse
than a file that won't open.

This is the only condition that blocks a whole file. Everything else — an unfamiliar Record
Type, an unknown book code, an unrecognized metadata field — is accepted and flagged.

---

## Writing a minimal valid record

Simple Minutes is the worked example: it writes one `session` row and one `song` or `marker`
row per entry, fills `Event` / `Date` / `Location` / `Book` / `Page` / `Song` / timestamps,
and leaves **every officer and leader column blank**. That is a complete, valid Schema 5
file. Secretary imports it, notices there are songs but no leader names anywhere, and turns on
`meta.mmNoNames` so the minutes read as prose about what was sung rather than "the leader"
once per song.

The floor is low on purpose: `Schema Version`, `Order of entry`, `Record Type`, a
`Session ID` on every event row, and enough of `Book`/`Page`/`Song` to identify what was
sung. Everything else can be filled in later, in Compile, by a person.

---

## Changing this format

1. Change this document first, in the Secretary repository.
2. Bump `Schema Version` only when a change would make an older build misread a file. Adding
   a metadata field does **not** need a bump — passthrough already covers it. Adding,
   removing or reordering a *column* does.
3. Update Secretary's importer and its round-trip tests together.
4. Tell the other writers. Today that is Simple Minutes.

The passthrough rules exist precisely so that most useful changes need no version bump and
no coordinated release. Use them.
