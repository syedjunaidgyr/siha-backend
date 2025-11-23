'use strict';

const { columnExists } = require('../utils/migration-helpers');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add BMI column if it doesn't exist
    const bmiExists = await columnExists(queryInterface, 'lifestyle_predictions', 'bmi');
    if (!bmiExists) {
      await queryInterface.addColumn('lifestyle_predictions', 'bmi', {
        type: Sequelize.DECIMAL(4, 1),
        allowNull: true,
        comment: 'Body Mass Index',
      });
    }

    // Add BMI category column if it doesn't exist
    const bmiCategoryExists = await columnExists(queryInterface, 'lifestyle_predictions', 'bmi_category');
    if (!bmiCategoryExists) {
      await queryInterface.addColumn('lifestyle_predictions', 'bmi_category', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'BMI category: underweight, normal, overweight, obese',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove BMI columns
    const bmiExists = await columnExists(queryInterface, 'lifestyle_predictions', 'bmi');
    if (bmiExists) {
      await queryInterface.removeColumn('lifestyle_predictions', 'bmi');
    }

    const bmiCategoryExists = await columnExists(queryInterface, 'lifestyle_predictions', 'bmi_category');
    if (bmiCategoryExists) {
      await queryInterface.removeColumn('lifestyle_predictions', 'bmi_category');
    }
  },
};

