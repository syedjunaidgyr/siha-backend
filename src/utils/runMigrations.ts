import { Sequelize } from 'sequelize';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Run all pending migrations programmatically
 */
export async function runMigrations(sequelize: Sequelize): Promise<void> {
  // Use process.cwd() as base - works in both dev (tsx) and production (compiled)
  const basePath = process.cwd();
  
  // Try different possible paths for migrations directory
  const possiblePaths = [
    join(basePath, 'src', 'migrations'),      // Development (tsx from project root)
    join(basePath, 'dist', 'migrations'),     // Production (compiled)
    join(basePath, 'migrations'),             // Alternative location
  ];
  
  let migrationsPath: string | null = null;
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      migrationsPath = path;
      break;
    }
  }
  
  if (!migrationsPath) {
    // Default fallback
    migrationsPath = join(basePath, 'src', 'migrations');
    console.warn(`Migrations directory not found, using default: ${migrationsPath}`);
  }
  
  console.log(`Using migrations path: ${migrationsPath}`);
  const queryInterface = sequelize.getQueryInterface();
  const SequelizeStatic = sequelize.constructor as typeof Sequelize;

  try {
    // Ensure SequelizeMeta table exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SequelizeMeta'
      );
    `);

    const metaTableExists = (results as any[])[0]?.exists;

    if (!metaTableExists) {
      // Create SequelizeMeta table
      await sequelize.query(`
        CREATE TABLE "SequelizeMeta" (
          name VARCHAR(255) NOT NULL PRIMARY KEY
        );
      `);
      console.log('Created SequelizeMeta table.');
    }

    // Get list of already executed migrations
    const [executedMigrations] = await sequelize.query(
      'SELECT name FROM "SequelizeMeta" ORDER BY name;'
    ) as any[];
    const executedNames = new Set(executedMigrations.map((m: { name: string }) => m.name));

    // Read all migration files
    const files = await readdir(migrationsPath);
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files.`);

    if (migrationFiles.length === 0) {
      console.log('No migration files found.');
      return;
    }

    // Execute pending migrations
    let pendingCount = 0;
    for (const file of migrationFiles) {
      if (executedNames.has(file)) {
        continue; // Skip already executed migrations
      }

      pendingCount++;
      console.log(`Running migration: ${file}...`);
      
      try {
        // Load migration file (CommonJS format)
        const migrationPath = join(migrationsPath, file);
        // Use require for CommonJS migrations
        const migration = require(migrationPath);
        const migrationModule = migration.default || migration;
        
        // Execute the migration
        if (typeof migrationModule.up === 'function') {
          await migrationModule.up(queryInterface, SequelizeStatic);
        } else if (typeof migrationModule === 'function') {
          // Some migrations export a function directly
          await migrationModule(queryInterface, SequelizeStatic);
        } else {
          throw new Error(`Invalid migration format: ${file}`);
        }

        // Record migration as executed
        await sequelize.query(`INSERT INTO "SequelizeMeta" (name) VALUES ('${file.replace(/'/g, "''")}');`);
        console.log(`✓ Migration ${file} completed successfully.`);
      } catch (error: any) {
        console.error(`✗ Migration ${file} failed:`, error.message);
        console.error(error);
        throw error;
      }
    }

    if (pendingCount === 0) {
      console.log('✓ All migrations are already up to date.');
    } else {
      console.log(`✓ Successfully ran ${pendingCount} migration(s).`);
    }
  } catch (error: any) {
    console.error('Error running migrations:', error.message);
    throw error;
  }
}


