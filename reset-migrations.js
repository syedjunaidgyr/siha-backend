#!/usr/bin/env node
/**
 * Script to reset migration state in SequelizeMeta table
 * This allows re-running all migrations from scratch
 * 
 * Usage: node reset-migrations.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbConfig = require('./src/config/database.js');

async function resetMigrations() {
  const env = process.env.NODE_ENV || 'production';
  const config = dbConfig[env];
  
  if (!config) {
    console.error(`No database configuration found for environment: ${env}`);
    process.exit(1);
  }

  const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port,
      dialect: config.dialect,
      logging: console.log,
      dialectOptions: config.dialectOptions || {},
    }
  );

  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Check if SequelizeMeta table exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SequelizeMeta'
      );
    `);

    const tableExists = results[0].exists;

    if (tableExists) {
      // Get current migration state
      const [migrations] = await sequelize.query(
        'SELECT name FROM "SequelizeMeta" ORDER BY name;'
      );
      
      console.log('\nCurrent migration state:');
      if (migrations.length > 0) {
        migrations.forEach(m => console.log(`  - ${m.name}`));
      } else {
        console.log('  (no migrations recorded)');
      }

      // Delete all migration records
      await sequelize.query('DELETE FROM "SequelizeMeta";');
      console.log('\n✓ Cleared SequelizeMeta table.');
      console.log('\nYou can now run: npm run migrate');
    } else {
      console.log('SequelizeMeta table does not exist yet. It will be created when you run migrations.');
    }

    await sequelize.close();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resetMigrations();

