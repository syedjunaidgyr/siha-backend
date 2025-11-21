import Device from '../models/Device';
import { Op } from 'sequelize';

export class DeviceService {
  static async linkDevice(
    userId: string,
    vendor: string,
    deviceId: string,
    deviceName?: string,
    oauthTokens?: {
      access_token?: string;
      refresh_token?: string;
      expires_at?: Date;
    }
  ) {
    const [device, created] = await Device.findOrCreate({
      where: {
        user_id: userId,
        vendor: vendor as any,
        device_id: deviceId,
      },
      defaults: {
        user_id: userId,
        vendor: vendor as any,
        device_id: deviceId,
        device_name: deviceName,
        oauth_access_token: oauthTokens?.access_token,
        oauth_refresh_token: oauthTokens?.refresh_token,
        oauth_token_expires_at: oauthTokens?.expires_at,
        is_active: true,
        last_sync: new Date(),
      },
    });

    if (!created) {
      device.device_name = deviceName || device.device_name;
      device.oauth_access_token = oauthTokens?.access_token || device.oauth_access_token;
      device.oauth_refresh_token = oauthTokens?.refresh_token || device.oauth_refresh_token;
      device.oauth_token_expires_at = oauthTokens?.expires_at || device.oauth_token_expires_at;
      device.is_active = true;
      device.last_sync = new Date();
      await device.save();
    }

    return device;
  }

  static async getUserDevices(userId: string) {
    return await Device.findAll({
      where: {
        user_id: userId,
        is_active: true,
      },
      order: [['last_sync', 'DESC']],
    });
  }

  static async updateLastSync(deviceId: string, userId: string) {
    const device = await Device.findOne({
      where: {
        id: deviceId,
        user_id: userId,
        is_active: true,
      },
    });
    
    if (device) {
      device.last_sync = new Date();
      await device.save();
    }
    return device;
  }

  static async deactivateDevice(deviceId: string, userId: string) {
    const device = await Device.findOne({
      where: {
        id: deviceId,
        user_id: userId,
      },
    });

    if (!device) {
      throw new Error('Device not found');
    }

    device.is_active = false;
    await device.save();
    return device;
  }
}

