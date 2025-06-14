import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs'; // For password hashing (install: npm install bcryptjs @types/bcryptjs)

const adminRouter = Router();
const prisma = new PrismaClient(); // Use the global prisma client for admin operations

// --- Authentication & Admin Management ---
adminRouter.post('/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    try {
        const admin = await prisma.admins.findUnique({ where: { email } });
        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        // In a real app, you'd issue a JWT or session token here
        res.json({ message: 'Admin logged in successfully.', adminId: admin.id });
    } catch (error: any) {
        console.error('Error during admin login:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/auth/admin/logout', (req, res) => {
    // Invalidate session/JWT here
    res.json({ message: 'Admin logged out successfully.' });
});

adminRouter.get('/auth/admin/me', async (req, res) => {
    // This would typically involve decoding a JWT from req.headers.authorization
    // For this basic auth example, let's assume req.auth.user is the admin email
    if (req.auth && req.auth.user) {
        try {
            const admin = await prisma.admins.findUnique({ where: { email: req.auth.user } });
            if (admin) {
                const { password_hash, ...adminInfo } = admin; // Exclude password hash
                return res.json(adminInfo);
            }
        } catch (error) {
            console.error('Error fetching admin info:', error);
        }
    }
    res.status(401).json({ message: 'Unauthorized or admin not found.' });
});


adminRouter.get('/admins', async (req, res) => {
    try {
        const admins = await prisma.admins.findMany({
            select: { id: true, email: true, name: true, created: true, updated: true } // Exclude password_hash
        });
        res.json(admins);
    } catch (error: any) {
        console.error('Error listing admins:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/admins', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = await prisma.admins.create({
            data: { email, password_hash: hashedPassword, name }
        });
        const { password_hash, ...adminInfo } = newAdmin;
        res.status(201).json(adminInfo);
    } catch (error: any) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.get('/admins/:id', async (req, res) => {
    try {
        const admin = await prisma.admins.findUnique({
            where: { id: req.params.id },
            select: { id: true, email: true, name: true, created: true, updated: true }
        });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found.' });
        }
        res.json(admin);
    } catch (error: any) {
        console.error('Error getting admin:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.put('/admins/:id', async (req, res) => {
    const { name, password } = req.body;
    try {
        const updateData: { name?: string, password_hash?: string } = {};
        if (name) updateData.name = name;
        if (password) updateData.password_hash = await bcrypt.hash(password, 10);

        const updatedAdmin = await prisma.admins.update({
            where: { id: req.params.id },
            data: updateData
        });
        const { password_hash, ...adminInfo } = updatedAdmin;
        res.json(adminInfo);
    } catch (error: any) {
        console.error('Error updating admin:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.delete('/admins/:id', async (req, res) => {
    try {
        await prisma.admins.delete({ where: { id: req.params.id } });
        res.status(204).send(); // No Content
    } catch (error: any) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Organization Management ---
adminRouter.get('/organizations', async (req, res) => {
    try {
        const organizations = await prisma.organizations.findMany();
        res.json(organizations);
    } catch (error: any) {
        console.error('Error listing organizations:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/organizations', async (req, res) => {
    const { name, id, current_plan_id } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Organization name is required.' });
    }
    try {
        const newOrg = await prisma.organizations.create({
            data: { id: id || uuidv4(), name, current_plan_id }
        });
        res.status(201).json(newOrg);
    } catch (error: any) {
        console.error('Error creating organization:', error);
        res.status(500).json({ message: 'Internal Server Error: ' + error.message });
    }
});

adminRouter.get('/organizations/:id', async (req, res) => {
    try {
        const organization = await prisma.organizations.findUnique({ where: { id: req.params.id } });
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found.' });
        }
        res.json(organization);
    } catch (error: any) {
        console.error('Error getting organization:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.put('/organizations/:id', async (req, res) => {
    const { name, active, current_plan_id } = req.body;
    try {
        const updatedOrg = await prisma.organizations.update({
            where: { id: req.params.id },
            data: { name, active, current_plan_id }
        });
        res.json(updatedOrg);
    } catch (error: any) {
        console.error('Error updating organization:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.delete('/organizations/:id', async (req, res) => {
    // Soft delete
    try {
        await prisma.organizations.update({
            where: { id: req.params.id },
            data: { deleted: new Date() }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error soft deleting organization:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/organizations/:id/activate', async (req, res) => {
    try {
        await prisma.organizations.update({
            where: { id: req.params.id },
            data: { active: true, deleted: null }
        });
        res.status(200).json({ message: 'Organization activated.' });
    } catch (error: any) {
        console.error('Error activating organization:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Plan & Feature Management ---
adminRouter.get('/plans', async (req, res) => {
    try {
        const plans = await prisma.plans.findMany({ include: { plan_features: { include: { feature: true } } } });
        res.json(plans);
    } catch (error: any) {
        console.error('Error listing plans:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/plans', async (req, res) => {
    const { name, description, price } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ message: 'Plan name and price are required.' });
    }
    try {
        const newPlan = await prisma.plans.create({ data: { name, description, price } });
        res.status(201).json(newPlan);
    } catch (error: any) {
        console.error('Error creating plan:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.put('/plans/:id', async (req, res) => {
    const { name, description, price } = req.body;
    try {
        const updatedPlan = await prisma.plans.update({
            where: { id: req.params.id },
            data: { name, description, price }
        });
        res.json(updatedPlan);
    } catch (error: any) {
        console.error('Error updating plan:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.delete('/plans/:id', async (req, res) => {
    try {
        await prisma.plans.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting plan:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.get('/features', async (req, res) => {
    try {
        const features = await prisma.features.findMany();
        res.json(features);
    } catch (error: any) {
        console.error('Error listing features:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/features', async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Feature name is required.' });
    }
    try {
        const newFeature = await prisma.features.create({ data: { name, description } });
        res.status(201).json(newFeature);
    } catch (error: any) {
        console.error('Error creating feature:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.put('/features/:id', async (req, res) => {
    const { name, description } = req.body;
    try {
        const updatedFeature = await prisma.features.update({
            where: { id: req.params.id },
            data: { name, description }
        });
        res.json(updatedFeature);
    } catch (error: any) {
        console.error('Error updating feature:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.delete('/features/:id', async (req, res) => {
    try {
        await prisma.features.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting feature:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/plans/:planId/features', async (req, res) => {
    const { featureId } = req.body;
    try {
        const newPlanFeature = await prisma.plan_features.create({
            data: { plan_id: req.params.planId, feature_id: featureId }
        });
        res.status(201).json(newPlanFeature);
    } catch (error: any) {
        console.error('Error adding feature to plan:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.delete('/plans/:planId/features/:featureId', async (req, res) => {
    try {
        await prisma.plan_features.delete({
            where: {
                plan_id_feature_id: {
                    plan_id: req.params.planId,
                    feature_id: req.params.featureId
                }
            }
        });
        res.status(204).send();
    } catch (error: any) {
        console.error('Error removing feature from plan:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Global Permissions ---
adminRouter.get('/permissions/organizational', async (req, res) => {
    try {
        const permissions = await prisma.permissions.findMany({ where: { type: 'ORGANIZATIONAL' } });
        res.json(permissions);
    } catch (error: any) {
        console.error('Error listing organizational permissions:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/permissions/organizational', async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Permission name is required.' });
    try {
        const newPermission = await prisma.permissions.create({ data: { name, description, type: 'ORGANIZATIONAL' } });
        res.status(201).json(newPermission);
    } catch (error: any) {
        console.error('Error creating organizational permission:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.get('/permissions/workspace', async (req, res) => {
    try {
        const permissions = await prisma.permissions.findMany({ where: { type: 'WORKSPACE' } });
        res.json(permissions);
    } catch (error: any) {
        console.error('Error listing workspace permissions:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.post('/permissions/workspace', async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Permission name is required.' });
    try {
        const newPermission = await prisma.permissions.create({ data: { name, description, type: 'WORKSPACE' } });
        res.status(201).json(newPermission);
    } catch (error: any) {
        console.error('Error creating workspace permission:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- System Analytics & Audit ---
adminRouter.get('/analytics/system-usage', async (req, res) => {
    try {
        // Placeholder for real usage stats logic
        const totalOrganizations = await prisma.organizations.count();
        const totalUsers = await prisma.users.count();
        const totalActiveAgents = await prisma.ai_agents.count({ where: { status: 'active' } });
        res.json({
            totalOrganizations,
            totalUsers,
            totalActiveAgents,
            // ... more system-wide metrics
            note: 'This is a placeholder for detailed system usage statistics.'
        });
    } catch (error: any) {
        console.error('Error fetching system usage stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.get('/analytics/organizations', async (req, res) => {
    try {
        // Placeholder for organization metrics logic
        const organizationMetrics = await prisma.organizations.findMany({
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        tenant_users: true,
                        workspaces: true,
                        conversations: true,
                        ai_agents: true,
                    },
                },
            },
        });
        res.json({
            organizationMetrics,
            note: 'This is a placeholder for detailed organization metrics.'
        });
    } catch (error: any) {
        console.error('Error fetching organization metrics:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

adminRouter.get('/audit-logs/system', async (req, res) => {
    try {
        const systemAuditLogs = await prisma.audit_logs.findMany({
            where: { log_type: 'SYSTEM' },
            orderBy: { timestamp: 'desc' },
            take: 100 // Limit for performance
        });
        res.json(systemAuditLogs);
    } catch (error: any) {
        console.error('Error fetching system audit logs:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

export default adminRouter;