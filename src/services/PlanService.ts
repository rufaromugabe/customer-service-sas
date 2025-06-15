import { PrismaClient } from '@prisma/client';

export class PlanService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getAllPlans() {
        return await this.prisma.plans.findMany({
            include: { 
                plan_features: { 
                    include: { feature: true } 
                } 
            },
            where: { deleted: null }
        });
    }

    async getPlanById(id: string) {
        return await this.prisma.plans.findUnique({
            where: { id },
            include: { 
                plan_features: { 
                    include: { feature: true } 
                } 
            }
        });
    }

    async createPlan(data: { name: string, description?: string, price: number }) {
        return await this.prisma.plans.create({
            data
        });
    }

    async updatePlan(id: string, data: { name?: string, description?: string, price?: number }) {
        return await this.prisma.plans.update({
            where: { id },
            data
        });
    }

    async deletePlan(id: string) {
        return await this.prisma.plans.update({
            where: { id },
            data: { deleted: new Date() }
        });
    }

    async addFeatureToPlan(planId: string, featureId: string) {
        return await this.prisma.plan_features.create({
            data: { plan_id: planId, feature_id: featureId }
        });
    }

    async removeFeatureFromPlan(planId: string, featureId: string) {
        return await this.prisma.plan_features.delete({
            where: {
                plan_id_feature_id: {
                    plan_id: planId,
                    feature_id: featureId
                }
            }
        });
    }

    // Features
    async getAllFeatures() {
        return await this.prisma.features.findMany({
            where: { deleted: null }
        });
    }

    async getFeatureById(id: string) {
        return await this.prisma.features.findUnique({
            where: { id }
        });
    }

    async createFeature(data: { name: string, description?: string }) {
        return await this.prisma.features.create({
            data
        });
    }

    async updateFeature(id: string, data: { name?: string, description?: string }) {
        return await this.prisma.features.update({
            where: { id },
            data
        });
    }

    async deleteFeature(id: string) {
        return await this.prisma.features.update({
            where: { id },
            data: { deleted: new Date() }
        });
    }
}
