import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Device from './Device';

type MetricType =
  | 'steps'
  | 'heart_rate'
  | 'sleep'
  | 'blood_pressure'
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'blood_glucose'
  | 'weight'
  | 'calories'
  | 'distance'
  | 'active_minutes'
  | 'stress_level'
  | 'oxygen_saturation'
  | 'respiratory_rate'
  | 'temperature'
  | 'other';

interface MetricRecordAttributes {
  id: string;
  user_id: string;
  device_id?: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  start_time: Date;
  end_time?: Date;
  source: string;
  raw_payload?: object;
  confidence?: number;
  created_at: Date;
}

interface MetricRecordCreationAttributes extends Optional<MetricRecordAttributes, 'id' | 'created_at' | 'device_id' | 'end_time' | 'raw_payload' | 'confidence'> {}

class MetricRecord extends Model<MetricRecordAttributes, MetricRecordCreationAttributes> implements MetricRecordAttributes {
  public id!: string;
  public user_id!: string;
  public device_id?: string;
  public metric_type!: MetricType;
  public value!: number;
  public unit!: string;
  public start_time!: Date;
  public end_time?: Date;
  public source!: string;
  public raw_payload?: object;
  public confidence?: number;
  public readonly created_at!: Date;
}

MetricRecord.init(
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
        model: User,
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    device_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Device,
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    metric_type: {
      type: DataTypes.ENUM(
        'steps',
        'heart_rate',
        'sleep',
        'blood_pressure',
        'blood_pressure_systolic',
        'blood_pressure_diastolic',
        'blood_glucose',
        'weight',
        'calories',
        'distance',
        'active_minutes',
        'stress_level',
        'oxygen_saturation',
        'respiratory_rate',
        'temperature',
        'other'
      ),
      allowNull: false,
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    raw_payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    confidence: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 1,
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'metric_records',
    timestamps: false,
    indexes: [
      {
        fields: ['user_id', 'metric_type', 'start_time'],
      },
      {
        fields: ['start_time'],
      },
    ],
  }
);

MetricRecord.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
MetricRecord.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

export default MetricRecord;

