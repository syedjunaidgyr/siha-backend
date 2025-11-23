import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface LifestylePredictionAttributes {
  id: string;
  user_id: string;
  prediction_date: Date;
  predicted_calories: number;
  predicted_protein: number;
  predicted_carbs: number;
  predicted_fats: number;
  recommended_workout_duration: number; // in minutes
  recommended_workout_type: string;
  recommended_steps: number;
  sleep_hours: number;
  water_intake_liters: number;
  lifestyle_score: number; // 0-100
  bmi?: number;
  bmi_category?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface LifestylePredictionCreationAttributes extends Optional<LifestylePredictionAttributes, 'id' | 'created_at' | 'updated_at' | 'notes'> {}

class LifestylePrediction extends Model<LifestylePredictionAttributes, LifestylePredictionCreationAttributes> implements LifestylePredictionAttributes {
  public id!: string;
  public user_id!: string;
  public prediction_date!: Date;
  public predicted_calories!: number;
  public predicted_protein!: number;
  public predicted_carbs!: number;
  public predicted_fats!: number;
  public recommended_workout_duration!: number;
  public recommended_workout_type!: string;
  public recommended_steps!: number;
  public sleep_hours!: number;
  public water_intake_liters!: number;
  public lifestyle_score!: number;
  public bmi?: number;
  public bmi_category?: string;
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

LifestylePrediction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    prediction_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    predicted_calories: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Daily calorie target',
    },
    predicted_protein: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: 'Daily protein target in grams',
    },
    predicted_carbs: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: 'Daily carbs target in grams',
    },
    predicted_fats: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      comment: 'Daily fats target in grams',
    },
    recommended_workout_duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Recommended workout duration in minutes',
    },
    recommended_workout_type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Type of workout recommended',
    },
    recommended_steps: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Recommended daily steps',
    },
    sleep_hours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      comment: 'Recommended sleep hours',
    },
    water_intake_liters: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      comment: 'Recommended water intake in liters',
    },
    lifestyle_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Overall lifestyle health score',
    },
    bmi: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: true,
      comment: 'Body Mass Index',
    },
    bmi_category: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'BMI category: underweight, normal, overweight, obese',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'lifestyle_predictions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id', 'prediction_date'],
        unique: true,
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['prediction_date'],
      },
    ],
  }
);

export default LifestylePrediction;

