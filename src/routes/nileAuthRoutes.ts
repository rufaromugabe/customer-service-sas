import { Router } from 'express';
import { NileAuthController } from '../controllers/NileAuthController.ts';
import { 
    nileAuthMiddleware, 
    nileOptionalAuthMiddleware,
    asyncHandler,
    validateRequest 
} from '../middleware/index.ts';
import { body } from 'express-validator';

const nileAuthRouter = Router();
const authController = new NileAuthController();

/**
 * @swagger
 * components:
 *   schemas:
 *     SignInRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: securepassword123
 *     SignUpRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: newuser@example.com
 *         password:
 *           type: string
 *           format: password
 *           example: securepassword123
 *         name:
 *           type: string
 *           example: Jane Doe
 *         tenantId:
 *           type: string
 *           format: uuid
 *           description: Optional ID of a tenant to join upon sign-up.
 *           example: 123e4567-e89b-12d3-a456-426614174000
 */

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Sign in with email and password
 *     description: Authenticates a user and establishes a session by returning a session cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignInRequest'
 *     responses:
 *       200:
 *         description: Sign-in successful. A session cookie is set in the response headers.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sign in successful
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *         headers:
 *           Set-Cookie:
 *             description: Contains the session token (e.g., `nile-session=...; HttpOnly; Secure`).
 *             schema:
 *               type: string
 *       400:
 *         description: Bad Request - Missing or invalid email or password format.
 *       401:
 *         description: Authentication Failed - Invalid credentials.
 */
nileAuthRouter.post('/signin', 
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 })
    ],
    validateRequest,
    asyncHandler(authController.signIn.bind(authController))
);

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Sign up with email and password
 *     description: Creates a new user account and establishes a session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignUpRequest'
 *     responses:
 *       201:
 *         description: Sign-up successful. A session cookie is set in the response headers.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sign up successful
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *         headers:
 *           Set-Cookie:
 *             description: Contains the session token (e.g., `nile-session=...; HttpOnly; Secure`).
 *             schema:
 *               type: string
 *       400:
 *         description: Bad Request - Invalid data provided or user with that email already exists.
 */
nileAuthRouter.post('/signup', 
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }),
        body('name').optional().isString().trim(),
        body('tenantId').optional().isUUID()
    ],
    validateRequest,
    asyncHandler(authController.signUp.bind(authController))
);

/**
 * @swagger
 * /api/auth/signout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Sign out
 *     description: Ends the user's session and clears the session cookie.
 *     responses:
 *       200:
 *         description: Sign-out successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sign out successful
 */
nileAuthRouter.post('/signout', 
    asyncHandler(authController.signOut.bind(authController))
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get current user
 *     description: Gets the profile information for the currently authenticated user.
 *     security:
 *       - nileSession: []
 *     responses:
 *       200:
 *         description: Current user information.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 session:
 *                   type: object
 *                   description: Information about the current session.
 *       401:
 *         description: Not authenticated.
 */
nileAuthRouter.get('/me', 
    nileAuthMiddleware,
    asyncHandler(authController.getCurrentUser.bind(authController))
);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags:
 *       - Authentication
 *     summary: Update user profile
 *     description: Updates the current user's profile information (name, picture, etc.).
 *     security:
 *       - nileSession: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Johnathan Doe
 *               given_name:
 *                 type: string
 *                 example: Johnathan
 *               family_name:
 *                 type: string
 *                 example: Doe
 *               picture:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/new-avatar.jpg
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Profile updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated.
 */
nileAuthRouter.put('/profile', 
    nileAuthMiddleware,
    [
        body('name').optional().isString().trim(),
        body('given_name').optional().isString().trim(),
        body('family_name').optional().isString().trim(),
        body('picture').optional().isURL()
    ],
    validateRequest,
    asyncHandler(authController.updateProfile.bind(authController))
);

/**
 * @swagger
 * /api/auth/tenants:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get user's tenants
 *     description: Gets a list of tenants (organizations) that the current user is a member of.
 *     security:
 *       - nileSession: []
 *     responses:
 *       200:
 *         description: A list of the user's tenants.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tenants:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tenant'
 *       401:
 *         description: Not authenticated.
 */
nileAuthRouter.get('/tenants', 
    nileAuthMiddleware,
    asyncHandler(authController.getUserTenants.bind(authController))
);

/**
 * @swagger
 * /api/auth/tenants:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Create a tenant
 *     description: Creates a new tenant (organization) and adds the current user as a member.
 *     security:
 *       - nileSession: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: My New Company
 *               description:
 *                 type: string
 *                 example: A description for my new company.
 *     responses:
 *       201:
 *         description: Tenant created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Tenant created successfully
 *                 tenant:
 *                   $ref: '#/components/schemas/Tenant'
 *       401:
 *         description: Not authenticated.
 */
nileAuthRouter.post('/tenants', 
    nileAuthMiddleware,
    [
        body('name').isString().trim().notEmpty(),
        body('description').optional().isString().trim()
    ],
    validateRequest,
    asyncHandler(authController.createTenant.bind(authController))
);

// OAuth routes (placeholders for future implementation)

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Google OAuth (Not Implemented)
 *     description: Placeholder to initiate the Google OAuth flow.
 *     responses:
 *       501:
 *         description: Not Implemented.
 */
nileAuthRouter.get('/google', 
    asyncHandler(authController.googleAuth.bind(authController))
);

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: GitHub OAuth (Not Implemented)
 *     description: Placeholder to initiate the GitHub OAuth flow.
 *     responses:
 *       501:
 *         description: Not Implemented.
 */
nileAuthRouter.get('/github', 
    asyncHandler(authController.githubAuth.bind(authController))
);

/**
 * @swagger
 * /api/auth/magic-link:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Magic link sign-in (Not Implemented)
 *     description: Placeholder to send a magic link for passwordless authentication.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       501:
 *         description: Not Implemented.
 */
nileAuthRouter.post('/magic-link', 
    [
        body('email').isEmail().normalizeEmail()
    ],
    validateRequest,
    asyncHandler(authController.magicLink.bind(authController))
);

export default nileAuthRouter;