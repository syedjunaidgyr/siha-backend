'use strict';

/**
 * Helper functions for idempotent migrations
 */
async function tableExists(queryInterface, tableName) {
  const [results] = await queryInterface.sequelize.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = '${tableName}'
    );
  `);
  return results[0].exists;
}

async function indexExists(queryInterface, tableName, indexName) {
  const [results] = await queryInterface.sequelize.query(`
    SELECT EXISTS (
      SELECT 1 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = '${tableName}' 
      AND indexname = '${indexName}'
    );
  `);
  return results[0].exists;
}

module.exports = {
  tableExists,
  indexExists,
};

