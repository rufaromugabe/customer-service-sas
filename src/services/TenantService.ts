import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export class TenantService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getAllTenants() {
        return await this.prisma.tenants.findMany({
            where: { deleted: null }
        });
    }

    async getTenantById(id: string) {
        return await this.prisma.tenants.findUnique({
            where: { id },
            include: {
                roles: true,
                workspaces: true
            }
        });
    }

    async createTenant(data: { name: string, current_plan_id?: string, compute_id?: string }) {
        return await this.prisma.tenants.create({
            data: {
                name: data.name,
                current_plan_id: data.current_plan_id,
                compute_id: data.compute_id
            }
        });
    }

    async updateTenant(id: string, data: { name?: string, active?: boolean, current_plan_id?: string }) {
        return await this.prisma.tenants.update({
            where: { id },
            data
        });
    }

    async softDeleteTenant(id: string) {
        return await this.prisma.tenants.update({
            where: { id },
            data: { deleted: new Date() }
        });
    }

    async activateTenant(id: string) {
        return await this.prisma.tenants.update({
            where: { id },
            data: { active: true, deleted: null }
        });
    }

    async deactivateTenant(id: string) {
        return await this.prisma.tenants.update({
            where: { id },
            data: { active: false }
        });
    }

    async getTenantStats(id: string) {
        const workspaceCount = await this.prisma.workspaces.count({
            where: { tenant_id: id, deleted: null }
        });
        
        const userCount = await this.prisma.tenant_users.count({
            where: { tenant_id: id, deleted: null }
        });

        const agentCount = await this.prisma.ai_agents.count({
            where: { tenant_id: id, deleted: null }
        });

        const conversationCount = await this.prisma.conversations.count({
            where: { tenant_id: id, deleted: null }
        });

        return {
            workspaceCount,
            userCount,
            agentCount,
            conversationCount
        };
    }

    // Invitation Management
    async getInvitations(tenantId: string) {
        return await this.prisma.invitations.findMany({
            where: { tenant_id: tenantId }
        });
    }

    async createInvitation(data: { tenantId: string, email: string, invitedByUserId?: string }) {
        const invitationToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

        return await this.prisma.invitations.create({
            data: {
                tenant_id: data.tenantId,
                email: data.email,
                token: invitationToken,
                expires_at: expiresAt,
                invited_by_user_id: data.invitedByUserId
            }
        });
    }

    async getInvitationByToken(token: string) {
        const invitation = await this.prisma.invitations.findFirst({
            where: { token }
        });
        
        if (!invitation || invitation.status !== 'pending' || 
            (invitation.expires_at && invitation.expires_at < new Date())) {
            return null;
        }
        
        return invitation;
    }

    async acceptInvitation(token: string, userId?: string) {
        const invitation = await this.getInvitationByToken(token);
        if (!invitation) {
            throw new Error('Invitation invalid, expired, or already accepted/cancelled.');
        }

        // Mark invitation as accepted
        await this.prisma.invitations.update({
            where: { 
                tenant_id_id: { 
                    tenant_id: invitation.tenant_id,
                    id: invitation.id
                }
            },
            data: { status: 'accepted' }
        });

        // Ensure user exists
        let actualUserId = userId;
        if (!actualUserId) {
            const existingUser = await this.prisma.users.findFirst({ 
                where: { email: invitation.email } 
            });
            
            if (existingUser) {
                actualUserId = existingUser.id;
            } else {
                const newUser = await this.prisma.users.create({
                    data: { 
                        email: invitation.email, 
                        name: invitation.email?.split('@')[0] 
                    }
                });
                actualUserId = newUser.id;
            }
        } else {
            const userExists = await this.prisma.users.findUnique({ 
                where: { id: actualUserId } 
            });
            if (!userExists) {
                throw new Error('Provided user ID does not exist.');
            }
        }

        // Associate user with tenant
        await this.prisma.tenant_users.create({
            data: {
                tenant_id: invitation.tenant_id,
                user_id: actualUserId,
                email: invitation.email,
                roles: ['member']
            }
        });

        return {
            message: 'Invitation accepted successfully. User added to organization.',
            userId: actualUserId,
            tenantId: invitation.tenant_id
        };
    }

    async cancelInvitation(tenantId: string, invitationId: string) {
        return await this.prisma.invitations.update({
            where: { 
                tenant_id_id: { 
                    tenant_id: tenantId, 
                    id: invitationId 
                } 
            },
            data: { status: 'cancelled' }
        });
    }

    async resendInvitation(tenantId: string, invitationId: string) {
        const newToken = uuidv4();
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        return await this.prisma.invitations.update({
            where: { 
                tenant_id_id: { 
                    tenant_id: tenantId,
                    id: invitationId
                }
            },
            data: { 
                token: newToken, 
                expires_at: newExpiresAt, 
                status: 'pending' 
            }
        });
    }

    // Organization Management
    async getTenantPlan(tenantId: string) {
        const organization = await this.prisma.tenants.findUnique({
            where: { id: tenantId }
        });
        
        if (!organization || !organization.current_plan_id) {
            return null;
        }
        
        return await this.prisma.plans.findUnique({ 
            where: { id: organization.current_plan_id } 
        });
    }

    async getTenantUsage(tenantId: string) {
        const totalConversations = await this.prisma.conversations.count({ 
            where: { tenant_id: tenantId } 
        });
        
        const totalMessages = await this.prisma.messages.count({ 
            where: { tenant_id: tenantId } 
        });
        
        return {
            totalConversations,
            totalMessages,
            note: 'This is a placeholder for detailed tenant-specific API usage statistics.'
        };
    }
}
