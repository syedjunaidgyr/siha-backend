'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('lifestyle_predictions', {
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
      prediction_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      predicted_calories: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Daily calorie target',
      },
      predicted_protein: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        comment: 'Daily protein target in grams',
      },
      predicted_carbs: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        comment: 'Daily carbs target in grams',
      },
      predicted_fats: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        comment: 'Daily fats target in grams',
      },
      recommended_workout_duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Recommended workout duration in minutes',
      },
      recommended_workout_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Type of workout recommended',
      },
      recommended_steps: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Recommended daily steps',
      },
      sleep_hours: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: false,
        comment: 'Recommended sleep hours',
      },
      water_intake_liters: {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: false,
        comment: 'Recommended water intake in liters',
      },
      lifestyle_score: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Overall lifestyle health score (0-100)',
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

    await queryInterface.addIndex('lifestyle_predictions', ['user_id', 'prediction_date'], {
      unique: true,
      name: 'unique_user_prediction_date',
    });

    await queryInterface.addIndex('lifestyle_predictions', ['user_id'], {
      name: 'idx_lifestyle_predictions_user_id',
    });

    await queryInterface.addIndex('lifestyle_predictions', ['prediction_date'], {
      name: 'idx_lifestyle_predictions_date',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('lifestyle_predictions');
  },
};

