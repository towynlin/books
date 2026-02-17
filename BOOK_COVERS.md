# Book Cover Images

## Open Library Covers API

We use the Open Library Covers API to fetch book cover images for our book collection.

### API Details

- **Base URL**: `https://covers.openlibrary.org/b/isbn/{isbn}-{size}.jpg`
- **Authentication**: None required
- **Cost**: Free
- **Coverage**: Millions of books with decent coverage

### Available Sizes

- `S` - Small (thumbnail)
- `M` - Medium
- `L` - Large (recommended for display)

### Usage Examples

**Using ISBN-13**:
```
https://covers.openlibrary.org/b/isbn/9780140328721-L.jpg
```

**Using ISBN-10**:
```
https://covers.openlibrary.org/b/isbn/0140328726-L.jpg
```

### Implementation Notes

- The API works with both ISBN-10 and ISBN-13 formats
- Prefer ISBN-13 when available as it has better coverage
- Returns a blank/placeholder image if the book cover is not found
- No rate limiting concerns for typical usage
- Images are served via CDN for fast loading

### Database Fields

The `books` table already includes the necessary fields:
- `isbn` - ISBN-10 identifier
- `isbn13` - ISBN-13 identifier (preferred)
- `cover_url` - Can be used to cache the cover URL or override with custom image

## Open Library Cover ID Lookup (Fallback)

The ISBN-based cover URL returns a blank placeholder for many books. As a fallback, we use Open Library's **cover ID** system, which has better coverage because covers may be indexed under Open Library's internal ID even when the ISBN mapping is missing.

### How It Works

There are two ways to get a cover ID:

1. **From search results**: The Open Library Search API returns a `cover_i` field for each result. We use this directly when the ISBN-based URL isn't available.

2. **From the Edition API**: For books already in the database (e.g. during populate-covers or Goodreads import), we query the Edition API to get cover IDs.

### API Details

**Cover ID URL**:
```
https://covers.openlibrary.org/b/id/{cover_id}-L.jpg
```

**Edition API** (to look up cover IDs by ISBN):
```
https://openlibrary.org/isbn/{isbn}.json
```

Response includes a `covers` array of integer IDs:
```json
{
  "covers": [8739161],
  "isbn_13": ["9780140328721"],
  ...
}
```

### Implementation Notes

- Same provider (Open Library / Internet Archive) — no new third-party tracking
- The Edition API is only called when the ISBN-based cover URL is unavailable
- Negative cover IDs in the `covers` array indicate deleted covers and are skipped
- Search results use `cover_i` directly (no extra API call needed)

### Privacy

Both lookup methods stay entirely within Open Library, a non-profit run by the Internet Archive. No data is sent to any big tech company.

### Future Enhancements

If coverage is still insufficient, potential options:
- ISBNdb.com (comprehensive but paid)
- LibraryThing (good for older/niche books)
