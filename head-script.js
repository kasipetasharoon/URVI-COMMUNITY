// ── Firebase Config ──
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
const db = firebase.database();

const myId = localStorage.getItem('urvi_user_id');
let allUsers = {}, allTasks = {}, allReports = {}, allTeams = {}, myTeamId = null;
let currentTaskFilter = 'active', tempBase64DP = null;
let lastAnnouncementSeen = parseInt(localStorage.getItem('urvi_last_ann') || '0');

// ── Boot ──
window.onload = async () => {
    const snap = await db.ref('users/' + myId).once('value');
    const me = snap.val();
    if (!me) { window.location.href = 'login.html'; return; }
    myTeamId = me.team_id;
    updateHeaderUI(me);
    fetchData();
};

// ── Data Fetching ──
function fetchData() {
    db.ref('users').on('value', snap => {
        allUsers = snap.val() || {};
        renderMyTeam();
        renderGlobalLeaderboard();
        renderTeamLeaderboard();
        updateHeaderUI(allUsers[myId]);
        updateStats();
        updateMyScoreCard();
    });
    db.ref('teams').on('value', snap => {
        allTeams = snap.val() || {};
        updateTeamName();
    });
    db.ref('tasks').orderByChild('team_id').equalTo(myTeamId).on('value', snap => {
        allTasks = snap.val() || {};
        renderTasks();
        updateSubmitDropdown();
        updateStats();
        updateTaskBadge();
    });
    db.ref('reports').on('value', snap => {
        allReports = snap.val() || {};
        renderSubmissions();
        updateMyScoreCard(); // refresh verified subs count once reports are loaded
    });
    db.ref('announcements').on('value', snap => {
        renderAnnouncements(snap.val() || {});
    });
}

// ── Header UI ──
function updateHeaderUI(me) {
    if (!me) return;
    const firstName = (me.name || 'Head').split(' ')[0];
    if (document.getElementById('header-name')) document.getElementById('header-name').innerText = firstName;
    if (me.dp_url) {
        if (document.getElementById('header-dp')) document.getElementById('header-dp').src = me.dp_url;
        if (document.getElementById('mobile-header-dp')) document.getElementById('mobile-header-dp').src = me.dp_url;
    }
}

function updateTeamName() {
    const teamName = allTeams[myTeamId]?.team_name || 'My Team';
    if (document.getElementById('my-team-header-name')) document.getElementById('my-team-header-name').innerText = teamName;
    if (document.getElementById('my-team-name-label')) document.getElementById('my-team-name-label').innerText = teamName + ' — Team Head';
}

function updateMyScoreCard() {
    const me = allUsers[myId];
    if (!me) return;
    if (document.getElementById('my-score-name')) document.getElementById('my-score-name').innerText = me.name || 'Team Head';
    if (document.getElementById('my-personal-score')) document.getElementById('my-personal-score').innerText = me.total_score || 0;
    if (me.dp_url && document.getElementById('my-score-avatar')) document.getElementById('my-score-avatar').src = me.dp_url;
    const verifiedSubs = Object.values(allReports || {}).filter(r => r.submitted_by === myId && r.status === 'verified').length;
    if (document.getElementById('my-subs-label')) document.getElementById('my-subs-label').innerText = verifiedSubs + ' verified submission' + (verifiedSubs !== 1 ? 's' : '');
}

function updateTaskBadge() {
    const activeTasks = Object.values(allTasks).filter(t => t.status === 'active').length;
    const badge = document.getElementById('task-badge');
    if (badge) { badge.innerText = activeTasks; badge.style.display = activeTasks > 0 ? 'inline' : 'none'; }
}

// ── Navigation ──
function showSection(id, element) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    if (element) element.classList.add('active');
    // Get only the direct text nodes (strips badge span text)
    const title = Array.from(element.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('') || id;
    if (document.getElementById('section-title')) document.getElementById('section-title').innerText = title;
    if (document.getElementById('mobile-section-title')) document.getElementById('mobile-section-title').innerText = title;
    // Clear ann badge when announcements opened
    if (id === 'announcements') {
        const badge = document.getElementById('ann-badge');
        if (badge) badge.style.display = 'none';
        localStorage.setItem('urvi_last_ann', Date.now().toString());
        lastAnnouncementSeen = Date.now();
    }
    const sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('active')) toggleSidebar();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// ── Profile ──
function openMyProfile() {
    const me = allUsers[myId];
    if (!me) return;
    document.getElementById('my_name').value = me.name || '';
    document.getElementById('my_insta').value = me.insta_id || '';
    document.getElementById('my_college').value = me.college || '';
    document.getElementById('my_phone').value = me.ph_no || '';
    document.getElementById('my_dp_preview').src = me.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    tempBase64DP = me.dp_url || null;
    openModal('myProfileModal');
}

function compressAndPreviewDP(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 150; canvas.height = 150;
            canvas.getContext('2d').drawImage(img, 0, 0, 150, 150);
            tempBase64DP = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('my_dp_preview').src = tempBase64DP;
        };
    };
}

async function saveMyProfile() {
    await db.ref('users/' + myId).update({
        name: document.getElementById('my_name').value.trim(),
        insta_id: document.getElementById('my_insta').value.trim(),
        college: document.getElementById('my_college').value.trim(),
        ph_no: document.getElementById('my_phone').value.trim(),
        dp_url: tempBase64DP
    });
    closeModal('myProfileModal');
    triggerNotification('Profile Saved', 'Your changes have been updated.');
}

// ── View Any User Profile ──
function viewUserProfile(uid) {
    const u = allUsers[uid];
    if (!u) return;
    document.getElementById('vu_dp').src = u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    document.getElementById('vu_name').innerText = u.name || 'N/A';
    document.getElementById('vu_role').innerText = u.role ? u.role.replace(/_/g, ' ').toUpperCase() : 'MEMBER';
    document.getElementById('vu_team').innerText = allTeams[u.team_id]?.team_name || 'Unassigned';
    document.getElementById('vu_score').innerText = u.total_score || 0;
    document.getElementById('vu_subs').innerText = Object.values(allReports || {}).filter(r => r.submitted_by === uid).length;
    document.getElementById('vu_college').innerText = u.college || 'N/A';
    document.getElementById('vu_phone').innerText = u.ph_no || '-';
    document.getElementById('vu_email').innerText = u.email || '-';
    const instaLink = u.insta_id
        ? '<a href="https://instagram.com/' + u.insta_id.replace('@','') + '" target="_blank" style="color:var(--primary-teal);text-decoration:none;"><i class="fab fa-instagram"></i> ' + u.insta_id + '</a>'
        : 'Not Linked';
    document.getElementById('vu_insta').innerHTML = instaLink;
    openModal('viewUserModal');
}

// ── Render: My Team Table ──
function renderMyTeam() {
    const tbody = document.getElementById('my-team-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const assigneeSelect = document.getElementById('it_assignee');
    if (assigneeSelect) assigneeSelect.innerHTML = '<option value="entire_team">Entire Team (Everyone)</option>';

    const teamMembers = Object.keys(allUsers).filter(uid => allUsers[uid].team_id === myTeamId);
    if (teamMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);padding:30px;">No team members found.</td></tr>';
        return;
    }
    teamMembers.forEach(uid => {
        const u = allUsers[uid];
        const subs = Object.values(allReports).filter(r => r.submitted_by === uid).length;
        const isMe = uid === myId ? ' style="background:rgba(0,229,255,0.04);"' : '';
        tbody.innerHTML += '<tr' + isMe + '>' +
            '<td><img src="' + (u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #00e5ff;cursor:pointer;" onclick="viewUserProfile(\'' + uid + '\')"></td>' +
            '<td><span class="user-link" onclick="viewUserProfile(\'' + uid + '\')">' + (u.name || uid) + '</span>' + (uid === myId ? ' <span style="font-size:0.65rem;background:rgba(0,229,255,0.15);color:#00e5ff;padding:1px 7px;border-radius:10px;">You</span>' : '') + '</td>' +
            '<td style="color:#8ab4f8;font-size:0.82rem;">' + (u.role || 'member').replace(/_/g, ' ') + '</td>' +
            '<td>' + subs + '</td>' +
            '<td><strong style="color:#00e5ff;">' + (u.total_score || 0) + '</strong></td>' +
            '</tr>';
        if (uid !== myId && assigneeSelect) assigneeSelect.innerHTML += '<option value="' + uid + '">' + u.name + '</option>';
    });
}

// ── Render: Global Leaderboard ──
function renderGlobalLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    const ranked = Object.keys(allUsers)
        .map(id => ({ id, name: allUsers[id].name, score: parseInt(allUsers[id].total_score) || 0, team_id: allUsers[id].team_id, dp_url: allUsers[id].dp_url }))
        .sort((a, b) => b.score - a.score).slice(0, 3);
    if (ranked.length === 0 || ranked[0].score === 0) { container.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:0.85rem;text-align:center;">No scores yet.</p>'; return; }
    const medals = ['🥇','🥈','🥉'];
    container.innerHTML = ranked.map((u, i) =>
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:9px;"><span style="font-size:1.1rem;">' + medals[i] + '</span>' +
        '<img src="' + (u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid #00e5ff;">' +
        '<span class="user-link" onclick="viewUserProfile(\'' + u.id + '\')">' + u.name + '</span></div>' +
        '<b style="color:#00e5ff;">' + u.score + ' pts</b></div>'
    ).join('');
}

// ── Render: Team Leaderboard ──
function renderTeamLeaderboard() {
    const container = document.getElementById('team-leaderboard-container');
    if (!container) return;
    const members = Object.keys(allUsers)
        .filter(uid => allUsers[uid].team_id === myTeamId)
        .map(uid => ({ uid, name: allUsers[uid].name, score: parseInt(allUsers[uid].total_score) || 0, dp_url: allUsers[uid].dp_url }))
        .sort((a, b) => b.score - a.score);
    if (members.length === 0) { container.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:0.85rem;text-align:center;">No members yet.</p>'; return; }
    container.innerHTML = members.map((m, i) =>
        '<div class="team-rank-row">' +
        '<div style="display:flex;align-items:center;gap:9px;">' +
        '<span style="color:#8ab4f8;font-size:0.75rem;width:18px;">#' + (i+1) + '</span>' +
        '<img src="' + (m.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">' +
        '<span class="user-link" style="font-size:0.85rem;" onclick="viewUserProfile(\'' + m.uid + '\')">' + m.name + (m.uid === myId ? ' <span style="font-size:0.6rem;color:#00e5ff;">(You)</span>' : '') + '</span></div>' +
        '<b style="color:#ffb74d;font-size:0.85rem;">' + m.score + ' pts</b></div>'
    ).join('');
}

// ── Render: Tasks ──
function filterTaskView(s) {
    currentTaskFilter = s;
    document.getElementById('tab-active').classList.toggle('active', s === 'active');
    document.getElementById('tab-completed').classList.toggle('active', s === 'completed');
    renderTasks();
}

function renderTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    container.innerHTML = '';
    const search = (document.getElementById('searchTask')?.value || '').toLowerCase();
    let count = 0;
    Object.keys(allTasks).forEach(id => {
        const t = allTasks[id];
        if (t.status !== currentTaskFilter) return;
        if (search && !t.title.toLowerCase().includes(search)) return;
        count++;
        const assignedText = t.assigned_to === 'entire_team' ? 'Entire Team' : (allUsers[t.assigned_to]?.name || 'Unknown');
        const isMine = t.assigned_by === myId;
        const desc = t.description ? '<p class="task-desc-preview">' + t.description + '</p>' : '';
        const markBtn = (t.status === 'active' && isMine)
            ? '<button class="action-btn" style="width:100%;background:transparent;color:#00e5ff;border:1px solid rgba(0,229,255,0.35);padding:8px;font-size:0.82rem;" onclick="event.stopPropagation();db.ref(\'tasks/' + id + '/status\').set(\'completed\')">&#10003; Mark Done</button>'
            : (t.status === 'completed' && isMine ? '<button class="action-btn" style="width:100%;background:transparent;color:#8ab4f8;border:1px solid rgba(255,255,255,0.1);padding:8px;font-size:0.82rem;" onclick="event.stopPropagation();db.ref(\'tasks/' + id + '/status\').set(\'active\')">&#8635; Reactivate</button>' : '');
        container.innerHTML += '<div class="item-card" style="cursor:default;' + (t.status === 'completed' ? 'opacity:0.75;' : '') + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
            '<h4 style="flex:1;margin-right:8px;font-size:0.95rem;">' + t.title + '</h4>' +
            '<span class="' + (t.status === 'active' ? 'badge-active' : 'badge-done') + '">' + t.status + '</span></div>' +
            desc +
            '<p style="font-size:0.78rem;color:#8ab4f8;margin-bottom:10px;">&#128100; ' + assignedText + (isMine ? ' <span style="font-size:0.65rem;color:#00e5ff;">(Assigned by you)</span>' : '') + '</p>' +
            markBtn + '</div>';
    });
    if (count === 0) container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128203;</div><h3>No ' + currentTaskFilter + ' tasks</h3><p>Assign a new task to get started.</p></div>';
}

// ── Render: Submissions ──
function renderSubmissions() {
    const container = document.getElementById('submissions-container');
    if (!container) return;
    container.innerHTML = '';
    let count = 0;
    Object.keys(allReports).forEach(rid => {
        const r = allReports[rid];
        if (allUsers[r.submitted_by]?.team_id !== myTeamId) return;
        count++;
        const task = allTasks[r.task_id];
        const taskTitle = task ? task.title : 'General Submission';
        const statusClass = r.status === 'verified' ? 'verified' : r.status === 'rejected' ? 'rejected' : 'pending';
        const leftColor = r.status === 'verified' ? '#00e5ff' : r.status === 'rejected' ? '#ff4d4d' : '#ffb74d';
        const scorePill = r.status === 'verified' && r.score ? '<div class="score-pill">&#11088; ' + r.score + ' pts awarded</div>' : '';
        const feedbackBlock = r.admin_review ? '<div style="background:rgba(0,0,0,0.2);padding:10px;border-left:3px solid ' + leftColor + ';border-radius:4px;margin-top:10px;"><p style="font-size:0.8rem;font-style:italic;color:#ccc;">"' + r.admin_review + '"</p></div>' : '';
        const d = r.timestamp ? new Date(r.timestamp) : null;
        const dateStr = d ? d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
        container.innerHTML += '<div class="item-card" style="border-left:4px solid ' + leftColor + ';">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
            '<img src="' + (allUsers[r.submitted_by]?.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid ' + leftColor + ';cursor:pointer;" onclick="viewUserProfile(\'' + r.submitted_by + '\')">' +
            '<div><h4 class="user-link" onclick="viewUserProfile(\'' + r.submitted_by + '\')" style="font-size:0.9rem;">' + (allUsers[r.submitted_by]?.name || r.submitted_by) + '</h4>' +
            '<small style="color:#8ab4f8;font-size:0.7rem;">' + dateStr + '</small></div>' +
            '<span class="sub-status-badge ' + statusClass + '" style="margin-left:auto;">' + r.status + '</span></div>' +
            '<div style="background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.1);padding:10px;border-radius:8px;margin-bottom:10px;">' +
            '<p style="font-size:0.68rem;color:#00e5ff;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">For Task:</p>' +
            '<h4 style="font-size:0.9rem;">' + taskTitle + '</h4></div>' +
            '<p style="font-size:0.85rem;color:#ccc;margin-bottom:10px;"><b>Note:</b> ' + (r.description || 'No notes.') + '</p>' +
            '<a href="' + r.submission_link + '" target="_blank" style="display:inline-block;font-size:0.82rem;color:#00e5ff;text-decoration:underline;margin-bottom:8px;"><i class="fas fa-external-link-alt"></i> View Work</a>' +
            scorePill + feedbackBlock + '</div>';
    });
    if (count === 0) container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128196;</div><h3>No submissions yet</h3><p>Team members\' work will appear here once submitted.</p></div>';
}

// ── Render: Announcements ──
function renderAnnouncements(data) {
    const container = document.getElementById('ann-container');
    if (!container) return;
    const items = Object.entries(data).sort((a, b) => b[1].timestamp - a[1].timestamp);
    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128227;</div><h3>No announcements</h3><p>Admin announcements will appear here.</p></div>';
        return;
    }
    // Check for new ones
    const latestTs = items[0][1].timestamp;
    const annBadge = document.getElementById('ann-badge');
    if (annBadge && latestTs > lastAnnouncementSeen) annBadge.style.display = 'inline';

    container.innerHTML = items.map(([id, a]) => {
        const d = a.timestamp ? new Date(a.timestamp) : null;
        const dateStr = d ? d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
        const isNew = a.timestamp > lastAnnouncementSeen;
        return '<div class="ann-box">' + (isNew ? '<span style="font-size:0.6rem;background:#00e5ff;color:#000;padding:1px 8px;border-radius:10px;font-weight:700;margin-bottom:6px;display:inline-block;">NEW</span><br>' : '') +
            '<h4>' + a.title + '</h4><p>' + a.body + '</p><small><i class="fas fa-clock"></i> ' + dateStr + '</small></div>';
    }).join('');
}

// ── Stats ──
function updateStats() {
    let teamSize = 0, teamScore = 0, activeTaskCount = 0;
    Object.values(allUsers).forEach(u => {
        if (u.team_id === myTeamId) { teamSize++; teamScore += parseInt(u.total_score) || 0; }
    });
    Object.values(allTasks).forEach(t => { if (t.status === 'active') activeTaskCount++; });
    if (document.getElementById('stat-team-size')) document.getElementById('stat-team-size').innerText = teamSize;
    if (document.getElementById('stat-team-score')) document.getElementById('stat-team-score').innerText = teamScore;
    if (document.getElementById('stat-tasks')) document.getElementById('stat-tasks').innerText = activeTaskCount;
}

// ── Task / Submit Actions ──
function updateSubmitDropdown() {
    const select = document.getElementById('sw_task');
    if (!select) return;
    select.innerHTML = '<option value="">Select a task...</option>';
    Object.keys(allTasks).forEach(tid => {
        if (allTasks[tid].status === 'active') select.innerHTML += '<option value="' + tid + '">' + allTasks[tid].title + '</option>';
    });
}

async function saveInternalTask() {
    const title = document.getElementById('it_title').value.trim();
    if (!title) return alert('Task title is required.');
    await db.ref('tasks').push().set({
        title,
        description: document.getElementById('it_desc').value.trim(),
        team_id: myTeamId,
        assigned_to: document.getElementById('it_assignee').value,
        assigned_by: myId,
        status: 'active',
        timestamp: new Date().toISOString()
    });
    document.getElementById('it_title').value = '';
    document.getElementById('it_desc').value = '';
    closeModal('internalTaskModal');
    triggerNotification('Task Assigned', 'New task has been added to the board.');
}

function openSubmitModal() {
    updateSubmitDropdown();
    document.getElementById('sw_link').value = '';
    document.getElementById('sw_desc').value = '';
    openModal('submitWorkModal');
}

async function submitReport() {
    const taskId = document.getElementById('sw_task').value;
    const link = document.getElementById('sw_link').value.trim();
    if (!taskId) return alert('Please select a task.');
    if (!link) return alert('Please provide a work link.');
    await db.ref('reports').push().set({
        task_id: taskId,
        submitted_by: myId,
        submission_link: link,
        description: document.getElementById('sw_desc').value.trim(),
        status: 'pending',
        timestamp: Date.now()
    });
    closeModal('submitWorkModal');
    triggerNotification('Submitted!', 'Your work has been sent for review.');
}

// ── Utils ──
function openModal(id) { document.getElementById(id).style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function triggerNotification(title, message, isWarning = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = isWarning ? 'fa-exclamation-circle' : 'fa-check-circle';
    const color = isWarning ? '#ffb74d' : 'var(--primary-teal)';
    toast.style.borderLeftColor = color;
    toast.innerHTML = '<i class="fas ' + icon + '" style="color:' + color + '"></i><div class="toast-content"><h4>' + title + '</h4><p>' + message + '</p></div>';
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 350); }, 3800);
}

// ── Change Password ──
function togglePwSection(btn) {
    const body = btn.nextElementSibling;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    btn.classList.toggle('open', !isOpen);
    if (!isOpen) {
        document.getElementById('cp_current').value = '';
        document.getElementById('cp_new').value = '';
        document.getElementById('cp_confirm').value = '';
        document.getElementById('cp_error').innerText = '';
    }
}
async function changePassword() {
    const current = document.getElementById('cp_current').value;
    const newPw = document.getElementById('cp_new').value;
    const confirm = document.getElementById('cp_confirm').value;
    const errEl = document.getElementById('cp_error');
    errEl.style.color = '#ff4d4d'; errEl.innerText = '';
    if (!current || !newPw || !confirm) { errEl.innerText = 'Please fill all fields.'; return; }
    if (newPw.length < 6) { errEl.innerText = 'New password must be at least 6 characters.'; return; }
    if (newPw !== confirm) { errEl.innerText = 'Passwords do not match.'; return; }
    const snap = await db.ref('users/' + myId).once('value');
    const userData = snap.val();
    if (!userData || userData.password.toString() !== current) { errEl.innerText = 'Current password is incorrect.'; return; }
    if (newPw === current) { errEl.innerText = 'New password must differ from current.'; return; }
    await db.ref('users/' + myId).update({ password: newPw, password_changed: true });
    errEl.style.color = '#00e5ff';
    errEl.innerText = '✓ Password updated successfully!';
    setTimeout(() => { document.getElementById('cp_current').value = ''; document.getElementById('cp_new').value = ''; document.getElementById('cp_confirm').value = ''; errEl.innerText = ''; }, 2500);
    triggerNotification('Password Changed', 'Your password has been updated.', false);
}
function logout() { localStorage.clear(); window.location.href = 'login.html'; }