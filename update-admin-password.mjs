// Script to update admin password
// Run: node --import tsx/esm update-admin-password.mjs

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function updateAdminPassword(email, newPassword) {
    try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update the admin's password
        const updatedAdmin = await prisma.admins.update({
            where: { email },
            data: { password_hash: hashedPassword },
            select: { id: true, email: true, name: true }
        });

        console.log(`✅ Password updated successfully for ${email}`);
        console.log(`   Admin: ${updatedAdmin.name}`);
        console.log(`   New password: ${newPassword}`);
        
        return true;    } catch (error) {
        console.error(`❌ Error updating password for ${email}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🔐 Updating admin password...\n');

    // Update the first admin's password
    await updateAdminPassword('admin@example.com', 'admin123');

    console.log('\n✨ Done! You can now login with the updated credentials.');
    console.log('\n🧪 Test the login:');
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
