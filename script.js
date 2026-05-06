// ── Firebase ──
const firebaseConfig = {
    apiKey: "AIzaSyBLKZWIOPPKr18-mVQc4xe_Z4Hd39GciNU",
    authDomain: "urvi-955a9.firebaseapp.com",
    databaseURL: "https://urvi-955a9-default-rtdb.firebaseio.com",
    projectId: "urvi-955a9",
    storageBucket: "urvi-955a9.firebasestorage.app",
    messagingSenderId: "603036789816",
    appId: "1:603036789816:web:e18d5452f9e94338898acd"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ── State ──
let currentUserId = null;
let currentUserData = null;

// ── Session check on load ──
window.onload = function () {
    const savedId = localStorage.getItem('urvi_user_id');
    const savedRole = localStorage.getItem('urvi_role');
    if (savedId && savedRole) redirectByRole(savedRole);

    // Enter key submits login
    document.getElementById('password').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('credentialId').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') handleLogin();
    });
};

// ── Login Handler ──
async function handleLogin() {
    const id = document.getElementById('credentialId').value.trim().toUpperCase();
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    const btn = document.getElementById('loginBtn');

    errorMsg.innerText = '';
    errorMsg.style.color = '#ff5252';

    if (!id || !pass) {
        errorMsg.innerText = 'Please enter both your Credential ID and Password.';
        shakeCard();
        return;
    }

    // Loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Connecting...';

    try {
        const snapshot = await database.ref('users/' + id).once('value');
        const userData = snapshot.val();

        if (!userData) {
            showError('Credential ID not found. Check and try again.');
            resetBtn(btn);
            return;
        }

        const dbPass = userData.password ? userData.password.toString() : '';
        if (dbPass !== pass) {
            showError('Incorrect password. Please try again.');
            resetBtn(btn);
            return;
        }

        // ✅ Correct credentials
        currentUserId = id;
        currentUserData = userData;

        // First-time login: force password change
        if (userData.password_changed === false && pass === 'welcome@urvi') {
            resetBtn(btn);
            showUpdatePasswordScreen();
        } else {
            // Save session and redirect
            localStorage.setItem('urvi_user_id', id);
            localStorage.setItem('urvi_role', userData.role);
            localStorage.setItem('urvi_name', userData.name || id);
            redirectByRole(userData.role);
        }

    } catch (e) {
        console.error('Login error:', e);
        showError('Connection error. Check your internet and try again.');
        resetBtn(btn);
    }
}

// ── Password Update Handler ──
async function handlePasswordUpdate() {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const errorMsg = document.getElementById('error-msg');
    const btn = document.getElementById('updateBtn');

    errorMsg.style.color = '#ff5252';

    if (newPass.length < 6) {
        showError('Password must be at least 6 characters long.');
        return;
    }
    if (newPass !== confirmPass) {
        showError('Passwords do not match. Please re-enter.');
        return;
    }
    if (newPass === 'welcome@urvi') {
        showError('You cannot keep the default password. Choose something unique.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';

    try {
        await database.ref('users/' + currentUserId).update({
            password: newPass,
            password_changed: true
        });
        localStorage.setItem('urvi_user_id', currentUserId);
        localStorage.setItem('urvi_role', currentUserData.role);
        localStorage.setItem('urvi_name', currentUserData.name || currentUserId);
        redirectByRole(currentUserData.role);
    } catch (error) {
        console.error('Update error:', error);
        showError('Failed to update password. Try again.');
        btn.disabled = false;
        btn.innerHTML = 'Update & Enter';
    }
}

// ── UI Helpers ──
function showUpdatePasswordScreen() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('update-password-form').style.display = 'block';
    const msg = document.getElementById('error-msg');
    msg.style.color = '#00e5ff';
    msg.innerText = 'First login detected — please set a secure password to continue.';
}

function redirectByRole(role) {
    if (role === 'admin') {
        window.location.href = 'admin_dashboard.html';
    } else if (role === 'team_head') {
        window.location.href = 'head_dashboard.html';
    } else {
        window.location.href = 'member_dashboard.html';
    }
}

function showError(msg) {
    const el = document.getElementById('error-msg');
    el.style.color = '#ff5252';
    el.innerText = msg;
    shakeCard();
}

function shakeCard() {
    const card = document.querySelector('.login-card');
    card.classList.remove('shake');
    void card.offsetWidth; // reflow to restart animation
    card.classList.add('shake');
}

function resetBtn(btn) {
    btn.disabled = false;
    btn.innerHTML = 'Connect &rarr;';
}

function togglePassword(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        iconEl.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}