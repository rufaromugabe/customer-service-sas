import { Request, Response } from 'express';
import { PlanService, PermissionService } from '../services/index.js';
import { PrismaClient } from '@prisma/client';

export class PlanController {
    private planService: PlanService;
    private permissionService: PermissionService;

    constructor(prisma: PrismaClient) {
        this.planService = new PlanService(prisma);
        this.permissionService = new PermissionService(prisma);
    }

    // Plans
    getAllPlans = async (req: Request, res: Response) => {
        try {
            const plans = await this.planService.getAllPlans();
            res.json(plans);
        } catch (error: any) {
            console.error('Error listing plans:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getPlanById = async (req: Request, res: Response) => {
        try {
            const plan = await this.planService.getPlanById(req.params.id);
            if (!plan) {
                return res.status(404).json({ message: 'Plan not found.' });
            }
            res.json(plan);
        } catch (error: any) {
            console.error('Error getting plan:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createPlan = async (req: Request, res: Response) => {
        const { name, description, price } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Plan name and price are required.' });
        }
        try {
            const newPlan = await this.planService.createPlan({ name, description, price });
            res.status(201).json(newPlan);
        } catch (error: any) {
            console.error('Error creating plan:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updatePlan = async (req: Request, res: Response) => {
        const { name, description, price } = req.body;
        try {
            const updatedPlan = await this.planService.updatePlan(req.params.id, {
                name,
                description,
                price
            });
            res.json(updatedPlan);
        } catch (error: any) {
            console.error('Error updating plan:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deletePlan = async (req: Request, res: Response) => {
        try {
            await this.planService.deletePlan(req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting plan:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    addFeatureToPlan = async (req: Request, res: Response) => {
        const { featureId } = req.body;
        if (!featureId) {
            return res.status(400).json({ message: 'Feature ID is required.' });
        }
        try {
            const planFeature = await this.planService.addFeatureToPlan(req.params.planId, featureId);
            res.status(201).json(planFeature);
        } catch (error: any) {
            console.error('Error adding feature to plan:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    removeFeatureFromPlan = async (req: Request, res: Response) => {
        try {
            await this.planService.removeFeatureFromPlan(req.params.planId, req.params.featureId);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error removing feature from plan:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Features
    getAllFeatures = async (req: Request, res: Response) => {
        try {
            const features = await this.planService.getAllFeatures();
            res.json(features);
        } catch (error: any) {
            console.error('Error listing features:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getFeatureById = async (req: Request, res: Response) => {
        try {
            const feature = await this.planService.getFeatureById(req.params.id);
            if (!feature) {
                return res.status(404).json({ message: 'Feature not found.' });
            }
            res.json(feature);
        } catch (error: any) {
            console.error('Error getting feature:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createFeature = async (req: Request, res: Response) => {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Feature name is required.' });
        }
        try {
            const newFeature = await this.planService.createFeature({ name, description });
            res.status(201).json(newFeature);
        } catch (error: any) {
            console.error('Error creating feature:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateFeature = async (req: Request, res: Response) => {
        const { name, description } = req.body;
        try {
            const updatedFeature = await this.planService.updateFeature(req.params.id, {
                name,
                description
            });
            res.json(updatedFeature);
        } catch (error: any) {
            console.error('Error updating feature:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteFeature = async (req: Request, res: Response) => {
        try {
            await this.planService.deleteFeature(req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting feature:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Permissions
    getOrganizationalPermissions = async (req: Request, res: Response) => {
        try {
            const permissions = await this.permissionService.getOrganizationalPermissions();
            res.json(permissions);
        } catch (error: any) {
            console.error('Error listing organizational permissions:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createOrganizationalPermission = async (req: Request, res: Response) => {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ message: 'Permission name is required.' });
        try {
            const newPermission = await this.permissionService.createOrganizationalPermission({
                name,
                description
            });
            res.status(201).json(newPermission);
        } catch (error: any) {
            console.error('Error creating organizational permission:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getWorkspacePermissions = async (req: Request, res: Response) => {
        try {
            const permissions = await this.permissionService.getWorkspacePermissions();
            res.json(permissions);
        } catch (error: any) {
            console.error('Error listing workspace permissions:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createWorkspacePermission = async (req: Request, res: Response) => {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ message: 'Permission name is required.' });
        try {
            const newPermission = await this.permissionService.createWorkspacePermission({
                name,
                description
            });
            res.status(201).json(newPermission);
        } catch (error: any) {
            console.error('Error creating workspace permission:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };
}
