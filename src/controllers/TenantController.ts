import { Request, Response } from 'express';
import { TenantService } from '../services/TenantService.js';
import { tenantContext } from '../storage.js';
import { v4 as uuidv4 } from 'uuid';

export class TenantController {
    private getTenantService() {
        const tenantDB = tenantContext.getStore();
        if (!tenantDB) {
            throw new Error('Tenant context not established');
        }
        return new TenantService(tenantDB);
    }    getAllTenants = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const tenants = await tenantService.getAllTenants();
            res.json(tenants);
        } catch (error: any) {
            console.error('Error listing tenants:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getTenantById = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const tenant = await tenantService.getTenantById(req.params.id);
            if (!tenant) {
                return res.status(404).json({ message: 'Tenant not found.' });
            }
            res.json(tenant);
        } catch (error: any) {
            console.error('Error getting tenant:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createTenant = async (req: Request, res: Response) => {
        const { name, id, current_plan_id, compute_id } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Tenant name is required.' });
        }
        try {
            const tenantService = this.getTenantService();
            const newTenant = await tenantService.createTenant({
                name,
                current_plan_id,
                compute_id
            });
            res.status(201).json(newTenant);
        } catch (error: any) {
            console.error('Error creating tenant:', error);
            res.status(500).json({ message: 'Internal Server Error: ' + error.message });
        }
    };    updateTenant = async (req: Request, res: Response) => {
        const { name, active, current_plan_id } = req.body;
        try {
            const tenantService = this.getTenantService();
            const updatedTenant = await tenantService.updateTenant(req.params.id, {
                name,
                active,
                current_plan_id
            });
            res.json(updatedTenant);
        } catch (error: any) {
            console.error('Error updating tenant:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteTenant = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            await tenantService.softDeleteTenant(req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting tenant:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    activateTenant = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            await tenantService.activateTenant(req.params.id);
            res.status(200).json({ message: 'Tenant activated.' });
        } catch (error: any) {
            console.error('Error activating tenant:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deactivateTenant = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            await tenantService.deactivateTenant(req.params.id);
            res.status(200).json({ message: 'Tenant deactivated.' });
        } catch (error: any) {
            console.error('Error deactivating tenant:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getTenantStats = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const stats = await tenantService.getTenantStats(req.params.id);
            res.json(stats);
        } catch (error: any) {
            console.error('Error getting tenant stats:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };    // Invitation Management
    getInvitations = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const invitations = await tenantService.getInvitations(req.params.tenantId);
            res.json(invitations);
        } catch (error: any) {
            console.error('Error listing invitations:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createInvitation = async (req: Request, res: Response) => {
        const { email } = req.body;
        const tenantId = req.params.tenantId;
        const invitedByUserId = (req as any).auth?.user;

        try {
            const tenantService = this.getTenantService();
            const invitation = await tenantService.createInvitation({
                tenantId,
                email,
                invitedByUserId
            });
            res.status(201).json(invitation);
        } catch (error: any) {
            console.error('Error creating invitation:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getInvitationDetails = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const invitation = await tenantService.getInvitationByToken(req.params.token);
            if (!invitation) {
                return res.status(404).json({ message: 'Invitation not found, expired, or already accepted/cancelled.' });
            }
            res.json({
                tenantId: invitation.tenant_id,
                email: invitation.email,
                status: invitation.status,
                expires_at: invitation.expires_at
            });
        } catch (error: any) {
            console.error('Error getting invitation details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    acceptInvitation = async (req: Request, res: Response) => {
        const { userId } = req.body;
        try {
            const tenantService = this.getTenantService();
            const result = await tenantService.acceptInvitation(req.params.token, userId);
            res.status(200).json(result);
        } catch (error: any) {
            console.error('Error accepting invitation:', error);
            res.status(500).json({ message: 'Internal Server Error: ' + error.message });
        }
    };

    cancelInvitation = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            await tenantService.cancelInvitation(req.params.tenantId, req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error cancelling invitation:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    resendInvitation = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const invitation = await tenantService.resendInvitation(req.params.tenantId, req.params.id);
            res.status(200).json({ message: 'Invitation resent (demo only, no email sent).', invitation });
        } catch (error: any) {
            console.error('Error resending invitation:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    // Organization Settings
    getOrganization = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const organization = await tenantService.getTenantById(req.params.tenantId);
            if (!organization) {
                return res.status(404).json({ message: 'Organization not found.' });
            }
            res.json(organization);
        } catch (error: any) {
            console.error('Error getting organization details:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateOrganization = async (req: Request, res: Response) => {
        const { name } = req.body;
        try {
            const tenantService = this.getTenantService();
            const updatedOrg = await tenantService.updateTenant(req.params.tenantId, { name });
            res.json(updatedOrg);
        } catch (error: any) {
            console.error('Error updating organization settings:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getOrganizationPlan = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const plan = await tenantService.getTenantPlan(req.params.tenantId);
            res.json(plan || { message: 'No plan assigned.' });
        } catch (error: any) {
            console.error('Error getting organization plan:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getOrganizationUsage = async (req: Request, res: Response) => {
        try {
            const tenantService = this.getTenantService();
            const usage = await tenantService.getTenantUsage(req.params.tenantId);
            res.json(usage);
        } catch (error: any) {
            console.error('Error getting organization usage stats:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };
}
