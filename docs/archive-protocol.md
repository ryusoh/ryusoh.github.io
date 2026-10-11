# Personal archive protocol

**Status:** living document
Scope: lifetime body of photographic work (RAW + JPEG masters).

## Masters and formats

RAW files and exported JPEG masters are kept in open, vendor-independent formats
(DNG/TIFF/JPEG). Closed vendor codecs never exist as the only copy; convert at
ingest if the camera doesn't ship DNG.

## 3-2-1 backup layout

Three copies of every master: two on different media (e.g. internal disk +
external disk), one offsite. Offsite rotation is revisited whenever the
inventory of drives changes, following the Library of Congress personal-archiving
guidance to keep backup copies in different places.

## Metadata at ingest

Descriptive metadata is written at ingest, not later: who, what, when, where for
every shoot. Undescribed files are the first casualty of archive rot — a frame
without context loses most of its value within a decade.

## Verification schedule (checksum audits)

A SHA-256 checksum registry is maintained for masters and audited on a fixed
schedule to catch silent bit rot and single-copy loss. Verification is
deliberately boring and logged; the schedule survives mood.

## README for the future reader

A plain-language README at the archive root explains the layout, naming, and
backup topology so a future self — or an archivist — can interpret the whole
system without guesswork. It is updated whenever the topology changes.
