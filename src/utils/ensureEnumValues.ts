import { Sequelize } from 'sequelize';

/**
 * Ensure all required ENUM values exist in the metric_records metric_type ENUM
 * This is a safety check in case migrations were marked as executed but didn't actually run
 */
export async function ensureMetricTypeEnumValues(sequelize: Sequelize): Promise<void> {
  try {
    // Find the ENUM type name
    const [results] = await sequelize.query(`
      SELECT t.typname 
      FROM pg_type t 
      JOIN pg_attribute a ON a.atttypid = t.oid 
      JOIN pg_class c ON a.attrelid = c.oid 
      WHERE c.relname = 'metric_records' 
      AND a.attname = 'metric_type' 
      AND t.typtype = 'e';
    `);

    if (!results || (results as any[]).length === 0) {
      console.warn('[ensureEnumValues] ENUM type not found for metric_records.metric_type');
      return;
    }

    const enumTypeName = (results as any[])[0].typname;
    console.log(`[ensureEnumValues] Found ENUM type: ${enumTypeName}`);

    // All required ENUM values (from migrations 002a, 003, 004, 005)
    const requiredValues = [
      // Base values (002a)
      'steps',
      'heart_rate',
      'sleep',
      'blood_pressure',
      'blood_glucose',
      'weight',
      'calories',
      'distance',
      'active_minutes',
      'other',
      // Added in 003
      'stress_level',
      'oxygen_saturation',
      'respiratory_rate',
      // Added in 004
      'blood_pressure_systolic',
      'blood_pressure_diastolic',
      // Added in 005
      'temperature',
    ];

    // Check which values exist
    const [existingEnumValues] = await sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}')
      ORDER BY enumsortorder;
    `);

    const existingLabels = new Set((existingEnumValues as any[]).map((v: any) => v.enumlabel));
    console.log(`[ensureEnumValues] Existing ENUM values: ${Array.from(existingLabels).join(', ')}`);

    // Add missing values
    const missingValues = requiredValues.filter(val => !existingLabels.has(val));

    if (missingValues.length === 0) {
      console.log('[ensureEnumValues] ✓ All required ENUM values already exist');
      return;
    }

    console.log(`[ensureEnumValues] Missing ENUM values: ${missingValues.join(', ')}`);
    console.log(`[ensureEnumValues] Adding ${missingValues.length} missing ENUM value(s)...`);

    for (const value of missingValues) {
      try {
        // Check if it exists first (double-check to avoid race conditions)
        const [check] = await sequelize.query(`
          SELECT 1 
          FROM pg_enum 
          WHERE enumlabel = '${value}' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}');
        `);

        if (!check || (check as any[]).length === 0) {
          // PostgreSQL doesn't support IF NOT EXISTS with ADD VALUE, so we check first
          await sequelize.query(`
            ALTER TYPE "${enumTypeName}" ADD VALUE '${value}';
          `);
          console.log(`[ensureEnumValues] ✓ Added ENUM value: ${value}`);
        } else {
          console.log(`[ensureEnumValues] ENUM value already exists: ${value}`);
        }
      } catch (error: any) {
        // If the error is "already exists", that's okay - it might have been added by another process
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`[ensureEnumValues] ENUM value already exists: ${value}`);
        } else {
          console.error(`[ensureEnumValues] ✗ Failed to add ENUM value ${value}:`, error.message);
          // Don't throw - continue with other values
        }
      }
    }

    console.log('[ensureEnumValues] ✓ ENUM value check complete');
  } catch (error: any) {
    console.error('[ensureEnumValues] Error ensuring ENUM values:', error.message);
    // Don't throw - this is a safety check, migrations should handle it
  }
}

