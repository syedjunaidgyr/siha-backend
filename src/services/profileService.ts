import User from '../models/User';

export interface ProfileUpdateData {
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  date_of_birth?: Date;
  goal?: 'weight_loss' | 'weight_gain' | 'muscle_gain' | 'maintain' | 'general_fitness' | 'improve_endurance';
}

export class ProfileService {
  static async updateProfile(userId: string, data: ProfileUpdateData) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update profile fields
    if (data.gender !== undefined) user.gender = data.gender;
    if (data.height !== undefined) user.height = data.height;
    if (data.weight !== undefined) user.weight = data.weight;
    if (data.date_of_birth !== undefined) user.date_of_birth = data.date_of_birth;
    if (data.goal !== undefined) user.goal = data.goal;

    // Check if profile is complete
    const isComplete = !!(
      user.gender &&
      user.height &&
      user.weight &&
      user.date_of_birth &&
      user.goal
    );
    user.profile_complete = isComplete;

    await user.save();

    return {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      gender: user.gender,
      height: user.height,
      weight: user.weight,
      date_of_birth: user.date_of_birth,
      goal: user.goal,
      profile_complete: user.profile_complete,
    };
  }

  static async getProfile(userId: string) {
    const user = await User.findByPk(userId, {
      attributes: [
        'id',
        'email',
        'mobile',
        'gender',
        'height',
        'weight',
        'date_of_birth',
        'goal',
        'profile_complete',
        'created_at',
        'updated_at',
      ],
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  static async isProfileComplete(userId: string): Promise<boolean> {
    const user = await User.findByPk(userId);
    if (!user) {
      return false;
    }
    return user.profile_complete || false;
  }
}

