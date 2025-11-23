import LifestylePrediction from '../models/LifestylePrediction';
import User from '../models/User';
import { PreventiveHealthService } from './preventiveHealthService';

export interface LifestylePredictionData {
  predicted_calories: number;
  predicted_protein: number;
  predicted_carbs: number;
  predicted_fats: number;
  recommended_workout_duration: number;
  recommended_workout_type: string;
  recommended_steps: number;
  sleep_hours: number;
  water_intake_liters: number;
  lifestyle_score: number;
  notes?: string;
}

export class LifestylePredictionService {
  /**
   * Generate lifestyle prediction using AI preventive health service
   * Falls back to profile-based defaults if no metrics are available
   */
  static async generatePrediction(userId: string, date: Date = new Date()): Promise<LifestylePredictionData> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.profile_complete) {
      throw new Error('User profile is not complete');
    }

    const userProfile = PreventiveHealthService.buildUserProfilePayload(user);

    // Always get AI insights - no fallback to hardcoded defaults
    // AI service will generate recommendations based on user profile even without metrics
    let insights;
    try {
      insights = await PreventiveHealthService.getInsights(userId, {
        lookbackDays: 14,
        userProfile,
      });
    } catch (error: any) {
      // Re-throw error - don't fall back to hardcoded defaults
      console.error(`[LifestylePredictionService] Failed to get AI insights for user ${userId}:`, error);
      throw new Error(`Failed to generate AI lifestyle predictions: ${error.message}`);
    }

    const lifestyleCard = insights?.lifestyleCard;
    if (!lifestyleCard) {
      // AI service should always return a lifestyle card
      console.error(`[LifestylePredictionService] AI service did not return lifestyle card for user ${userId}`);
      throw new Error('AI service did not return lifestyle recommendations. Please try again.');
    }

    const lifestylePlan = insights?.lifestylePlan;

    const predictedCalories = this.toNumber(lifestyleCard.calorieTarget, 0);
    const predictedProtein = this.toNumber(lifestyleCard.proteinTarget, 0);
    const predictedCarbs = this.toNumber(lifestyleCard.carbTarget, 0);
    const predictedFats = this.toNumber(lifestyleCard.fatTarget, 0);
    const workoutDuration = this.toNumber(lifestyleCard.workoutDuration, 0);
    const steps = this.toNumber(lifestyleCard.stepTarget, 0);
    const waterLiters = this.toNumber(
      lifestyleCard.waterIntakeLiters,
      lifestylePlan?.hydrationTargetMl ? Number(lifestylePlan.hydrationTargetMl) / 1000 : 2.5
    );
    const sleepHours = this.toNumber(
      lifestyleCard.sleepHours,
      lifestylePlan?.sleepTargetHours ?? 7.5
    );

    return {
      predicted_calories: Math.round(predictedCalories),
      predicted_protein: Math.round(predictedProtein),
      predicted_carbs: Math.round(predictedCarbs),
      predicted_fats: Math.round(predictedFats),
      recommended_workout_duration: Math.round(workoutDuration),
      recommended_workout_type: lifestyleCard.workoutType || 'AI Recommended Workout',
      recommended_steps: Math.round(steps),
      sleep_hours: Number(sleepHours.toFixed(1)),
      water_intake_liters: Number(waterLiters.toFixed(2)),
      lifestyle_score: Math.min(100, Math.max(0, Number(lifestyleCard.score))),
      bmi: lifestyleCard.bmi ? Number(lifestyleCard.bmi) : undefined,
      bmi_category: lifestyleCard.bmiCategory || undefined,
      notes: lifestyleCard.notes || lifestylePlan?.morning?.[0] || insights?.summary?.nextBestAction,
    };
  }

  /**
   * Generate default lifestyle prediction based on user profile only
   * Uses BMR/TDEE calculations similar to the AI service
   * @deprecated This method should not be used - all predictions must come from AI service
   */
  private static generateDefaultPrediction(user: User): LifestylePredictionData {
    const gender = (user.gender || 'other').toLowerCase();
    const weight = user.weight ? Number(user.weight) : 70.0;
    const height = user.height ? Number(user.height) : 170.0;
    const goal = (user.goal || 'general_fitness').toLowerCase();

    // Calculate age
    let age = 30; // default
    if (user.date_of_birth) {
      const diffMs = Date.now() - user.date_of_birth.getTime();
      const ageDate = new Date(diffMs);
      age = Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    // Calculate BMR using Mifflin-St Jeor Equation
    const heightM = Math.max(height / 100.0, 1.0);
    let bmr: number;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Calculate TDEE (Total Daily Energy Expenditure)
    const activityMultiplier = 1.55; // Moderately active
    let tdee = bmr * activityMultiplier;

    // Adjust calories based on goal
    let calories = tdee;
    let workoutDuration = 30;
    let workoutType = 'General Exercise';
    let steps = 8000;
    let lifestyleScore = 75;
    let notes = 'Based on your profile. Start tracking metrics for personalized recommendations.';

    if (goal === 'weight_loss') {
      calories = Math.round(tdee * 0.85);
      workoutDuration = 45;
      workoutType = 'Cardio & Strength Training';
      steps = 10000;
      notes = 'Calorie deficit plan for weight loss. Include regular exercise and track your progress.';
    } else if (goal === 'weight_gain' || goal === 'muscle_gain') {
      calories = Math.round(tdee * 1.15);
      workoutDuration = 45;
      workoutType = 'Strength Training';
      steps = 8000;
      notes = 'Calorie surplus plan for muscle gain. Focus on strength training and adequate protein intake.';
    } else if (goal === 'improve_endurance') {
      calories = Math.round(tdee * 1.05);
      workoutDuration = 60;
      workoutType = 'Cardio & Endurance Training';
      steps = 12000;
      notes = 'Endurance-focused plan. Include regular cardio and gradually increase intensity.';
    }

    // Calculate macronutrients (similar to AI service)
    const protein = Math.round(weight * 1.6); // 1.6g per kg body weight
    const carbs = Math.round((calories * 0.4) / 4); // 40% of calories from carbs
    const fats = Math.round((calories * 0.3) / 9); // 30% of calories from fats

    return {
      predicted_calories: Math.round(calories),
      predicted_protein: protein,
      predicted_carbs: carbs,
      predicted_fats: fats,
      recommended_workout_duration: workoutDuration,
      recommended_workout_type: workoutType,
      recommended_steps: steps,
      sleep_hours: 7.5,
      water_intake_liters: 2.5,
      lifestyle_score: lifestyleScore,
      notes,
    };
  }

  /**
   * Save or update prediction for a specific date
   */
  static async savePrediction(
    userId: string,
    date: Date,
    predictionData: LifestylePredictionData
  ) {
    const dateString = date.toISOString().split('T')[0];

    const predictionDateValue = new Date(dateString);

    const [prediction, created] = await LifestylePrediction.findOrCreate({
      where: {
        user_id: userId,
        prediction_date: dateString,
      },
      defaults: {
        user_id: userId,
        prediction_date: predictionDateValue,
        ...predictionData,
      },
    });

    if (!created) {
      // Update existing prediction
      await prediction.update(predictionData);
    }

    return prediction;
  }

  /**
   * Get prediction for a specific date
   */
  static async getPrediction(userId: string, date: Date) {
    const dateString = date.toISOString().split('T')[0];
    return await LifestylePrediction.findOne({
      where: {
        user_id: userId,
        prediction_date: dateString,
      },
    });
  }

  /**
   * Get predictions for a date range
   */
  static async getPredictions(userId: string, startDate: Date, endDate: Date) {
    return await LifestylePrediction.findAll({
      where: {
        user_id: userId,
        prediction_date: {
          [require('sequelize').Op.between]: [
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
          ],
        },
      },
      order: [['prediction_date', 'ASC']],
    });
  }

  /**
   * Generate and save prediction for today
   */
  static async generateAndSaveToday(userId: string) {
    const predictionData = await this.generatePrediction(userId);
    return await this.savePrediction(userId, new Date(), predictionData);
  }

  private static toNumber(value: any, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}

