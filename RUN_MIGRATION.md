# How to Enable Pause/Resume Timer Functionality

The pause/resume timer functionality is ready but requires a database migration to add the necessary columns.

## Option 1: Using psql (PostgreSQL command line)

If you have psql installed, run:

```bash
psql -d consulting_time_tracker -f database/migrations/005_add_timer_pause_support.sql
```

## Option 2: Using Node.js Migration Script

1. Make sure your database is running
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Run the migration:
   ```bash
   npm run migrate ../database/migrations/005_add_timer_pause_support_safe.sql
   ```

## Option 3: Manual SQL Execution

If you have a PostgreSQL GUI tool (pgAdmin, DBeaver, etc.), you can manually execute the SQL from:
`database/migrations/005_add_timer_pause_support_safe.sql`

## What the Migration Does

Adds two columns to the `time_entries` table:
- `timer_elapsed_seconds` - Tracks total elapsed time including paused periods
- `timer_is_paused` - Boolean flag for pause state

## After Migration

Once the migration is complete:
1. Restart the backend server
2. The pause/resume buttons will automatically appear in the timer interface
3. Timers will maintain their elapsed time even when paused

## Current Status

The timer system currently works without pause/resume functionality. Timers can be started and stopped, and multiple timers can run concurrently. The pause/resume feature code is implemented and will activate automatically once the database migration is applied.