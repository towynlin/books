# Books App - Setup Guide

## What's Been Built

### Backend (Node.js + Express + TypeScript + Prisma + PostgreSQL)
- ✅ REST API with full CRUD operations for books
- ✅ Goodreads CSV import endpoint
- ✅ Database schema with Book and User models
- ✅ Placeholder auth routes (passkeys to be implemented)

### Frontend (React + TypeScript + Vite + TailwindCSS)
- ✅ Book library view with tabs (Currently Reading, Next Up, Want to Read, Already Read)
- ✅ Book cards with cover thumbnails, ratings, dates
- ✅ Import page for Goodreads CSV
- ✅ React Query for data fetching
- ✅ Responsive design

### Infrastructure
- ✅ Docker Compose setup for postgres, backend, frontend
- ✅ Environment configuration

## Getting Started

### Option 1: Using Docker Compose (Recommended)

1. **Start Docker**
   - Make sure Docker (or OrbStack) is running on your machine

2. **Start all services**
   ```bash
   docker compose up
   ```

3. **Run database migrations** (in a new terminal)
   ```bash
   docker compose exec backend npx prisma migrate dev --name init
   ```

4. **Access the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Database: localhost:5432

### Option 2: Local Development

1. **Start PostgreSQL**
   ```bash
   docker compose up -d postgres
   ```

2. **Backend setup**
   ```bash
   cd backend
   npm install
   npx prisma migrate dev --name init
   npm run dev
   ```

3. **Frontend setup** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## Importing Your Goodreads Data

1. Navigate to http://localhost:5173/import
2. Upload your `goodreads_library_export.csv` file
3. Click "Import Books"
4. View your imported books on the home page

## What's Next

### To Implement:
1. **Drag-and-drop for Next Up lists** - Using @dnd-kit
2. **Passkey authentication** - Using SimpleWebAuthn
3. **Google Books API integration** - For fetching covers and metadata
4. **Category auto-guesser** - ML/API-based fiction/nonfiction detection

### Current Limitations:
- No authentication (anyone can access)
- No cover images (not fetched from APIs yet)
- Next Up lists don't support drag-and-drop yet
- Cannot manually categorize books as fiction/nonfiction in UI yet
- No book editing/deletion UI (API exists, UI needed)

## Database Schema

Books table includes:
- Basic info: title, author, isbn, cover
- Status: read, reading, want_to_read
- Category: fiction, nonfiction (nullable)
- Dates: dateStarted, dateFinished, dateAdded
- User data: myRating (1-5), notes
- Next up ordering: nextUpOrder
- Goodreads metadata preserved

## API Endpoints

### Books
- `GET /api/books` - List books (filter by status, category, nextUp)
- `GET /api/books/:id` - Get single book
- `POST /api/books` - Create book
- `PATCH /api/books/:id` - Update book
- `DELETE /api/books/:id` - Delete book
- `POST /api/books/reorder-next-up` - Reorder next-up list

### Import
- `POST /api/import/goodreads` - Import Goodreads CSV (multipart/form-data)

### Auth (Placeholder)
- `POST /api/auth/register/options`
- `POST /api/auth/register/verify`
- `POST /api/auth/login/options`
- `POST /api/auth/login/verify`

## Tech Stack Summary

**Backend:**
- Node.js 20
- Express 4
- TypeScript 5
- Prisma 5 (ORM)
- PostgreSQL 16
- Zod (validation)
- csv-parse (Goodreads import)
- SimpleWebAuthn (auth - to be implemented)

**Frontend:**
- React 18
- TypeScript 5
- Vite 6
- TailwindCSS 3
- React Query (TanStack Query) 5
- React Router 7
- @dnd-kit (drag-and-drop - to be implemented)

**Infrastructure:**
- Docker & Docker Compose
- PostgreSQL 16 Alpine
