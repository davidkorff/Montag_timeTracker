const fs = require('fs');
const path = require('path');
const db = require('../config/database');
require('dotenv').config();

async function runMigration(migrationFile) {
    try {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log(`Running migration: ${path.basename(migrationFile)}`);
        
        await db.query(sql);
        
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Error running migration:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
    console.error('Please specify a migration file');
    process.exit(1);
}

// Resolve the full path
const fullPath = path.resolve(migrationFile);
if (!fs.existsSync(fullPath)) {
    console.error(`Migration file not found: ${fullPath}`);
    process.exit(1);
}

runMigration(fullPath);