import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  GameStatus,
  AreasGeoJSON,
  Area,
  Submission,
  LeaderboardEntry,
  AreaCooldown,
  PendingCount,
  JoinRequest,
  StartGameRequest,
  ReviewSubmissionRequest,
  City,
  CreateSessionRequest,
  SessionResponse,
  SessionTeam,
  StartSessionResponse,
  CityPointsConfig,
  UpdateCityPointsConfigRequest,
  PublicResultsResponse,
  PublicMediaGalleryArea,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token && !config.headers.skipAuth) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    localStorage.removeItem('auth_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getMediaOrigin(): string {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
    if (apiBase.startsWith('/')) {
      return window.location.origin;
    }
    try {
      return new URL(apiBase).origin;
    } catch {
      return window.location.origin;
    }
  }

  private normalizeMediaUrl(url: string | null | undefined): string {
    if (!url || String(url).toLowerCase() === 'null') return '';
    const origin = this.getMediaOrigin();
    if (url.startsWith('/media/')) return `${origin}${url}`;
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/media/')) {
        return `${origin}${parsed.pathname}`;
      }
    } catch {
      // Ignore parse errors and keep original value.
    }
    return url;
  }

  private normalizeSubmissionMedia<T extends { media?: Array<{ url: string }> }>(items: T[]): T[] {
    return items.map((item) => ({
      ...item,
      media: (item.media || []).map((m) => ({
        ...m,
        url: this.normalizeMediaUrl(m.url),
      })),
    }));
  }

  // Auth endpoints
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.post('/auth/register', data, {
      headers: { skipAuth: true },
    } as AxiosRequestConfig);
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post('/auth/login', data, {
      headers: { skipAuth: true },
    } as AxiosRequestConfig);
    return response.data;
  }

  // Game endpoints
  async getGameStatus(): Promise<GameStatus> {
    const response = await this.client.get('/game/status');
    return response.data;
  }

  async startGame(data: StartGameRequest): Promise<GameStatus> {
    const response = await this.client.post('/game/start', data);
    return response.data;
  }

  async publishResults(): Promise<{ message: string }> {
    const response = await this.client.post('/game/publish');
    return response.data;
  }

  // Areas endpoints
  async getAreasGeoJSON(): Promise<AreasGeoJSON> {
    const response = await this.client.get('/areas/geojson');
    return response.data;
  }

  async getAreaDetail(areaId: number): Promise<Area> {
    const response = await this.client.get(`/areas/${areaId}`);
    return response.data;
  }

  // Submissions endpoints
  async createSubmission(
    areaId: number,
    text: string,
    score: number | null,
    files: File[],
    onUploadProgress?: (percent: number) => void,
  ): Promise<Submission> {
    const formData = new FormData();
    formData.append('area_id', areaId.toString());
    formData.append('text', text);
    if (score !== null) {
      formData.append('score', score.toString());
    }
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        formData.append('photos', file);
      } else if (file.type.startsWith('video/')) {
        formData.append('videos', file);
      }
    });

    const token = localStorage.getItem('auth_token');
    const formUrl = `${API_BASE_URL}/submissions/`;
    const formResponse = await axios.post(formUrl, formData, {
      headers: { 'Authorization': `Bearer ${token}` },
      onUploadProgress: onUploadProgress
        ? (e) => {
            const pct = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
            onUploadProgress(pct);
          }
        : undefined,
    });
    return formResponse.data;
  }

  async getMySubmissions(): Promise<Submission[]> {
    const response = await this.client.get('/submissions/my');
    return this.normalizeSubmissionMedia(response.data.submissions || []);
  }

  async getAreaSubmissions(areaId: number): Promise<Submission[]> {
    const response = await this.client.get(`/submissions/area/${areaId}`);
    return this.normalizeSubmissionMedia(response.data.submissions || []);
  }

  async getAllSubmissions(): Promise<Submission[]> {
    const response = await this.client.get('/admin/submissions/pending');
    return this.normalizeSubmissionMedia(response.data.pending_submissions || []);
  }

  async reviewSubmission(submissionId: number, data: ReviewSubmissionRequest): Promise<any> {
    const endpoint = data.approved 
      ? `/admin/submissions/${submissionId}/approve`
      : `/admin/submissions/${submissionId}/reject`;
    const response = await this.client.post(endpoint, {
      message: data.admin_feedback || null
    });
    return response.data;
  }

  async getPendingCount(): Promise<PendingCount> {
    const response = await this.client.get('/admin/submissions/pending');
    return { count: response.data.count || 0 };
  }

  // Leaderboard endpoints
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const response = await this.client.get('/leaderboard/');
    return response.data.leaderboard; // Extract leaderboard array from response
  }

  // Cooldown endpoints
  async getMyCooldowns(): Promise<AreaCooldown[]> {
    const response = await this.client.get('/submissions/cooldowns');
    return response.data;
  }

  // Join requests (if implemented)
  async getJoinRequests(): Promise<JoinRequest[]> {
    const response = await this.client.get('/join/requests');
    return response.data;
  }

  async approveJoinRequest(requestId: number): Promise<{ message: string }> {
    const response = await this.client.post(`/join/requests/${requestId}/approve`);
    return response.data;
  }

  // Admin endpoints
  async exportGameZip(sessionId: number): Promise<Blob> {
    const response = await this.client.get(`/sessions/${sessionId}/export`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadAutoExport(sessionId: number): Promise<Blob> {
    const response = await this.client.get(`/sessions/${sessionId}/export/auto`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Session endpoints
  async getCities(): Promise<City[]> {
    const response = await this.client.get('/sessions/cities');
    return response.data;
  }

  async getAllSessions(): Promise<SessionResponse[]> {
    const response = await this.client.get('/sessions');
    return response.data;
  }

  async createSession(data: CreateSessionRequest): Promise<SessionResponse> {
    const response = await this.client.post('/sessions', data);
    return response.data;
  }

  async getSession(joinCode: string): Promise<SessionResponse> {
    const response = await this.client.get(`/sessions/public/${joinCode}`, {
      headers: { skipAuth: true },
    } as AxiosRequestConfig);
    return response.data;
  }

  async getSessionTeams(sessionId: number): Promise<SessionTeam[]> {
    const response = await this.client.get(`/sessions/${sessionId}/teams`);
    return response.data;
  }

  async getPublicResults(joinCode: string): Promise<PublicResultsResponse> {
    const response = await this.client.get(`/results/${joinCode}`, {
      headers: { skipAuth: true },
    } as AxiosRequestConfig);
    return response.data;
  }

  async getPublicMediaGallery(joinCode: string): Promise<PublicMediaGalleryArea[]> {
    const response = await this.client.get(`/results/${joinCode}/media`, {
      headers: { skipAuth: true },
    } as AxiosRequestConfig);
    return response.data;
  }

  async getCityPointsConfig(cityId: number): Promise<CityPointsConfig> {
    const response = await this.client.get(`/sessions/cities/${cityId}/points-config`);
    return response.data;
  }

  async updateCityPointsConfig(cityId: number, data: UpdateCityPointsConfigRequest): Promise<CityPointsConfig> {
    const response = await this.client.put(`/sessions/cities/${cityId}/points-config`, data);
    return response.data;
  }

  async startSession(sessionId: number, additionalAdminTeamIds: number[] = []): Promise<StartSessionResponse> {
    const response = await this.client.post(`/sessions/${sessionId}/start`, {
      additional_admin_team_ids: additionalAdminTeamIds,
    });
    return response.data;
  }

  async extendSession(sessionId: number, minutes: number): Promise<{ message: string; new_end_time: string }> {
    const response = await this.client.post(`/sessions/${sessionId}/extend`, { minutes });
    return response.data;
  }

  async pauseSession(sessionId: number): Promise<{ message: string }> {
    const response = await this.client.post(`/sessions/${sessionId}/pause`);
    return response.data;
  }

  async resumeSession(sessionId: number): Promise<{ message: string; new_end_time: string }> {
    const response = await this.client.post(`/sessions/${sessionId}/resume`);
    return response.data;
  }

  async stopSession(sessionId: number): Promise<{ message: string }> {
    const response = await this.client.post(`/sessions/${sessionId}/stop`);
    return response.data;
  }

  async joinGame(joinCode: string, data: { team_name: string; password: string; color: string }): Promise<{
    team_id: number;
    team_name: string;
    team_color: string;
    auth_token: string;
    session_id: number;
    city_name: string;
    game_started: boolean;
  }> {
    const response = await this.client.post(`/join/${joinCode}`, data, {
      headers: { skipAuth: true },
    } as AxiosRequestConfig);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
