'use strict';

const { tableExists, indexExists } = require('./_helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'appointments')) {
      console.log('Table "appointments" already exists, skipping creation.');
    } else {
      await queryInterface.createTable('appointments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      provider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'providers',
          key: 'id',
        },
        onDelete: 'RESTRICT',
      },
      appointment_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'),
        allowNull: false,
        defaultValue: 'scheduled',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      });
    }

    // Add indexes if they don't exist
    if (!(await indexExists(queryInterface, 'appointments', 'appointments_user_time_idx'))) {
      await queryInterface.addIndex('appointments', ['user_id', 'appointment_time'], {
        name: 'appointments_user_time_idx',
      });
    }

    if (!(await indexExists(queryInterface, 'appointments', 'appointments_provider_time_idx'))) {
      await queryInterface.addIndex('appointments', ['provider_id', 'appointment_time'], {
        name: 'appointments_provider_time_idx',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('appointments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_appointments_status";');
  },
};

