'use strict';

const { columnExists } = require('../utils/migration-helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add name column if it doesn't exist
    if (!(await columnExists(queryInterface, 'users', 'name'))) {
      await queryInterface.addColumn('users', 'name', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'User full name',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'name');
  },
};

