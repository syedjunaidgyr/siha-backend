import User from './User';
import Device from './Device';
import MetricRecord from './MetricRecord';
import Consent from './Consent';
import Provider from './Provider';
import Appointment from './Appointment';
import AuditLog from './AuditLog';
import LifestylePrediction from './LifestylePrediction';

// Define associations
User.hasMany(Device, { foreignKey: 'user_id', as: 'devices' });
User.hasMany(MetricRecord, { foreignKey: 'user_id', as: 'metrics' });
User.hasMany(Consent, { foreignKey: 'user_id', as: 'consents' });
User.hasMany(Appointment, { foreignKey: 'user_id', as: 'appointments' });
User.hasMany(LifestylePrediction, { foreignKey: 'user_id', as: 'lifestyle_predictions' });

Device.hasMany(MetricRecord, { foreignKey: 'device_id', as: 'metrics' });

Provider.hasMany(Appointment, { foreignKey: 'provider_id', as: 'appointments' });

export {
  User,
  Device,
  MetricRecord,
  Consent,
  Provider,
  Appointment,
  AuditLog,
  LifestylePrediction,
};

