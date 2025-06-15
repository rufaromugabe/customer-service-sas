import { Request, Response } from 'express';
import { nileAuth } from '../config/nile.ts';
import { NileAuthRequest } from '../middleware/nileAuth.ts';

export class NileAuthController {
  /**
   * Sign in with email and password
   */
  signIn = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Email and password are required'
        });
      }

      const result = await nileAuth.signIn(email, password);
      
      // Set secure cookie with session token
      res.cookie('nile-auth', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({
        message: 'Sign in successful',
        user: result.user
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message || 'Invalid credentials'
      });
    }
  };

  /**
   * Sign up with email and password
   */
  signUp = async (req: Request, res: Response) => {
    try {
      const { email, password, name, tenantId } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Email and password are required'
        });
      }

      const result = await nileAuth.signUp(email, password, name);
      
      // If tenantId is provided, add user to tenant
      if (tenantId) {
        await nileAuth.addUserToTenant(tenantId, result.user.id);
      }

      // Set secure cookie with session token
      res.cookie('nile-auth', result.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.status(201).json({
        message: 'Sign up successful',
        user: result.user
      });
    } catch (error: any) {
      console.error('Sign up error:', error);
      res.status(400).json({
        error: 'Registration failed',
        message: error.message || 'Unable to create account'
      });
    }
  };

  /**
   * Sign out
   */
  signOut = async (req: Request, res: Response) => {
    try {
      await nileAuth.signOut();
      
      // Clear the session cookie
      res.clearCookie('nile-auth');
      
      res.json({
        message: 'Sign out successful'
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      res.status(500).json({
        error: 'Sign out failed',
        message: error.message || 'Unable to sign out'
      });
    }
  };

  /**
   * Get current user session
   */
  getCurrentUser = async (req: NileAuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'No active session'
        });
      }

      res.json({
        user: req.user,
        session: req.session
      });
    } catch (error: any) {
      console.error('Get current user error:', error);
      res.status(500).json({
        error: 'Unable to get user',
        message: error.message
      });
    }
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: NileAuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const { name, given_name, family_name, picture } = req.body;
      
      const updatedUser = await nileAuth.updateUser(req.user.id, {
        name,
        given_name,
        family_name,
        picture
      });

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Profile update failed',
        message: error.message
      });
    }
  };

  /**
   * Create tenant
   */
  createTenant = async (req: NileAuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant name is required'
        });
      }

      const tenant = await nileAuth.createTenant({
        name,
        description,
        ownerId: req.user.id
      });

      // Add user to the new tenant
      await nileAuth.addUserToTenant(tenant.id, req.user.id);

      res.status(201).json({
        message: 'Tenant created successfully',
        tenant
      });
    } catch (error: any) {
      console.error('Create tenant error:', error);
      res.status(500).json({
        error: 'Tenant creation failed',
        message: error.message
      });
    }
  };

  /**
   * Get user's tenants
   */
  getUserTenants = async (req: NileAuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const tenants = await nileAuth.listUserTenants(req.user.id);

      res.json({
        tenants
      });
    } catch (error: any) {
      console.error('Get user tenants error:', error);
      res.status(500).json({
        error: 'Unable to get tenants',
        message: error.message
      });
    }
  };

  /**
   * Google OAuth redirect (placeholder)
   */
  googleAuth = async (req: Request, res: Response) => {
    // This would integrate with Google OAuth
    // For now, return not implemented
    res.status(501).json({
      error: 'Not Implemented',
      message: 'Google OAuth integration coming soon'
    });
  };

  /**
   * GitHub OAuth redirect (placeholder)
   */
  githubAuth = async (req: Request, res: Response) => {
    // This would integrate with GitHub OAuth
    // For now, return not implemented
    res.status(501).json({
      error: 'Not Implemented',
      message: 'GitHub OAuth integration coming soon'
    });
  };

  /**
   * Magic link authentication (placeholder)
   */
  magicLink = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Email is required'
        });
      }

      // This would send a magic link email
      // For now, return not implemented
      res.status(501).json({
        error: 'Not Implemented',
        message: 'Magic link authentication coming soon'
      });
    } catch (error: any) {
      console.error('Magic link error:', error);
      res.status(500).json({
        error: 'Magic link failed',
        message: error.message
      });
    }
  };
}
