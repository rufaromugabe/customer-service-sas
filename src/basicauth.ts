import { PrismaClient } from "@prisma/client";
import { tenantContext } from "./storage.ts";

export const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true"; // Ensure it's a boolean

export async function dbAuthorizer(
  username: string,
  password: string, // In this basic example, password is not checked against a hash
  cb: (err: any, result: boolean) => void
) {
  console.log("authenticating user: " + username);
  if (!REQUIRE_AUTH) {
    return cb(null, true);
  }
  const tenantDB = tenantContext.getStore(); // Use global Prisma client if not in tenant context

  // For system admins (checking against 'admins' table)
  // This is a simplistic check; in reality, you'd hash and compare passwords.
  const admin = await tenantDB?.admins.findUnique({
    where: {
      email: username,
    },
  });

  if (admin) {
    // For demo, assuming any non-empty password is fine for admin if user exists
    // In production, compare password with hashed password (e.g., bcrypt)
    console.log(`Admin ${username} authenticated.`);
    return cb(null, true);
  }

  // For tenant users (checking against 'users' table)
  // The username here is assumed to be the user's ID or email.
  const user = await tenantDB?.users.findUnique({
    where: {
      id: username, // Assuming username is the user ID for this simple auth
    },
  });

  // if no users found, return false
  if (!user) {
    console.log(`User ${username} not found.`);
    return cb(null, false);
  }

  console.log(`User ${username} authenticated.`);
  return cb(null, true);
}

export function getUnauthorizedResponse(req: any) {
  return req.auth
    ? "Credentials " + req.auth.user + ":" + req.auth.password + " rejected"
    : "No credentials provided";
}