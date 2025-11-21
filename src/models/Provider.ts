import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProviderAttributes {
  id: string;
  name: string;
  hpr_id?: string;
  hospital_id?: string;
  hospital_name?: string;
  specialties: string[];
  email?: string;
  mobile?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ProviderCreationAttributes extends Optional<ProviderAttributes, 'id' | 'created_at' | 'updated_at' | 'is_verified' | 'is_active' | 'hpr_id' | 'hospital_id' | 'hospital_name' | 'email' | 'mobile'> {}

class Provider extends Model<ProviderAttributes, ProviderCreationAttributes> implements ProviderAttributes {
  public id!: string;
  public name!: string;
  public hpr_id?: string;
  public hospital_id?: string;
  public hospital_name?: string;
  public specialties!: string[];
  public email?: string;
  public mobile?: string;
  public is_verified!: boolean;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Provider.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    hpr_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    hospital_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hospital_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    specialties: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    mobile: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'providers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Provider;

