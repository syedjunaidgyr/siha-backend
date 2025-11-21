import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Provider from './Provider';

interface AppointmentAttributes {
  id: string;
  user_id: string;
  provider_id: string;
  appointment_time: Date;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface AppointmentCreationAttributes extends Optional<AppointmentAttributes, 'id' | 'created_at' | 'updated_at' | 'status' | 'notes'> {}

class Appointment extends Model<AppointmentAttributes, AppointmentCreationAttributes> implements AppointmentAttributes {
  public id!: string;
  public user_id!: string;
  public provider_id!: string;
  public appointment_time!: Date;
  public status!: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Appointment.init(
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
    provider_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Provider,
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },
    appointment_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'),
      allowNull: false,
      defaultValue: 'scheduled',
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
    tableName: 'appointments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id', 'appointment_time'],
      },
      {
        fields: ['provider_id', 'appointment_time'],
      },
    ],
  }
);

Appointment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Appointment.belongsTo(Provider, { foreignKey: 'provider_id', as: 'provider' });

export default Appointment;

