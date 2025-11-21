'use strict';

const { tableExists, indexExists } = require('../utils/migration-helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'metric_records')) {
      console.log('Table "metric_records" already exists, skipping creation.');
    } else {
      // Create the metric_records table with base ENUM values
      // Additional ENUM values will be added in subsequent migrations (003, 004, 005)
      await queryInterface.createTable('metric_records', {
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
      device_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'devices',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      metric_type: {
        type: Sequelize.ENUM(
          'steps',
          'heart_rate',
          'sleep',
          'blood_pressure',
          'blood_glucose',
          'weight',
          'calories',
          'distance',
          'active_minutes',
          'other'
        ),
        allowNull: false,
      },
      value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      unit: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      source: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      raw_payload: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      confidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      });
    }

    // Add indexes if they don't exist
    if (!(await indexExists(queryInterface, 'metric_records', 'metric_records_user_metric_time_idx'))) {
      await queryInterface.addIndex('metric_records', ['user_id', 'metric_type', 'start_time'], {
        name: 'metric_records_user_metric_time_idx',
      });
    }

    if (!(await indexExists(queryInterface, 'metric_records', 'metric_records_start_time_idx'))) {
      await queryInterface.addIndex('metric_records', ['start_time'], {
        name: 'metric_records_start_time_idx',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('metric_records');
    // Drop the ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_metric_records_metric_type";');
  },
};

