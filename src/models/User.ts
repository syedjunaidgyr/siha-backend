import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserAttributes {
  id: string;
  email: string;
  mobile: string;
  password_hash: string;
  abha_id?: string;
  abha_number?: string;
  auth_method: 'email' | 'mobile' | 'abha';
  is_verified: boolean;
  gender?: 'male' | 'female' | 'other';
  height?: number; // in cm
  weight?: number; // in kg
  date_of_birth?: Date;
  goal?: 'weight_loss' | 'weight_gain' | 'muscle_gain' | 'maintain' | 'general_fitness' | 'improve_endurance';
  profile_complete: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'created_at' | 'updated_at' | 'is_verified' | 'abha_id' | 'abha_number' | 'gender' | 'height' | 'weight' | 'date_of_birth' | 'goal' | 'profile_complete'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public email!: string;
  public mobile!: string;
  public password_hash!: string;
  public abha_id?: string;
  public abha_number?: string;
  public auth_method!: 'email' | 'mobile' | 'abha';
  public is_verified!: boolean;
  public gender?: 'male' | 'female' | 'other';
  public height?: number;
  public weight?: number;
  public date_of_birth?: Date;
  public goal?: 'weight_loss' | 'weight_gain' | 'muscle_gain' | 'maintain' | 'general_fitness' | 'improve_endurance';
  public profile_complete!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    mobile: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    abha_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    abha_number: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    auth_method: {
      type: DataTypes.ENUM('email', 'mobile', 'abha'),
      allowNull: false,
      defaultValue: 'email',
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true,
    },
    height: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Height in cm',
    },
    weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Weight in kg',
    },
    date_of_birth: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    goal: {
      type: DataTypes.ENUM('weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'general_fitness', 'improve_endurance'),
      allowNull: true,
    },
    profile_complete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default User;

