'use strict';

const { tableExists, indexExists } = require('./_helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'audit_logs')) {
      console.log('Table "audit_logs" already exists, skipping creation.');
    } else {
      await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      resource_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      resource_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      details: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
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
    if (!(await indexExists(queryInterface, 'audit_logs', 'audit_logs_user_created_idx'))) {
      await queryInterface.addIndex('audit_logs', ['user_id', 'created_at'], {
        name: 'audit_logs_user_created_idx',
      });
    }

    if (!(await indexExists(queryInterface, 'audit_logs', 'audit_logs_resource_idx'))) {
      await queryInterface.addIndex('audit_logs', ['resource_type', 'resource_id'], {
        name: 'audit_logs_resource_idx',
      });
    }

    if (!(await indexExists(queryInterface, 'audit_logs', 'audit_logs_created_idx'))) {
      await queryInterface.addIndex('audit_logs', ['created_at'], {
        name: 'audit_logs_created_idx',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('audit_logs');
  },
};

