import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import User from '../models/User';

export class AuthService {
  static async register(email: string, mobile: string, password: string) {
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { mobile }],
      },
    });

    if (existingUser) {
      throw new Error('User with this email or mobile already exists');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      mobile,
      password_hash,
      auth_method: 'email',
      is_verified: true, // Auto-verify for now
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      token,
      user: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
        abha_id: user.abha_id,
        abha_number: user.abha_number,
      },
    };
  }

  static async login(email: string, password: string) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Allow login even if not verified for now (can add email verification later)
    // if (!user.is_verified) {
    //   throw new Error('Account not verified');
    // }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        mobile: user.mobile,
        abha_id: user.abha_id,
        abha_number: user.abha_number,
      },
    };
  }

  static async linkABHA(userId: string, abhaId: string, abhaNumber: string) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const existingABHA = await User.findOne({
      where: { abha_id: abhaId },
    });

    if (existingABHA && existingABHA.id !== userId) {
      throw new Error('ABHA ID already linked to another account');
    }

    user.abha_id = abhaId;
    user.abha_number = abhaNumber;
    await user.save();

    return {
      id: user.id,
      abha_id: user.abha_id,
      abha_number: user.abha_number,
    };
  }
}

