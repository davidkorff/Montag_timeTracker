const fs = require('fs');
const path = require('path');
const db = require('../config/database');
require('dotenv').config();

async function dumpLocalSchema() {
  try {
    console.log('Dumping local database schema...');
    
    let schemaSQL = `-- Complete Database Schema from Local
-- Generated on ${new Date().toISOString()}
-- This will recreate the entire database structure

-- Drop and recreate schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

`;

    // Get all tables
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`Found ${tablesResult.rows.length} tables`);

    // For each table, get the CREATE TABLE statement
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`Processing table: ${tableName}`);

      // Get table structure
      const columnsResult = await db.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Start CREATE TABLE
      schemaSQL += `\n-- Table: ${tableName}\n`;
      schemaSQL += `CREATE TABLE ${tableName} (\n`;

      // Add columns
      const columnDefs = [];
      for (const col of columnsResult.rows) {
        let colDef = `    ${col.column_name} `;
        
        // Handle data types
        if (col.data_type === 'character varying') {
          colDef += `VARCHAR${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`;
        } else if (col.data_type === 'numeric') {
          colDef += `NUMERIC${col.numeric_precision ? `(${col.numeric_precision},${col.numeric_scale || 0})` : ''}`;
        } else if (col.data_type === 'USER-DEFINED' && col.udt_name === 'uuid') {
          colDef += 'UUID';
        } else if (col.data_type === 'timestamp without time zone') {
          colDef += 'TIMESTAMP';
        } else if (col.data_type === 'ARRAY' && col.udt_name === '_uuid') {
          colDef += 'UUID[]';
        } else {
          colDef += col.data_type.toUpperCase();
        }
        
        // Add constraints
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        if (col.column_default) {
          // Clean up defaults
          let defaultValue = col.column_default;
          if (!defaultValue.includes('::') && !defaultValue.includes('nextval')) {
            colDef += ` DEFAULT ${defaultValue}`;
          } else if (defaultValue.includes('uuid_generate_v4()')) {
            colDef += ' DEFAULT uuid_generate_v4()';
          } else if (defaultValue === 'CURRENT_TIMESTAMP') {
            colDef += ' DEFAULT CURRENT_TIMESTAMP';
          } else if (defaultValue.includes("'") && defaultValue.includes('::')) {
            // Extract value before ::
            const value = defaultValue.split('::')[0];
            colDef += ` DEFAULT ${value}`;
          }
        }
        
        columnDefs.push(colDef);
      }

      schemaSQL += columnDefs.join(',\n');
      schemaSQL += '\n);\n';
    }

    // Get primary keys
    console.log('Getting primary keys...');
    const pkResult = await db.query(`
      SELECT 
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.ordinal_position
    `);

    schemaSQL += '\n-- Primary Keys\n';
    let currentTable = '';
    let pkColumns = [];
    
    for (const pk of pkResult.rows) {
      if (currentTable && currentTable !== pk.table_name) {
        schemaSQL += `ALTER TABLE ${currentTable} ADD PRIMARY KEY (${pkColumns.join(', ')});\n`;
        pkColumns = [];
      }
      currentTable = pk.table_name;
      pkColumns.push(pk.column_name);
    }
    if (pkColumns.length > 0) {
      schemaSQL += `ALTER TABLE ${currentTable} ADD PRIMARY KEY (${pkColumns.join(', ')});\n`;
    }

    // Get foreign keys
    console.log('Getting foreign keys...');
    const fkResult = await db.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `);

    schemaSQL += '\n-- Foreign Keys\n';
    for (const fk of fkResult.rows) {
      schemaSQL += `ALTER TABLE ${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
      schemaSQL += `FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name})`;
      
      // Check for cascade rules
      const cascadeResult = await db.query(`
        SELECT delete_rule, update_rule
        FROM information_schema.referential_constraints
        WHERE constraint_name = $1
      `, [fk.constraint_name]);
      
      if (cascadeResult.rows.length > 0) {
        const rules = cascadeResult.rows[0];
        if (rules.delete_rule !== 'NO ACTION') {
          schemaSQL += ` ON DELETE ${rules.delete_rule}`;
        }
        if (rules.update_rule !== 'NO ACTION') {
          schemaSQL += ` ON UPDATE ${rules.update_rule}`;
        }
      }
      
      schemaSQL += ';\n';
    }

    // Get indexes
    console.log('Getting indexes...');
    const indexResult = await db.query(`
      SELECT
        indexname,
        tablename,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);

    schemaSQL += '\n-- Indexes\n';
    for (const idx of indexResult.rows) {
      schemaSQL += `${idx.indexdef};\n`;
    }

    // Get check constraints
    const checkResult = await db.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
        AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.constraint_type = 'CHECK'
      AND tc.table_schema = 'public'
      AND tc.constraint_name NOT LIKE '%_not_null'
      ORDER BY tc.table_name
    `);

    if (checkResult.rows.length > 0) {
      schemaSQL += '\n-- Check Constraints\n';
      for (const check of checkResult.rows) {
        schemaSQL += `ALTER TABLE ${check.table_name} ADD CONSTRAINT ${check.constraint_name} CHECK ${check.check_clause};\n`;
      }
    }

    // Get unique constraints
    const uniqueResult = await db.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name
      ORDER BY tc.table_name
    `);

    if (uniqueResult.rows.length > 0) {
      schemaSQL += '\n-- Unique Constraints\n';
      for (const uniq of uniqueResult.rows) {
        schemaSQL += `ALTER TABLE ${uniq.table_name} ADD CONSTRAINT ${uniq.constraint_name} UNIQUE (${uniq.columns});\n`;
      }
    }

    // Get triggers and functions
    const triggerResult = await db.query(`
      SELECT 
        event_object_table as table_name,
        trigger_name,
        event_manipulation,
        action_statement,
        action_orientation,
        action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);

    if (triggerResult.rows.length > 0) {
      // First get the trigger function
      const funcResult = await db.query(`
        SELECT 
          routine_name,
          routine_definition
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      `);

      if (funcResult.rows.length > 0) {
        schemaSQL += '\n-- Functions\n';
        for (const func of funcResult.rows) {
          schemaSQL += `CREATE OR REPLACE FUNCTION ${func.routine_name}()\n`;
          schemaSQL += `RETURNS TRIGGER AS $$\n`;
          schemaSQL += func.routine_definition;
          schemaSQL += `\n$$ language 'plpgsql';\n\n`;
        }
      }

      schemaSQL += '\n-- Triggers\n';
      for (const trig of triggerResult.rows) {
        schemaSQL += `CREATE TRIGGER ${trig.trigger_name} `;
        schemaSQL += `${trig.action_timing} ${trig.event_manipulation} `;
        schemaSQL += `ON ${trig.table_name} `;
        schemaSQL += `FOR EACH ${trig.action_orientation} `;
        schemaSQL += `${trig.action_statement};\n`;
      }
    }

    // Add initial data for user_types
    schemaSQL += `\n-- Initial Data\n`;
    schemaSQL += `INSERT INTO user_types (id, name, description, can_login) VALUES 
    (1, 'Admin', 'Full system access', true),
    (2, 'User', 'Regular user access', true),
    (3, 'Subcontractor', 'External contractor', false)
ON CONFLICT (id) DO NOTHING;\n`;

    // Write to file
    const outputPath = path.join(__dirname, '../../database/render_schema_from_local.sql');
    fs.writeFileSync(outputPath, schemaSQL);
    
    console.log(`\nSchema dumped successfully to: ${outputPath}`);
    console.log('\nNext steps:');
    console.log('1. Review the generated file');
    console.log('2. Commit and push to your repository');
    console.log('3. Run the migration script in Render');
    
    process.exit(0);
  } catch (error) {
    console.error('Error dumping schema:', error);
    process.exit(1);
  }
}

dumpLocalSchema();