-- Migration: book enrichment (synopsis + critic reviews)
-- Adds cached synopsis (Open Library, Wikipedia fallback), Wikipedia
-- reception excerpts, and NYT Books API reviews to the books table.
--
-- A non-null *_fetched_at with a NULL value column means "looked it up,
-- nothing found — don't retry". Transient fetch errors leave the timestamp
-- NULL so the lookup is retried on the next detail-page visit.

ALTER TABLE books
  ADD COLUMN description TEXT,
  ADD COLUMN description_source TEXT,
  ADD COLUMN description_url TEXT,
  ADD COLUMN description_fetched_at TIMESTAMPTZ,

  ADD COLUMN wikipedia_url TEXT,
  ADD COLUMN wikipedia_reception TEXT,
  ADD COLUMN wikipedia_fetched_at TIMESTAMPTZ,

  ADD COLUMN nyt_reviews JSONB,
  ADD COLUMN nyt_fetched_at TIMESTAMPTZ;
