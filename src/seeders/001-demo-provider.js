'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if provider already exists
    const [providers] = await queryInterface.sequelize.query(
      "SELECT id FROM providers WHERE email = 'demo@hospital.com' LIMIT 1"
    );

    if (providers.length === 0) {
      await queryInterface.bulkInsert('providers', [
        {
          id: randomUUID(),
          name: 'Dr. John Smith',
          hpr_id: 'HPR123456',
          hospital_name: 'City General Hospital',
          specialties: ['Cardiology', 'Internal Medicine'],
          email: 'demo@hospital.com',
          mobile: '+919876543210',
          is_verified: true,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: randomUUID(),
          name: 'Dr. Sarah Johnson',
          hpr_id: 'HPR789012',
          hospital_name: 'Metro Health Center',
          specialties: ['Pediatrics', 'General Practice'],
          email: 'sarah.j@metrohealth.com',
          mobile: '+919876543211',
          is_verified: true,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('providers', {
      email: {
        [Op.in]: ['demo@hospital.com', 'sarah.j@metrohealth.com'],
      },
    }, {});
  },
};

