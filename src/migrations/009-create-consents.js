'use strict';

const { tableExists, indexExists } = require('./_helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await tableExists(queryInterface, 'consents')) {
      console.log('Table "consents" already exists, skipping creation.');
    } else {
      await queryInterface.createTable('consents', {
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
      consent_type: {
        type: Sequelize.ENUM('data_collection', 'data_sharing', 'abha_share', 'provider_access'),
        allowNull: false,
      },
      granted_to: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      scope: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: [],
      },
      abha_consent_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
    if (!(await indexExists(queryInterface, 'consents', 'consents_user_type_active_idx'))) {
      await queryInterface.addIndex('consents', ['user_id', 'consent_type', 'is_active'], {
        name: 'consents_user_type_active_idx',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('consents');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_consents_consent_type";');
  },
};

