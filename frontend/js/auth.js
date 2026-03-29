// Auth module
import { api } from './api.js';

let currentUser = null;

export function initAuth() {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('current_user');
    
    if (token && userStr) {
        currentUser = JSON.parse(userStr);
        showAppScreen();
        window.initAppModules();
    } else {
        showAuthScreen();
    }

    setupAuthListeners();
}

function setupAuthListeners() {
    // Switch between login and register
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });

    // Login
    document.getElementById('login-btn').addEventListener('click', async () => {
        const name = document.getElementById('login-name').value.trim();
        const password = document.getElementById('login-password').value;

        if (!name || !password) {
            showAuthError('Vul alle velden in');
            return;
        }

        try {
            const response = await api.login(name, password);
            handleAuthSuccess(response);
        } catch (error) {
            showAuthError(error.message);
        }
    });

    // Register
    document.getElementById('register-btn').addEventListener('click', async () => {
        const name = document.getElementById('register-name').value.trim();
        const password = document.getElementById('register-password').value;
        const color = document.getElementById('register-color').value;

        if (!name || !password) {
            showAuthError('Vul alle velden in');
            return;
        }

        if (password.length < 6) {
            showAuthError('Wachtwoord moet minimaal 6 tekens zijn');
            return;
        }

        try {
            const response = await api.register(name, password, color);
            handleAuthSuccess(response);
        } catch (error) {
            showAuthError(error.message);
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        logout();
    });

    // Admin panel button
    document.getElementById('admin-panel-btn').addEventListener('click', () => {
        window.location.href = '/admin.html';
    });
}

function handleAuthSuccess(response) {
    api.setToken(response.access_token);
    
    currentUser = {
        id: response.team_id,
        name: response.team_name,
        is_admin: response.is_admin,
    };
    
    localStorage.setItem('current_user', JSON.stringify(currentUser));
    
    showAppScreen();
    window.initAppModules();
}

function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    
    setTimeout(() => {
        errorEl.classList.remove('show');
    }, 5000);
}

function showAuthScreen() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('app-screen').style.display = 'none';
}

function showAppScreen() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    
    // Update profile
    if (currentUser) {
        document.getElementById('profile-name').textContent = currentUser.name;
        document.getElementById('profile-role').textContent = 
            currentUser.is_admin ? 'Admin' : 'Team';
        
        if (currentUser.is_admin) {
            document.getElementById('admin-panel-btn').style.display = 'block';
        }
    }
}

export function logout() {
    api.clearToken();
    localStorage.removeItem('current_user');
    currentUser = null;
    window.location.reload();
}

export function getCurrentUser() {
    return currentUser;
}
