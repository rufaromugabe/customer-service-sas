// Generate SQL to add admin users with properly hashed passwords
// Run this script to generate the SQL statements

import bcrypt from 'bcryptjs';

async function generateAdminSQL() {
    // Define admin users to create
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

    console.log('-- Generated SQL to add admin users');
    console.log('-- Copy and paste these statements into your database client\n');

    for (const user of adminUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        
        console.log(`-- Admin: ${user.name} (${user.email})`);
        console.log(`-- Password: ${user.password}`);
        console.log(`INSERT INTO public.admins (email, password_hash, name) `);
        console.log(`VALUES ('${user.email}', '${hashedPassword}', '${user.name}');`);
        console.log('');
    }

    console.log('-- Verify admin creation:');
    console.log('SELECT id, email, name, created FROM public.admins ORDER BY created DESC;');
    console.log('');
    
    console.log('-- Test login credentials:');
    adminUsers.forEach(user => {
        console.log(`-- Email: ${user.email}, Password: ${user.password}`);
    });
}

// Run the script
generateAdminSQL().catch(console.error);
