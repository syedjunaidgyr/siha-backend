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
    const insights = await PreventiveHealthService.getInsights(userId, {
      lookbackDays: 14,
      userProfile,
    });

    const lifestyleCard = insights?.lifestyleCard;
    if (!lifestyleCard) {
      throw new Error('AI lifestyle card unavailable');
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
      notes: lifestyleCard.notes || lifestylePlan?.morning?.[0] || insights?.summary?.nextBestAction,
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

