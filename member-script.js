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
const db = firebase.database();

const myId = localStorage.getItem('urvi_user_id');
let allUsers = {}, allTasks = {}, allReports = {}, allTeams = {};
let myTeamId = null, tempBase64DP = null, isInitialLoad = true;
let lastAnnSeen = parseInt(localStorage.getItem('urvi_last_ann') || '0');

// ── Boot ──
window.onload = async () => {
    if (Notification.permission === 'default') Notification.requestPermission();
    const snap = await db.ref('users/' + myId).once('value');
    const me = snap.val();
    if (!me) { window.location.href = 'login.html'; return; }
    myTeamId = me.team_id;
    updateHeaderUI(me);
    setupListeners();
    setTimeout(() => { isInitialLoad = false; }, 2500);
};

// ── Listeners ──
function setupListeners() {
    db.ref('users').on('value', snap => {
        allUsers = snap.val() || {};
        renderGlobalLeaderboard();
        renderTeamStandings();
        renderTeamDirectory();
        updateHeaderUI(allUsers[myId]);
        updateRankCard();
        updateStats();
    });
    db.ref('teams').on('value', snap => {
        allTeams = snap.val() || {};
        const teamName = allTeams[myTeamId]?.team_name || 'My Team';
        if (document.getElementById('team-name-display')) document.getElementById('team-name-display').innerText = teamName;
    });
    db.ref('tasks').on('value', snap => {
        allTasks = snap.val() || {};
        renderMyTasks();
    });
    db.ref('tasks').on('child_added', snap => {
        const t = snap.val();
        if (!isInitialLoad && t.team_id === myTeamId && (t.assigned_to === 'entire_team' || t.assigned_to === myId)) {
            triggerNotification('New Task!', t.title, false);
            const b = document.getElementById('task-badge');
            if (b) { b.innerText = '!'; b.style.display = 'inline'; }
        }
    });
    db.ref('reports').on('value', snap => {
        allReports = snap.val() || {};
        renderMyReports();
        renderPublicShowcase();
        updateStats();
    });
    db.ref('reports').on('child_changed', snap => {
        const r = snap.val();
        if (!isInitialLoad && r.submitted_by === myId) {
            if (r.status === 'verified') triggerNotification('Work Verified! 🎉', 'Admin awarded you ' + (r.score || 0) + ' points!', false);
            if (r.status === 'rejected') triggerNotification('Submission Returned', 'Admin has feedback on your work.', true);
        }
    });
    db.ref('announcements').on('value', snap => {
        renderAnnouncements(snap.val() || {});
    });
}

// ── Header / Profile ──
function updateHeaderUI(me) {
    if (!me) return;
    const first = (me.name || 'Member').split(' ')[0];
    if (document.getElementById('header-name')) document.getElementById('header-name').innerText = first;
    if (me.dp_url) {
        if (document.getElementById('header-dp')) document.getElementById('header-dp').src = me.dp_url;
        if (document.getElementById('mobile-header-dp')) document.getElementById('mobile-header-dp').src = me.dp_url;
    }
}

function updateRankCard() {
    const me = allUsers[myId];
    if (!me) return;
    const ranked = Object.keys(allUsers)
        .filter(uid => allUsers[uid].role !== 'admin')
        .map(uid => ({ uid, score: parseInt(allUsers[uid].total_score) || 0 }))
        .sort((a, b) => b.score - a.score);
    const myRank = ranked.findIndex(u => u.uid === myId);
    const score = me.total_score || 0;
    const nextMilestone = Math.ceil((score + 1) / 50) * 50;
    if (document.getElementById('rank-dp') && me.dp_url) document.getElementById('rank-dp').src = me.dp_url;
    if (document.getElementById('rank-name')) document.getElementById('rank-name').innerText = me.name || myId;
    if (document.getElementById('rank-team-label')) document.getElementById('rank-team-label').innerText = (allTeams[myTeamId]?.team_name || me.team_id || '') + ' — Member';
    if (document.getElementById('rank-num-display')) document.getElementById('rank-num-display').innerText = myRank >= 0 ? '#' + (myRank + 1) : '#—';
    if (document.getElementById('stat-my-rank')) document.getElementById('stat-my-rank').innerText = myRank >= 0 ? '#' + (myRank + 1) : '—';
    if (document.getElementById('progress-label')) document.getElementById('progress-label').innerText = score + ' / ' + nextMilestone + ' pts';
    const pct = Math.min((score / nextMilestone) * 100, 100);
    if (document.getElementById('score-bar')) document.getElementById('score-bar').style.width = pct + '%';
    // Badges
    const badgesEl = document.getElementById('rank-badges');
    if (badgesEl) {
        const verifiedCount = Object.values(allReports || {}).filter(r => r.submitted_by === myId && r.status === 'verified').length;
        badgesEl.innerHTML =
            '<span class="rank-badge gold">' + score + ' pts</span>' +
            '<span class="rank-badge">' + verifiedCount + ' verified</span>' +
            (myRank === 0 ? '<span class="rank-badge gold">&#127881; Top Scorer</span>' : '');
    }
}

function updateStats() {
    const me = allUsers[myId];
    if (document.getElementById('stat-my-score')) document.getElementById('stat-my-score').innerText = me?.total_score || 0;
    const activeTasks = Object.values(allTasks).filter(t => t.status === 'active' && t.team_id === myTeamId && (t.assigned_to === 'entire_team' || t.assigned_to === myId)).length;
    if (document.getElementById('stat-my-tasks')) document.getElementById('stat-my-tasks').innerText = activeTasks;
    const verified = Object.values(allReports || {}).filter(r => r.submitted_by === myId && r.status === 'verified').length;
    if (document.getElementById('stat-my-verified')) document.getElementById('stat-my-verified').innerText = verified;
    const pending = Object.values(allReports || {}).filter(r => r.submitted_by === myId && r.status === 'pending').length;
    const subBadge = document.getElementById('sub-badge');
    if (subBadge) { subBadge.innerText = pending; subBadge.style.display = pending > 0 ? 'inline' : 'none'; }
}

// ── Navigation ──
function showSection(id, element) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    if (element) element.classList.add('active');
    const title = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).join('') || id;
    if (document.getElementById('section-title')) document.getElementById('section-title').innerText = title;
    if (document.getElementById('mobile-section-title')) document.getElementById('mobile-section-title').innerText = title;
    if (id === 'tasks') { const b = document.getElementById('task-badge'); if (b) b.style.display = 'none'; }
    if (id === 'announcements') { const b = document.getElementById('ann-badge'); if (b) b.style.display = 'none'; localStorage.setItem('urvi_last_ann', Date.now().toString()); lastAnnSeen = Date.now(); }
    const sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('active')) toggleSidebar();
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.toggle('active');
    if (ov) ov.classList.toggle('active');
}

// ── Render: Global Leaderboard ──
function renderGlobalLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    const ranked = Object.keys(allUsers)
        .filter(uid => allUsers[uid].role !== 'admin')
        .map(uid => ({ uid, name: allUsers[uid].name, score: parseInt(allUsers[uid].total_score) || 0, dp_url: allUsers[uid].dp_url, team_id: allUsers[uid].team_id }))
        .sort((a, b) => b.score - a.score).slice(0, 5);
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    if (ranked.length === 0) { container.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:0.85rem;">No scores yet.</p>'; return; }
    container.innerHTML = ranked.map((u, i) => {
        const isMe = u.uid === myId;
        const teamName = (allTeams[u.team_id]?.team_name || u.team_id || '').replace(/_/g, ' ');
        return '<div class="lb-row' + (isMe ? ' is-me' : '') + '">' +
            '<div class="lb-row-left"><span style="font-size:1rem;">' + medals[i] + '</span>' +
            '<img src="' + (u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid #00e5ff;">' +
            '<div><span class="user-link" onclick="viewTeammate(\'' + u.uid + '\')" style="font-size:0.85rem;">' + u.name + (isMe ? ' <span style="font-size:0.62rem;color:#00e5ff;">(You)</span>' : '') + '</span>' +
            '<div style="font-size:0.7rem;color:#8ab4f8;">' + teamName + '</div></div></div>' +
            '<b style="color:#00e5ff;">' + u.score + ' pts</b></div>';
    }).join('');
}

// ── Render: Team Standings ──
function renderTeamStandings() {
    const container = document.getElementById('team-standings-container');
    if (!container) return;
    const members = Object.keys(allUsers)
        .filter(uid => allUsers[uid].team_id === myTeamId)
        .map(uid => ({ uid, name: allUsers[uid].name, score: parseInt(allUsers[uid].total_score) || 0, dp_url: allUsers[uid].dp_url }))
        .sort((a, b) => b.score - a.score);
    if (members.length === 0) { container.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:0.85rem;">No team data.</p>'; return; }
    container.innerHTML = members.map((m, i) => {
        const isMe = m.uid === myId;
        return '<div class="lb-row' + (isMe ? ' is-me' : '') + '">' +
            '<div class="lb-row-left"><span style="color:#8ab4f8;font-size:0.72rem;width:18px;">#' + (i+1) + '</span>' +
            '<img src="' + (m.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">' +
            '<span class="user-link" onclick="viewTeammate(\'' + m.uid + '\')" style="font-size:0.83rem;">' + m.name + (isMe ? ' <span style="font-size:0.6rem;color:#00e5ff;">(You)</span>' : '') + '</span></div>' +
            '<b style="color:#ffb74d;font-size:0.82rem;">' + m.score + ' pts</b></div>';
    }).join('');
}

// ── Render: My Tasks ──
function renderMyTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    container.innerHTML = '';
    let count = 0;
    Object.keys(allTasks).forEach(tid => {
        const t = allTasks[tid];
        if (t.status === 'active' && t.team_id === myTeamId && (t.assigned_to === 'entire_team' || t.assigned_to === myId)) {
            count++;
            const isAdmin = !allUsers[t.assigned_by] || allUsers[t.assigned_by]?.role === 'admin';
            const sourceLabel = isAdmin
                ? '<span class="task-source-admin"><i class="fas fa-crown"></i> Admin Task</span>'
                : '<span class="task-source-head"><i class="fas fa-user-tie"></i> Head Task</span>';
            const scopeLabel = t.assigned_to === 'entire_team'
                ? '<span class="task-scope-badge">Team Task</span>'
                : '<span class="task-scope-badge" style="color:#ffb74d;">Assigned to You</span>';
            const safeTitle = (t.title || '').replace(/'/g, "\\'");
            container.innerHTML +=
                '<div class="item-card">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                '<h4 style="flex:1;margin-right:8px;">' + t.title + '</h4>' + sourceLabel + '</div>' +
                '<div style="margin-bottom:10px;">' + scopeLabel + '</div>' +
                (t.description ? '<p style="font-size:0.85rem;color:rgba(255,255,255,0.55);margin-bottom:14px;line-height:1.5;">' + t.description + '</p>' : '') +
                '<button class="action-btn" style="width:100%;background:#ffb74d;color:#000;box-shadow:0 4px 15px rgba(255,183,77,0.3);" onclick="openSubmitModal(\'' + tid + '\',\'' + safeTitle + '\')">' +
                '<i class="fas fa-upload"></i> Submit My Work</button></div>';
        }
    });
    if (document.getElementById('stat-my-tasks')) document.getElementById('stat-my-tasks').innerText = count;
    if (count === 0) container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#9989;</div><h3>All caught up!</h3><p>No active tasks assigned to you right now.</p></div>';
}

// ── Submit Work ──
function openSubmitModal(taskId, taskTitle) {
    document.getElementById('sw_task_id').value = taskId;
    document.getElementById('sw_task_title').value = taskTitle;
    document.getElementById('sw_link').value = '';
    document.getElementById('sw_desc').value = '';
    document.getElementById('submitWorkModal').style.display = 'block';
}

async function submitReport() {
    const taskId = document.getElementById('sw_task_id').value;
    const link = document.getElementById('sw_link').value.trim();
    if (!taskId || !link) return alert('Please provide a link to your work.');
    await db.ref('reports').push().set({
        task_id: taskId, submitted_by: myId, submission_link: link,
        description: document.getElementById('sw_desc').value.trim(),
        status: 'pending', timestamp: Date.now()
    });
    closeModal('submitWorkModal');
    triggerNotification('Submitted!', 'Your work is waiting for review.', false);
}

// ── Render: My Work History ──
function renderMyReports() {
    const container = document.getElementById('my-reports-container');
    if (!container) return;
    container.innerHTML = '';
    const pendingBubble = document.getElementById('pending-bubble-container');
    const myReps = Object.entries(allReports || {}).filter(([,r]) => r.submitted_by === myId);
    const pendingCount = myReps.filter(([,r]) => r.status === 'pending').length;
    if (pendingBubble) {
        pendingBubble.innerHTML = pendingCount > 0
            ? '<div class="pending-bubble"><i class="fas fa-clock"></i> <strong>' + pendingCount + '</strong> submission' + (pendingCount > 1 ? 's' : '') + ' pending admin review.</div>'
            : '';
    }
    if (myReps.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128196;</div><h3>No submissions yet</h3><p>Upload your work from My Tasks to see history here.</p></div>'; return; }
    myReps.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)).forEach(([rid, r]) => {
        const taskTitle = allTasks[r.task_id]?.title || 'Unknown Task';
        const d = r.timestamp ? new Date(r.timestamp) : null;
        const dateStr = d ? d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
        const leftColor = r.status === 'verified' ? '#00e5ff' : r.status === 'rejected' ? '#ff4d4d' : '#ffb74d';
        const statusIcon = r.status === 'verified' ? '&#10003;' : r.status === 'rejected' ? '&#10007;' : '&#8987;';
        const statusClass = r.status === 'verified' ? 'sub-status-verified' : r.status === 'rejected' ? 'sub-status-rejected' : 'sub-status-pending';
        const scorePill = r.status === 'verified' && r.score ? '<div class="score-awarded-pill" style="margin-top:10px;">&#11088; ' + r.score + ' pts awarded</div>' : '';
        const feedbackBlock = r.admin_review
            ? '<div class="feedback-block' + (r.status === 'rejected' ? ' rejected' : '') + '"><i class="fas fa-comment-alt" style="margin-right:6px;"></i>"' + r.admin_review + '"</div>'
            : '';
        container.innerHTML +=
            '<div class="item-card" style="border-left:4px solid ' + leftColor + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">' +
            '<h4 style="font-size:0.95rem;flex:1;margin-right:8px;">' + taskTitle + '</h4>' +
            '<span class="' + statusClass + '" style="font-size:0.75rem;font-weight:700;">' + statusIcon + ' ' + r.status.toUpperCase() + '</span></div>' +
            (r.description ? '<p style="font-size:0.82rem;color:rgba(255,255,255,0.5);margin-bottom:10px;">' + r.description + '</p>' : '') +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
            '<a href="' + r.submission_link + '" target="_blank" style="color:#00e5ff;font-size:0.82rem;text-decoration:underline;"><i class="fas fa-external-link-alt"></i> View Work</a>' +
            '<small style="color:rgba(255,255,255,0.25);">' + dateStr + '</small></div>' +
            scorePill + feedbackBlock + '</div>';
    });
}

// ── Render: Announcements ──
function renderAnnouncements(data) {
    const container = document.getElementById('ann-container');
    if (!container) return;
    const items = Object.entries(data).sort((a, b) => b[1].timestamp - a[1].timestamp);
    if (items.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128227;</div><h3>No announcements</h3><p>Admin announcements will appear here.</p></div>'; return; }
    const latestTs = items[0][1].timestamp;
    const annBadge = document.getElementById('ann-badge');
    if (annBadge && latestTs > lastAnnSeen) annBadge.style.display = 'inline';
    container.innerHTML = items.map(([id, a]) => {
        const isNew = a.timestamp > lastAnnSeen;
        const d = a.timestamp ? new Date(a.timestamp) : null;
        const dateStr = d ? d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
        return '<div class="ann-card' + (isNew ? ' new-ann' : '') + '">' +
            (isNew ? '<span style="font-size:0.6rem;background:#00e5ff;color:#000;padding:1px 8px;border-radius:10px;font-weight:700;display:inline-block;margin-bottom:6px;">NEW</span><br>' : '') +
            '<h4>' + a.title + '</h4><p>' + a.body + '</p><small><i class="fas fa-clock"></i> ' + dateStr + '</small></div>';
    }).join('');
}

// ── Render: Showcase ──
function renderPublicShowcase() {
    const container = document.getElementById('public-reviews-container');
    if (!container) return;
    container.innerHTML = '';
    let count = 0;
    Object.values(allReports || {}).forEach(r => {
        if (r.status === 'verified' && r.review_is_public === true) {
            count++;
            const u = allUsers[r.submitted_by] || {};
            const taskTitle = allTasks[r.task_id]?.title || 'Task';
            const teamName = (allTeams[u.team_id]?.team_name || '').replace(/_/g, ' ');
            container.innerHTML +=
                '<div class="showcase-card">' +
                '<div class="showcase-submitter">' +
                '<img src="' + (u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" class="showcase-dp" alt="DP">' +
                '<div><h4 style="font-size:0.9rem;">' + (u.name || 'Member') + '</h4><small style="color:#8ab4f8;">' + teamName + '</small></div>' +
                '<span style="margin-left:auto;background:#00e5ff;color:#000;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">&#11088; ' + r.score + ' pts</span></div>' +
                '<div style="background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.1);padding:10px;border-radius:8px;margin-bottom:10px;">' +
                '<p style="font-size:0.68rem;color:#00e5ff;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Task</p>' +
                '<p style="font-size:0.88rem;">' + taskTitle + '</p></div>' +
                '<div style="background:rgba(0,229,255,0.06);border-left:3px solid #00e5ff;padding:10px;border-radius:4px;margin-bottom:10px;">' +
                '<p style="font-size:0.82rem;font-style:italic;color:#ccc;">"' + (r.admin_review || '') + '"</p></div>' +
                '<a href="' + r.submission_link + '" target="_blank" style="color:#00e5ff;font-size:0.8rem;text-decoration:underline;"><i class="fas fa-arrow-right"></i> View Work</a></div>';
        }
    });
    if (count === 0) container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127775;</div><h3>No showcases yet</h3><p>Excellent work featured by admin will appear here.</p></div>';
}

// ── Render: Team Directory ──
function renderTeamDirectory() {
    const tbody = document.getElementById('my-team-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const members = Object.keys(allUsers).filter(uid => allUsers[uid].team_id === myTeamId && allUsers[uid].role !== 'admin');
    if (members.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);padding:30px;">No teammates found.</td></tr>'; return; }
    members.sort((a, b) => (parseInt(allUsers[b].total_score) || 0) - (parseInt(allUsers[a].total_score) || 0)).forEach(uid => {
        const u = allUsers[uid];
        const isMe = uid === myId;
        const subs = Object.values(allReports || {}).filter(r => r.submitted_by === uid).length;
        tbody.innerHTML +=
            '<tr' + (isMe ? ' style="background:rgba(0,229,255,0.04);"' : '') + '>' +
            '<td><img src="' + (u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png') + '" class="team-dp" onclick="viewTeammate(\'' + uid + '\')" alt="DP"></td>' +
            '<td><span class="user-link" onclick="viewTeammate(\'' + uid + '\')">' + (u.name || uid) + '</span>' + (isMe ? ' <span style="font-size:0.65rem;background:rgba(0,229,255,0.15);color:#00e5ff;padding:1px 7px;border-radius:10px;">You</span>' : '') + '</td>' +
            '<td style="color:#8ab4f8;font-size:0.82rem;">' + (u.role || 'member').replace(/_/g, ' ') + '</td>' +
            '<td><strong style="color:#ffb74d;">' + (u.total_score || 0) + '</strong></td>' +
            '<td>' + subs + '</td></tr>';
    });
}

function viewTeammate(uid) {
    const u = allUsers[uid];
    if (!u) return;
    document.getElementById('vu_dp').src = u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    document.getElementById('vu_name').innerText = u.name || uid;
    document.getElementById('vu_role').innerText = (u.role || 'member').replace(/_/g, ' ').toUpperCase();
    document.getElementById('vu_team').innerText = allTeams[u.team_id]?.team_name || u.team_id || '-';
    document.getElementById('vu_score').innerText = u.total_score || 0;
    document.getElementById('vu_subs').innerText = Object.values(allReports || {}).filter(r => r.submitted_by === uid).length;
    document.getElementById('vu_college').innerText = u.college || '-';
    document.getElementById('vu_phone').innerText = u.ph_no || '-';
    const instaLink = u.insta_id
        ? '<a href="https://instagram.com/' + u.insta_id.replace('@','') + '" target="_blank" style="color:var(--primary-teal);text-decoration:none;"><i class="fab fa-instagram"></i> ' + u.insta_id + '</a>'
        : 'Not Linked';
    document.getElementById('vu_insta').innerHTML = instaLink;
    document.getElementById('viewUserModal').style.display = 'block';
}

// ── Profile ──
function openMyProfile() {
    const me = allUsers[myId];
    if (!me) return;
    document.getElementById('my_name').value = me.name || '';
    document.getElementById('my_phone').value = me.ph_no || '';
    document.getElementById('my_insta').value = me.insta_id || '';
    document.getElementById('my_college').value = me.college || '';
    document.getElementById('my_dp_preview').src = me.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    tempBase64DP = me.dp_url || null;
    document.getElementById('myProfileModal').style.display = 'block';
}

function compressAndPreviewDP(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = e => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 150; c.height = 150;
            c.getContext('2d').drawImage(img, 0, 0, 150, 150);
            tempBase64DP = c.toDataURL('image/jpeg', 0.8);
            document.getElementById('my_dp_preview').src = tempBase64DP;
        };
    };
}

async function saveMyProfile() {
    await db.ref('users/' + myId).update({
        name: document.getElementById('my_name').value.trim(),
        ph_no: document.getElementById('my_phone').value.trim(),
        insta_id: document.getElementById('my_insta').value.trim(),
        college: document.getElementById('my_college').value.trim(),
        dp_url: tempBase64DP
    });
    closeModal('myProfileModal');
    triggerNotification('Profile Saved', 'Your profile has been updated.', false);
}

// ── Utils ──
function openModal(id) { document.getElementById(id).style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function triggerNotification(title, message, isWarning) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const color = isWarning ? '#ffb74d' : 'var(--primary-teal)';
    const icon = isWarning ? 'fa-exclamation-circle' : 'fa-check-circle';
    toast.style.borderLeftColor = color;
    toast.innerHTML = '<i class="fas ' + icon + '" style="color:' + color + '"></i><div class="toast-content"><h4>' + title + '</h4><p>' + message + '</p></div>';
    container.appendChild(toast);
    if (Notification.permission === 'granted') new Notification('URVI: ' + title, { body: message });
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 350); }, 4000);
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