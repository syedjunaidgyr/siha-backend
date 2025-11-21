'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // For PostgreSQL: Add new values to the existing ENUM type
    // First, find the ENUM type name (Sequelize creates it as enum_<table>_<column>)
    const [results] = await queryInterface.sequelize.query(`
      SELECT t.typname 
      FROM pg_type t 
      JOIN pg_attribute a ON a.atttypid = t.oid 
      JOIN pg_class c ON a.attrelid = c.oid 
      WHERE c.relname = 'metric_records' 
      AND a.attname = 'metric_type' 
      AND t.typtype = 'e';
    `);

    if (results && results.length > 0) {
      const enumTypeName = results[0].typname;
      
      // Add new ENUM values (must be done in separate statements for PostgreSQL)
      // Note: ALTER TYPE ... ADD VALUE cannot be rolled back in a transaction
      const newValues = ['stress_level', 'oxygen_saturation', 'respiratory_rate'];
      
      for (const value of newValues) {
        // Check if value already exists before adding
        const [existing] = await queryInterface.sequelize.query(`
          SELECT 1 
          FROM pg_enum 
          WHERE enumlabel = '${value}' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}');
        `);
        
        if (!existing || existing.length === 0) {
          await queryInterface.sequelize.query(`
            ALTER TYPE "${enumTypeName}" ADD VALUE '${value}';
          `);
        }
      }
    } else {
      // Fallback: If ENUM type not found, the column might be using a different type
      // In this case, we'll need to recreate it (more complex migration)
      console.warn('ENUM type not found. Column may need manual migration.');
    }
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL does not support removing ENUM values directly
    // To rollback, you would need to:
    // 1. Create a new ENUM type without the new values
    // 2. Alter the column to use the new type
    // 3. Drop the old type
    // This is complex and may cause data loss, so we'll just log a warning
    
    console.warn('Rollback of ENUM values is not supported in PostgreSQL.');
    console.warn('Manual intervention required to remove: stress_level, oxygen_saturation, respiratory_rate');
    
    // If you really need to rollback, you would do something like:
    // 1. Check if any records use the new values
    // 2. Update or delete those records
    // 3. Create new ENUM type
    // 4. Alter column
    // 5. Drop old type
  }
};

