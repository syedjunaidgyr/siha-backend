import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface DeviceAttributes {
  id: string;
  user_id: string;
  vendor: 'healthkit' | 'health_connect' | 'fitbit' | 'garmin' | 'samsung' | 'other';
  device_id: string;
  device_name?: string;
  oauth_access_token?: string;
  oauth_refresh_token?: string;
  oauth_token_expires_at?: Date;
  last_sync: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DeviceCreationAttributes extends Optional<DeviceAttributes, 'id' | 'created_at' | 'updated_at' | 'last_sync' | 'is_active' | 'device_name' | 'oauth_access_token' | 'oauth_refresh_token' | 'oauth_token_expires_at'> {}

class Device extends Model<DeviceAttributes, DeviceCreationAttributes> implements DeviceAttributes {
  public id!: string;
  public user_id!: string;
  public vendor!: 'healthkit' | 'health_connect' | 'fitbit' | 'garmin' | 'samsung' | 'other';
  public device_id!: string;
  public device_name?: string;
  public oauth_access_token?: string;
  public oauth_refresh_token?: string;
  public oauth_token_expires_at?: Date;
  public last_sync!: Date;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Device.init(
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
    vendor: {
      type: DataTypes.ENUM('healthkit', 'health_connect', 'fitbit', 'garmin', 'samsung', 'other'),
      allowNull: false,
    },
    device_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    device_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    oauth_access_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    oauth_refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    oauth_token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_sync: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: 'devices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'vendor', 'device_id'],
      },
    ],
  }
);

Device.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export default Device;

