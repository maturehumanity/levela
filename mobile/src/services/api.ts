import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse, User, Endorsement, Evidence, FeedItem, Pillar } from '../types';

// Update this to your local IP when testing on device
// For Expo Go: use your computer's local IP (e.g., 192.168.1.x)
// For web: use localhost
export const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  },
};

// Users
export const usersApi = {
  getMe: async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data;
  },
  
  updateMe: async (data: { name?: string; bio?: string; avatar_url?: string }): Promise<User> => {
    const response = await api.put('/users/me', data);
    return response.data;
  },
  
  getUser: async (userId: number): Promise<User> => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  
  searchUsers: async (query: string, limit = 20, offset = 0): Promise<{ users: User[] }> => {
    const response = await api.get('/users', { params: { q: query, limit, offset } });
    return response.data;
  },
};

// Endorsements
export const endorsementsApi = {
  create: async (data: {
    ratee_id: number;
    pillar: Pillar;
    stars: number;
    comment?: string;
    evidence_ids?: number[];
  }): Promise<Endorsement> => {
    const response = await api.post('/endorsements', data);
    return response.data;
  },
  
  getUserEndorsements: async (
    userId: number,
    pillar?: Pillar,
    limit = 50,
    offset = 0
  ): Promise<{ endorsements: Endorsement[] }> => {
    const response = await api.get(`/endorsements/user/${userId}`, {
      params: { pillar, limit, offset },
    });
    return response.data;
  },
  
  getMyGivenEndorsements: async (userId: number): Promise<{ endorsements: Endorsement[] }> => {
    const response = await api.get(`/endorsements/by-user/${userId}`);
    return response.data;
  },
  
  canEndorse: async (rateeId: number, pillar: Pillar): Promise<{ can: boolean; reason?: string }> => {
    const response = await api.get(`/endorsements/can-endorse/${rateeId}/${pillar}`);
    return response.data;
  },
};

// Evidence
export const evidenceApi = {
  create: async (data: {
    pillar: Pillar;
    title: string;
    description?: string;
    file_uri?: string;
    file_type?: string;
    visibility?: 'public' | 'private';
  }): Promise<Evidence> => {
    const response = await api.post('/evidence', data);
    return response.data;
  },
  
  getUserEvidence: async (userId: number, pillar?: Pillar): Promise<{ evidence: Evidence[] }> => {
    const response = await api.get(`/evidence/user/${userId}`, { params: { pillar } });
    return response.data;
  },
  
  getEvidence: async (evidenceId: number): Promise<Evidence> => {
    const response = await api.get(`/evidence/${evidenceId}`);
    return response.data;
  },
  
  update: async (
    evidenceId: number,
    data: { title?: string; description?: string; visibility?: 'public' | 'private' }
  ): Promise<Evidence> => {
    const response = await api.put(`/evidence/${evidenceId}`, data);
    return response.data;
  },
  
  delete: async (evidenceId: number): Promise<void> => {
    await api.delete(`/evidence/${evidenceId}`);
  },
};

// Feed
export const feedApi = {
  getFeed: async (limit = 20, offset = 0): Promise<{ feed: FeedItem[] }> => {
    const response = await api.get('/feed', { params: { limit, offset } });
    return response.data;
  },
};

// Reports
export const reportsApi = {
  create: async (data: {
    reported_user_id?: number;
    reported_endorsement_id?: number;
    reason: string;
    description?: string;
  }): Promise<void> => {
    await api.post('/reports', data);
  },
};

export default api;
