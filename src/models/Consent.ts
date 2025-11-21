import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface ConsentAttributes {
  id: string;
  user_id: string;
  consent_type: 'data_collection' | 'data_sharing' | 'abha_share' | 'provider_access';
  granted_to?: string;
  scope: string[];
  abha_consent_id?: string;
  expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ConsentCreationAttributes extends Optional<ConsentAttributes, 'id' | 'created_at' | 'updated_at' | 'is_active' | 'granted_to' | 'abha_consent_id' | 'expires_at'> {}

class Consent extends Model<ConsentAttributes, ConsentCreationAttributes> implements ConsentAttributes {
  public id!: string;
  public user_id!: string;
  public consent_type!: 'data_collection' | 'data_sharing' | 'abha_share' | 'provider_access';
  public granted_to?: string;
  public scope!: string[];
  public abha_consent_id?: string;
  public expires_at?: Date;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Consent.init(
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
    consent_type: {
      type: DataTypes.ENUM('data_collection', 'data_sharing', 'abha_share', 'provider_access'),
      allowNull: false,
    },
    granted_to: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    scope: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    abha_consent_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: 'consents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id', 'consent_type', 'is_active'],
      },
    ],
  }
);

Consent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export default Consent;

