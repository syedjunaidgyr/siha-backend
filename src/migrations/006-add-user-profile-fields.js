'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'gender', {
      type: Sequelize.ENUM('male', 'female', 'other'),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'height', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Height in cm',
    });

    await queryInterface.addColumn('users', 'weight', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Weight in kg',
    });

    await queryInterface.addColumn('users', 'date_of_birth', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'goal', {
      type: Sequelize.ENUM('weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'general_fitness', 'improve_endurance'),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'profile_complete', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
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

