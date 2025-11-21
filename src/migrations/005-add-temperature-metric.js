'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
      const newValue = 'temperature';

      const [existing] = await queryInterface.sequelize.query(`
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = '${newValue}' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}');
      `);

      if (!existing || existing.length === 0) {
        await queryInterface.sequelize.query(`
          ALTER TYPE "${enumTypeName}" ADD VALUE '${newValue}';
        `);
      }
    } else {
      console.warn('Metric type ENUM not found. Please verify schema before rerunning migration.');
    }
  },

  async down(queryInterface, Sequelize) {
    console.warn('Rollback for temperature enum value is not supported automatically.');
    console.warn('Manual steps required to remove the value if needed.');
  }
};

