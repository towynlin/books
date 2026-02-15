-- Clear next_up_order for books that are currently being read.
-- Books marked as "reading" should not appear in the Next Up list.

-- First, capture the removed orders so we can reorder per-user
-- We need to close gaps in next_up_order for each affected user

-- Step 1: Clear next_up_order for all currently-reading books
UPDATE books
SET next_up_order = NULL
WHERE status = 'reading' AND next_up_order IS NOT NULL;

-- Step 2: Reorder remaining next-up books per user to close any gaps
-- Assigns new sequential orders (0, 1, 2, ...) preserving the original ordering
WITH reordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY next_up_order) - 1 AS new_order
  FROM books
  WHERE next_up_order IS NOT NULL
)
UPDATE books
SET next_up_order = reordered.new_order
FROM reordered
WHERE books.id = reordered.id;
