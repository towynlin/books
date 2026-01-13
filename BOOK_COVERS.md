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

### Future Enhancements

If Open Library coverage proves insufficient, we can add fallback APIs:
- Google Books API (excellent coverage for newer books)
- ISBNdb.com (comprehensive but paid)
- LibraryThing (good for older/niche books)
