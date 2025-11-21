'use strict';

const { tableExists, indexExists } = require('./_helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'devices')) {
      console.log('Table "devices" already exists, skipping creation.');
    } else {
      await queryInterface.createTable('devices', {
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
      vendor: {
        type: Sequelize.ENUM('healthkit', 'health_connect', 'fitbit', 'garmin', 'samsung', 'other'),
        allowNull: false,
      },
      device_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      device_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      oauth_access_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      oauth_refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      oauth_token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_sync: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    // Add index if it doesn't exist
    if (!(await indexExists(queryInterface, 'devices', 'devices_user_vendor_device_unique'))) {
      await queryInterface.addIndex('devices', ['user_id', 'vendor', 'device_id'], {
        unique: true,
        name: 'devices_user_vendor_device_unique',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('devices');
  },
};

