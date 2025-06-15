import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class InvitationService {
    private tenantDB: PrismaClient;

    constructor(tenantDB: PrismaClient) {
        this.tenantDB = tenantDB;
    }

    generateInvitationToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    async getInvitationsByTenant(tenantId: string) {
        return await this.tenantDB.invitations.findMany({
            where: { tenant_id: tenantId },
            orderBy: { created: 'desc' }
        });
    }

    async getInvitationByToken(token: string) {
        // Note: This should use base prisma client since it's a public endpoint
        const prisma = new PrismaClient();
        try {
            return await prisma.invitations.findFirst({
                where: { token }
            });
        } finally {
            await prisma.$disconnect();
        }
    }

    async createInvitation(tenantId: string, data: {
        email: string;
        invited_by_user_id?: string;
        expires_at?: Date;
    }) {
        const token = this.generateInvitationToken();
        const expiresAt = data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

        return await this.tenantDB.invitations.create({
            data: {
                tenant_id: tenantId,
                email: data.email,
                token,
                expires_at: expiresAt,
                invited_by_user_id: data.invited_by_user_id,
                status: 'pending'
            }
        });
    }

    async acceptInvitation(token: string, userId: string) {
        const prisma = new PrismaClient();
        
        try {
            // Find the invitation
            const invitation = await prisma.invitations.findFirst({
                where: { token, status: 'pending' }
            });

            if (!invitation) {
                throw new Error('Invalid or expired invitation');
            }

            if (invitation.expires_at && invitation.expires_at < new Date()) {
                throw new Error('Invitation has expired');
            }

            // Update invitation status
            await prisma.invitations.update({
                where: {
                    tenant_id_id: {
                        tenant_id: invitation.tenant_id,
                        id: invitation.id
                    }
                },
                data: { status: 'accepted' }
            });

            // Add user to tenant
            await prisma.tenant_users.create({
                data: {
                    tenant_id: invitation.tenant_id,
                    user_id: userId,
                    email: invitation.email,
                    roles: [] // Default empty roles
                }
            });

            return { success: true, tenantId: invitation.tenant_id };
        } finally {
            await prisma.$disconnect();
        }
    }

    async cancelInvitation(tenantId: string, invitationId: string) {
        return await this.tenantDB.invitations.update({
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
        const newToken = this.generateInvitationToken();
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        return await this.tenantDB.invitations.update({
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

    async deleteInvitation(tenantId: string, invitationId: string) {
        return await this.tenantDB.invitations.delete({
            where: {
                tenant_id_id: {
                    tenant_id: tenantId,
                    id: invitationId
                }
            }
        });
    }
}
