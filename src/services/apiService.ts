import { logger } from '../services/logger';
import { authService } from './authService';

// API URL - Use relative URL to leverage the Vite proxy
const API_URL = '/api';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  parseAsJson?: boolean;
}

export const apiService = {
  /**
   * Make an authenticated API request
   */
  request: async <T>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
    const {
      method = 'GET',
      body,
      headers = {},
      skipAuth = false,
      parseAsJson = true
    } = options;

    // Build URL
    const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    // Setup headers with auth token
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    };
    
    if (!skipAuth) {
      const token = authService.getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      } else {
        return Promise.reject(new Error('Authentication required'));
      }
    }
    
    // Build request
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined
    };
    
    // Execute request
    try {
      const response = await fetch(url, requestOptions);
      
      // Handle 401 Unauthorized
      if (response.status === 401) {
        authService.logout();
        window.location.href = '/login';
        return Promise.reject(new Error('Session expired'));
      }
      
      // Handle other errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Request failed';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      // Parse response
      if (parseAsJson) {
        try {
          return await response.json();
        } catch {
          // Handle empty responses that should be JSON
          return {} as T;
        }
      } else {
        return await response.text() as unknown as T;
      }
    } catch (error) {
      console.error(`API Error (${method} ${endpoint}):`, error);
      throw error;
    }
  },
  
  // Convenience methods
  get: <T>(endpoint: string, options: Omit<ApiOptions, 'method' | 'body'> = {}) => 
    apiService.request<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T>(endpoint: string, body: any, options: Omit<ApiOptions, 'method'> = {}) => 
    apiService.request<T>(endpoint, { ...options, method: 'POST', body }),
  
  put: <T>(endpoint: string, body: any, options: Omit<ApiOptions, 'method'> = {}) => 
    apiService.request<T>(endpoint, { ...options, method: 'PUT', body }),
  
  delete: <T>(endpoint: string, options: Omit<ApiOptions, 'method'> = {}) => 
    apiService.request<T>(endpoint, { ...options, method: 'DELETE' })
};

// Configure the logger
logger.configure({
  minLevel: 'info', // Only show info and above in production
  includeTimestamp: true,
  includeStacktrace: true,
  performanceTracking: true
});

// Basic logging
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// With additional data
logger.info('User action', { userId: '123', action: 'login' });

// Track performance of a function or operation
logger.startPerformanceMark('fetchData');
try {
  const data = await fetchData();
  logger.endPerformanceMark('fetchData');
} catch (error) {
  logger.error('Failed to fetch data', error);
}

async function fetchData() {
  logger.logApiRequest('GET', '/api/data');
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    logger.logApiResponse('GET', '/api/data', response.status, data);
    return data;
  } catch (error) {
    logger.logApiError('GET', '/api/data', error);
    throw error;
  }
} 