// Script to add admin users directly to the database using Prisma
// Run: node --import tsx/esm add-admin-user.mjs

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function addAdminUser(email, password, name) {
    try {
        // Check if admin already exists
        const existingAdmin = await prisma.admins.findUnique({
            where: { email }
        });

        if (existingAdmin) {
            console.log(`❌ Admin with email ${email} already exists`);
            return false;
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create the admin user
        const admin = await prisma.admins.create({
            data: {
                email,
                password_hash: hashedPassword,
                name
            }
        });

        console.log(`✅ Admin created successfully:`);
        console.log(`   ID: ${admin.id}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Name: ${admin.name}`);
        console.log(`   Created: ${admin.created}`);
        console.log(`   Login credentials: ${email} / ${password}`);
        
        return true;
    } catch (error) {
        console.error(`❌ Error creating admin:`, error.message);
        return false;
    }
}

async function listAdmins() {
    try {
        const admins = await prisma.admins.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                created: true,
                updated: true,
                deleted: true
            },
            orderBy: { created: 'desc' }
        });

        console.log(`\n📋 Current admins (${admins.length}):`);
        admins.forEach((admin, index) => {
            console.log(`${index + 1}. ${admin.name || 'Unnamed'} (${admin.email})`);
            console.log(`   ID: ${admin.id}`);
            console.log(`   Created: ${admin.created}`);
            console.log(`   Status: ${admin.deleted ? 'Deleted' : 'Active'}`);
            console.log('');
        });
    } catch (error) {
        console.error('❌ Error listing admins:', error.message);
    }
}

async function main() {
    console.log('🚀 Adding admin users to the database...\n');

    // Add default admin users
    const adminUsers = [
        {
            email: 'admin@example.com',
            password: 'admin123',
            name: 'System Administrator'
        },
        {
            email: 'superadmin@example.com',
            password: 'super123', 
            name: 'Super Administrator'
        }
    ];

    // Add each admin user
    for (const user of adminUsers) {
        await addAdminUser(user.email, user.password, user.name);
        console.log(''); // Empty line for readability
    }

    // List all admins
    await listAdmins();

    console.log('✨ Done! You can now login to the admin endpoints with these credentials.');
    console.log('\n🧪 Test the login endpoint:');
    console.log('curl -X POST http://localhost:3001/api/auth/admin/login \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"email":"admin@example.com","password":"admin123"}\'');
}

// Run the script
main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
