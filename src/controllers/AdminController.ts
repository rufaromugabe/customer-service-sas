import { Request, Response } from 'express';
import { AdminService } from '../services/AdminService.ts';
import { PrismaClient } from '@prisma/client';

export class AdminController {
    private adminService: AdminService;

    constructor(prisma: PrismaClient) {
        this.adminService = new AdminService(prisma);
    }

    getAllAdmins = async (req: Request, res: Response) => {
        try {
            const admins = await this.adminService.getAllAdmins();
            res.json(admins);
        } catch (error: any) {
            console.error('Error listing admins:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    getAdminById = async (req: Request, res: Response) => {
        try {
            const admin = await this.adminService.getAdminById(req.params.id);
            if (!admin) {
                return res.status(404).json({ message: 'Admin not found.' });
            }
            res.json(admin);
        } catch (error: any) {
            console.error('Error getting admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    createAdmin = async (req: Request, res: Response) => {
        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        try {
            const newAdmin = await this.adminService.createAdmin(email, password, name);
            res.status(201).json(newAdmin);
        } catch (error: any) {
            console.error('Error creating admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    updateAdmin = async (req: Request, res: Response) => {
        const { name, password } = req.body;
        try {
            const updatedAdmin = await this.adminService.updateAdmin(req.params.id, { name, password });
            res.json(updatedAdmin);
        } catch (error: any) {
            console.error('Error updating admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    deleteAdmin = async (req: Request, res: Response) => {
        try {
            await this.adminService.deleteAdmin(req.params.id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting admin:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    loginAdmin = async (req: Request, res: Response) => {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        try {
            const admin = await this.adminService.validateAdmin(email, password);
            if (!admin) {
                return res.status(401).json({ message: 'Invalid credentials.' });
            }
            // In a real app, you'd issue a JWT or session token here
            res.json({ message: 'Admin logged in successfully.', adminId: admin.id });
        } catch (error: any) {
            console.error('Error during admin login:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };

    logoutAdmin = async (req: Request, res: Response) => {
        // Invalidate session/JWT here
        res.json({ message: 'Admin logged out successfully.' });
    };

    getCurrentAdmin = async (req: Request, res: Response) => {
        // This would typically involve decoding a JWT from req.headers.authorization
        // For this basic auth example, let's assume req.auth.user is the admin email
        if (req.auth && req.auth.user) {
            try {
                const admin = await this.adminService.getAdminByEmail(req.auth.user);
                if (admin) {
                    const { password_hash, ...adminInfo } = admin;
                    return res.json(adminInfo);
                }
            } catch (error) {
                console.error('Error fetching admin info:', error);
            }
        }
        res.status(401).json({ message: 'Unauthorized or admin not found.' });
    };
}
