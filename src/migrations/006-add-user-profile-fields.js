'use strict';

const { columnExists } = require('../utils/migration-helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add columns only if they don't exist
    if (!(await columnExists(queryInterface, 'users', 'gender'))) {
      await queryInterface.addColumn('users', 'gender', {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'users', 'height'))) {
      await queryInterface.addColumn('users', 'height', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Height in cm',
      });
    }

    if (!(await columnExists(queryInterface, 'users', 'weight'))) {
      await queryInterface.addColumn('users', 'weight', {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Weight in kg',
      });
    }

    if (!(await columnExists(queryInterface, 'users', 'date_of_birth'))) {
      await queryInterface.addColumn('users', 'date_of_birth', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'users', 'goal'))) {
      await queryInterface.addColumn('users', 'goal', {
        type: Sequelize.ENUM('weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'general_fitness', 'improve_endurance'),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'users', 'profile_complete'))) {
      await queryInterface.addColumn('users', 'profile_complete', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'gender');
    await queryInterface.removeColumn('users', 'height');
    await queryInterface.removeColumn('users', 'weight');
    await queryInterface.removeColumn('users', 'date_of_birth');
    await queryInterface.removeColumn('users', 'goal');
    await queryInterface.removeColumn('users', 'profile_complete');
  },
};

