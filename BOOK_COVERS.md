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

## Google Books API (Fallback)

When Open Library doesn't have a cover for a given ISBN, we fall back to the Google Books API.

### API Details

- **Volumes endpoint**: `https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}`
- **Authentication**: None required for basic usage
- **Cost**: Free (up to 1,000 requests/day without an API key)
- **Coverage**: Excellent, especially for newer and popular books

### How It Works

1. Query the Google Books Volumes API with the book's ISBN
2. Extract `imageLinks.thumbnail` from the first matching volume
3. Upgrade the thumbnail URL to a higher-resolution version by replacing `zoom=1` with `zoom=0`
4. Store the resulting URL in the database `cover_url` field

### Usage Examples

**API Request**:
```
https://www.googleapis.com/books/v1/volumes?q=isbn:9780140328721
```

**Response** (relevant fields):
```json
{
  "items": [
    {
      "volumeInfo": {
        "imageLinks": {
          "smallThumbnail": "http://books.google.com/books/content?id=...&zoom=5",
          "thumbnail": "http://books.google.com/books/content?id=...&zoom=1"
        }
      }
    }
  ]
}
```

### Implementation Notes

- Used as a fallback when Open Library returns no cover
- The `populate-covers` endpoint tries Open Library first, then Google Books
- The search endpoint also tries Google Books when Open Library has no cover for a result
- Thumbnail URLs from Google use HTTP by default; we upgrade them to HTTPS
- We replace `zoom=1` with `zoom=0` in the URL for larger images
- No API key is required for low-volume usage

### Future Enhancements

If additional coverage is still needed, we can add more fallback APIs:
- ISBNdb.com (comprehensive but paid)
- LibraryThing (good for older/niche books)
