# Books

I want to make an app to track the books I read.

Key features:

- books are categorized as one of already read, currently reading, or want to read in the future
- usable on my phone and laptop, same data shared between both
- private: only I should be able to access the data
- super quick and easy to use
- list of books I've read with cover thumbnails and dates when I started and finished
- queue of books I want to read with a notes field so I can remember how I heard about it or who recommended it
- fiction / nonfiction is an important distinction to me because I often want to be reading one fiction and one non-fiction book at a time, so maybe these are like labels/tags on books but they should be prominent
- There should be 2 "next up" short lists (no more than 10 each). These are subsets of the queue of books I want to read. One "Next up: Fiction" and another "Next up: Nonfiction".
- it should be easy to sort the next up lists with drag-and-drop
- it should be easy to add and remove books I want to read in the future to/from the next up lists
- open source, self-hosted, careful secrets management

Features of lower importance:

These can come later. Not necessary for MVP.

- ad hoc lists of books
- sharing of reviews and book lists
- multiple users in a single instance, requiring authentication and authorization

## Deployment

### Fly.io Deployment

This app can be deployed to Fly.io with a few simple commands.

#### Prerequisites
- [Install the Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Sign up for a Fly.io account: `fly auth signup` (or `fly auth login`)

#### One-Time Setup

1. **Launch the app:**
   ```bash
   fly launch
   ```
   - Choose a unique app name (e.g., `my-books-tracker`)
   - Select a region close to you
   - Say **NO** to PostgreSQL for now (we'll add it separately)
   - Say **NO** to Redis
   - The CLI will create a `fly.toml` file (already included in this repo)

2. **Create a Postgres database:**
   ```bash
   fly postgres create --name books-db
   ```
   - Choose same region as your app
   - Select "Development" configuration (free tier)
   - This gives you 3GB storage, automatic backups

3. **Attach the database to your app:**
   ```bash
   fly postgres attach books-db -a your-app-name
   ```
   - This automatically sets the `DATABASE_URL` environment variable

4. **Set required secrets:**
   ```bash
   # Generate a strong JWT secret
   fly secrets set JWT_SECRET=$(openssl rand -base64 32)

   # Set WebAuthn configuration (replace your-app-name with your actual Fly.io app name)
   fly secrets set RP_ID="your-app-name.fly.dev"
   fly secrets set RP_ORIGIN="https://your-app-name.fly.dev"
   fly secrets set RP_NAME="Books Tracker"
   fly secrets set CORS_ORIGIN="https://your-app-name.fly.dev"
   ```

   **Important:** `RP_ID` and `RP_ORIGIN` must match your production domain exactly or passkeys won't work!

5. **Deploy:**
   ```bash
   fly deploy
   ```
   - First deployment takes 2-3 minutes
   - Database will be initialized automatically via `release_command`

6. **Open your app:**
   ```bash
   fly open
   ```

#### Subsequent Deployments

After initial setup, just run:
```bash
fly deploy
```

#### Monitoring & Logs

- View logs: `fly logs`
- Check status: `fly status`
- SSH into the app: `fly ssh console`
- View metrics: `fly dashboard`

#### Troubleshooting

**Passkeys not working:**
- Verify `RP_ID` matches your domain: `fly secrets list`
- `RP_ID` should be `your-app-name.fly.dev` (no https://)
- `RP_ORIGIN` should be `https://your-app-name.fly.dev` (with https://)

**Database connection errors:**
- Check database is attached: `fly postgres list`
- Verify `DATABASE_URL` is set: `fly secrets list`
- Check database status: `fly status -a books-db`

**App not responding:**
- Check health checks: `fly status`
- View recent logs: `fly logs --recent`
- Restart app: `fly apps restart`

#### Cost
With the recommended configuration:
- **App:** Free tier (3 shared VMs included)
- **Database:** Free tier (3GB storage)
- **Total:** $0/month for low-usage single-user app

Note: If you exceed free tier limits, you'll need to add a credit card and costs will apply.
