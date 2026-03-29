// API client module
const API_BASE_URL = 'http://localhost:8000';

class ApiClient {
    constructor() {
        // Token wordt dynamisch opgehaald uit localStorage
        console.log('[API Client] v2.0 - Session management enabled');
    }

    setToken(token) {
        localStorage.setItem('auth_token', token);
    }

    clearToken() {
        localStorage.removeItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const headers = {
            ...options.headers,
        };

        // Haal token dynamisch op uit localStorage voor elke request
        const token = localStorage.getItem('auth_token');
        if (token && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Don't set Content-Type for FormData
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Request failed' }));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Auth endpoints
    async register(name, password, color) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, password, color }),
            skipAuth: true,
        });
    }

    async login(name, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ name, password }),
            skipAuth: true,
        });
    }

    // Game endpoints
    async getGameStatus() {
        return this.request('/game/status');
    }

    async startGame(durationMinutes) {
        return this.request('/game/start', {
            method: 'POST',
            body: JSON.stringify({ duration_minutes: durationMinutes }),
        });
    }

    async publishResults() {
        return this.request('/game/publish', {
            method: 'POST',
        });
    }

    // Areas endpoints
    async getAreasGeoJSON() {
        return this.request('/areas/geojson');
    }

    async getAreaDetail(areaId) {
        return this.request(`/areas/${areaId}`);
    }

    // Submissions endpoints
    async createSubmission(areaId, text, score, photos, videos) {
        const formData = new FormData();
        formData.append('area_id', areaId);
        formData.append('text', text);
        
        if (score !== null && score !== undefined && score !== '') {
            formData.append('score', score);
        }

        // Add photos
        if (photos && photos.length > 0) {
            for (let photo of photos) {
                formData.append('photos', photo);
            }
        }

        // Add videos
        if (videos && videos.length > 0) {
            for (let video of videos) {
                formData.append('videos', video);
            }
        }

        return this.request('/submissions/', {
            method: 'POST',
            body: formData,
        });
    }

    async getMySubmissions() {
        return this.request('/submissions/my');
    }

    async getSubmissionsForArea(areaId) {
        return this.request(`/submissions/area/${areaId}`);
    }

    // Leaderboard endpoint
    async getLeaderboard() {
        return this.request('/leaderboard/');
    }

    // Admin endpoints
    async getPendingSubmissions() {
        return this.request('/admin/submissions/pending');
    }

    async approveSubmission(submissionId, message = null) {
        return this.request(`/admin/submissions/${submissionId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }

    async rejectSubmission(submissionId, message = null) {
        return this.request(`/admin/submissions/${submissionId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }

    async exportGameData() {
        const response = await this.request('/admin/export');
        return response.blob();
    }

    // Session endpoints
    async getCities() {
        return this.request('/api/sessions/cities', {
            skipAuth: true
        });
    }

    async createSession(cityId, durationMinutes) {
        return this.request('/api/sessions', {
            method: 'POST',
            body: JSON.stringify({ 
                city_id: cityId, 
                duration_minutes: durationMinutes 
            }),
        });
    }

    async listSessions() {
        return this.request('/api/sessions');
    }

    async getSession(sessionId) {
        return this.request(`/api/sessions/${sessionId}`);
    }

    async startSession(sessionId) {
        return this.request(`/api/sessions/${sessionId}/start`, {
            method: 'POST',
        });
    }

    async deleteSession(sessionId) {
        return this.request(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    }

    // Join endpoints
    async getSessionInfo(joinCode) {
        return this.request(`/join/${joinCode}/info`, {
            skipAuth: true,
        });
    }

    async joinGame(joinCode, teamName, password, color) {
        return this.request(`/join/${joinCode}`, {
            method: 'POST',
            body: JSON.stringify({ 
                team_name: teamName, 
                password, 
                color 
            }),
            skipAuth: true,
        });
    }
}

export const api = new ApiClient();
