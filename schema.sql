-- Applied automatically (idempotently) on first request. Safe to run manually too.

CREATE TABLE IF NOT EXISTS entries (
  id              SERIAL PRIMARY KEY,
  created_by      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),   -- automatic server timestamp
  occurred_at     TIMESTAMPTZ NOT NULL,                 -- editable observation time
  location_text   TEXT        NOT NULL DEFAULT '',
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  vehicle         TEXT        NOT NULL DEFAULT '',      -- optional: make / colour / plate
  notes           TEXT        NOT NULL DEFAULT '',
  recheck_due_at  TIMESTAMPTZ NOT NULL,
  recheck_done_at TIMESTAMPTZ,                          -- set when followed up or dismissed
  follow_up_of    INTEGER REFERENCES entries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS entries_occurred_idx ON entries (occurred_at DESC);

CREATE TABLE IF NOT EXISTS photos (
  id         SERIAL PRIMARY KEY,
  entry_id   INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  mime       TEXT    NOT NULL DEFAULT 'image/jpeg',
  data       BYTEA   NOT NULL,                          -- resized JPEG (EXIF kept)
  thumb      BYTEA   NOT NULL,                          -- small JPEG for lists / compact PDF
  sha256     TEXT    NOT NULL,                          -- hash of `data`, printed in the PDF
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_entry_idx ON photos (entry_id, position, id);
