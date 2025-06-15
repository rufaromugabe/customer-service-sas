// Nile API configuration
export const nileConfig = {
  apiUrl: process.env.NILE_API_URL || 'https://api.thenile.dev',
  workspace: process.env.NILE_WORKSPACE_ID!,
  database: process.env.NILE_DATABASE_ID!,
  apiToken: process.env.NILE_API_TOKEN!,
  databaseUrl: process.env.DATABASE_URL!,
  auth: {
    cookieName: process.env.NILE_AUTH_COOKIE_NAME || 'nile-auth',
    cookieSecure: process.env.NILE_AUTH_COOKIE_SECURE === 'true',
    cookieSameSite: process.env.NILE_AUTH_COOKIE_SAME_SITE as 'strict' | 'lax' | 'none' || 'lax',
  },
};

// Nile API client class
export class NileAuth {
  private apiUrl: string;
  private workspace: string;
  private database: string;
  private apiToken: string;

  constructor() {
    this.apiUrl = nileConfig.apiUrl;
    this.workspace = nileConfig.workspace;
    this.database = nileConfig.database;
    this.apiToken = nileConfig.apiToken;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Nile API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Authentication methods
  async getCurrentSession(cookies: string) {
    try {
      const response = await this.makeRequest('/auth/session', {
        method: 'GET',
        headers: {
          'Cookie': cookies,
        },
      });
      return response;
    } catch (error) {
      return null;
    }
  }

  async signIn(email: string, password: string) {
    return this.makeRequest('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signUp(email: string, password: string, name?: string) {
    return this.makeRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async signOut() {
    return this.makeRequest('/auth/signout', {
      method: 'POST',
    });
  }

  // User methods
  async createUser(userData: any) {
    return this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getUser(userId: string) {
    return this.makeRequest(`/users/${userId}`, {
      method: 'GET',
    });
  }

  async updateUser(userId: string, userData: any) {
    return this.makeRequest(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // Tenant methods
  async createTenant(tenantData: any) {
    return this.makeRequest('/tenants', {
      method: 'POST',
      body: JSON.stringify(tenantData),
    });
  }

  async getTenant(tenantId: string) {
    return this.makeRequest(`/tenants/${tenantId}`, {
      method: 'GET',
    });
  }

  async listUserTenants(userId: string) {
    return this.makeRequest(`/users/${userId}/tenants`, {
      method: 'GET',
    });
  }

  async addUserToTenant(tenantId: string, userId: string) {
    return this.makeRequest(`/tenants/${tenantId}/users`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }
}

export const nileAuth = new NileAuth();
