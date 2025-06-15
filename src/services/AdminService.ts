import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class AdminService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getAllAdmins() {
        return await this.prisma.admins.findMany({
            select: { id: true, email: true, name: true, created: true, updated: true }
        });
    }

    async getAdminById(id: string) {
        return await this.prisma.admins.findUnique({
            where: { id },
            select: { id: true, email: true, name: true, created: true, updated: true }
        });
    }

    async getAdminByEmail(email: string) {
        return await this.prisma.admins.findUnique({
            where: { email }
        });
    }

    async createAdmin(email: string, password: string, name?: string) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = await this.prisma.admins.create({
            data: { email, password_hash: hashedPassword, name }
        });
        const { password_hash, ...adminInfo } = newAdmin;
        return adminInfo;
    }

    async updateAdmin(id: string, data: { name?: string, password?: string }) {
        const updateData: { name?: string, password_hash?: string } = {};
        if (data.name) updateData.name = data.name;
        if (data.password) updateData.password_hash = await bcrypt.hash(data.password, 10);

        const updatedAdmin = await this.prisma.admins.update({
            where: { id },
            data: updateData
        });
        const { password_hash, ...adminInfo } = updatedAdmin;
        return adminInfo;
    }

    async deleteAdmin(id: string) {
        return await this.prisma.admins.delete({ where: { id } });
    }

    async validateAdmin(email: string, password: string) {
        const admin = await this.getAdminByEmail(email);
        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
            return null;
        }
        const { password_hash, ...adminInfo } = admin;
        return adminInfo;
    }
}
