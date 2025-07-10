#!/bin/bash

echo "42 Consulting Time Tracker Setup"
echo "================================"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "Creating database..."
createdb consulting_time_tracker

echo "Running database schema..."
psql -d consulting_time_tracker -f database/schema.sql

echo "Setting up backend..."
cd backend
cp .env.example .env
echo "Please edit backend/.env with your database credentials"

echo "Installing backend dependencies..."
npm install

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your database credentials"
echo "2. Update the admin password in the database (see README.md)"
echo "3. Start the backend: cd backend && npm run dev"
echo "4. Start the frontend: cd frontend && python -m http.server 3000"
echo "5. Open http://localhost:3000 in your browser"