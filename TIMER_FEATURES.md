# Timer Features Documentation

## Overview

The 42 Consulting Time Tracker now supports advanced timer functionality including:
- Multiple concurrent timers (one per project)
- Pause/resume capability for each timer
- Persistent timer state across sessions
- Real-time timer synchronization

## Key Features

### 1. Multiple Concurrent Timers
- Start separate timers for different projects simultaneously
- Each project can have only one active timer at a time
- All active timers are displayed in the "Active Timers" section

### 2. Pause/Resume Functionality
- **Pause Button (⏸)**: Temporarily stops the timer while preserving elapsed time
- **Resume Button (▶)**: Continues timing from where you paused
- Visual indicators:
  - Green pulsing border = Running timer
  - Yellow border = Paused timer

### 3. Timer Notes
- Add notes directly in the timer card while timing
- Notes are saved automatically when you click outside the input field
- No prompts or popups - just type in the notes field

### 4. Manual Time Entry
- Click "Add Time" button in Today's Work section
- Enter hours, description, and optionally override the date
- Useful for adding time after the fact

## Visual Indicators

### Timer States
1. **Running Timer**:
   - Green background (#f0fdf4)
   - Green border (#86efac)
   - Pulsing green indicator dot

2. **Paused Timer**:
   - Yellow background (#fef3c7)
   - Yellow border (#fde68a)
   - Solid yellow indicator dot

3. **Timer Badge**:
   - Shows "Timer Active" on project cards with running timers
   - Prevents starting duplicate timers for the same project

## Database Schema Updates

The following columns were added to support pause/resume:
- `timer_elapsed_seconds`: Tracks total elapsed time including paused periods
- `timer_is_paused`: Boolean flag indicating current pause state

To apply these changes, run:
```bash
cd backend
npm run migrate ../database/migrations/005_add_timer_pause_support_safe.sql
```

## Usage Tips

1. **Quick Timer Start**: Click any project's "Start Timer" button
2. **Pause for Breaks**: Use pause button during interruptions
3. **Add Context**: Type notes while the timer runs
4. **Stop When Done**: Click stop button to save the time entry

## Technical Implementation

- Timer state managed using JavaScript Map data structures
- Real-time updates every second for running timers
- API endpoints: `/timer/start`, `/timer/pause/:id`, `/timer/resume/:id`, `/timer/stop/:id`
- Graceful fallback for databases without pause columns