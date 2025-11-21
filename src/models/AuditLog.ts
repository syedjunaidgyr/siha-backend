import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AuditLogAttributes {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: object;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

interface AuditLogCreationAttributes extends Optional<AuditLogAttributes, 'id' | 'created_at' | 'user_id' | 'resource_id' | 'details' | 'ip_address' | 'user_agent'> {}

class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  public id!: string;
  public user_id?: string;
  public action!: string;
  public resource_type!: string;
  public resource_id?: string;
  public details?: object;
  public ip_address?: string;
  public user_agent?: string;
  public readonly created_at!: Date;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resource_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resource_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    timestamps: false,
    indexes: [
      {
        fields: ['user_id', 'created_at'],
      },
      {
        fields: ['resource_type', 'resource_id'],
      },
      {
        fields: ['created_at'],
      },
    ],
  }
);

export default AuditLog;

