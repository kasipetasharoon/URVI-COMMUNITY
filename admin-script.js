// 1. Firebase Configuration
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
let allUsers = {}, allTeams = {}, allTasks = {}, allReports = {};
let editingUserId = null, selectedReportId = null, tempBase64DP = null;
let currentTaskFilter = 'active';

// Initialize
window.onload = () => { fetchData(); };

// --- DATA FETCHING ---
function fetchData() {
    db.ref('users').on('value', snap => {
        allUsers = snap.val() || {};
        renderMembers(); updateOverviewStats(); renderGlobalLeaderboard(); updateHeaderUI(); renderActivityFeed();
    });
    db.ref('teams').on('value', snap => {
        allTeams = snap.val() || {};
        renderTeams(); updateDropdowns(); renderMembers();
    });
    db.ref('tasks').on('value', snap => {
        allTasks = snap.val() || {};
        renderTasks(); renderActivityFeed();
    });
    db.ref('reports').on('value', snap => {
        allReports = snap.val() || {};
        renderReports(); renderPublicShowcase(); renderMembers(); renderActivityFeed();
    });
    db.ref('announcements').on('value', snap => {
        renderAnnouncements(snap.val() || {});
    });
}

function updateDropdowns() {
    const teamOptions = Object.keys(allTeams).map(id => `<option value="${id}">${allTeams[id].team_name}</option>`).join('');
    const filterTeamEl = document.getElementById('filterTeam');
    const uTeamEl = document.getElementById('u_team');
    const tskTeamEl = document.getElementById('tsk_team');
    if (filterTeamEl) filterTeamEl.innerHTML = `<option value="all">All Teams</option>${teamOptions}`;
    if (uTeamEl) uTeamEl.innerHTML = `<option value="">No Team</option>${teamOptions}`;
    if (tskTeamEl) tskTeamEl.innerHTML = `<option value="">Select Team</option>${teamOptions}`;
}

function updateHeaderUI() {
    const me = allUsers[myId];
    if (!me) return;
    const firstName = (me.name || 'Admin').split(' ')[0];
    if (document.getElementById('header-name')) document.getElementById('header-name').innerText = firstName;
    if (me.dp_url) {
        if (document.getElementById('header-dp')) document.getElementById('header-dp').src = me.dp_url;
        if (document.getElementById('mobile-header-dp')) document.getElementById('mobile-header-dp').src = me.dp_url;
    }
}

// --- UI NAVIGATION ---
function showSection(id, element) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    const targetSection = document.getElementById(id);
    if (targetSection) targetSection.classList.add('active');
    if (element) element.classList.add('active');
    const title = element
        ? Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).join('') || element.innerText.trim()
        : id;
    if (document.getElementById('section-title')) document.getElementById('section-title').innerText = title;
    if (document.getElementById('mobile-section-title')) document.getElementById('mobile-section-title').innerText = title;
    // Only close sidebar if it is currently open
    const sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('active')) toggleSidebar();
}

// --- PRO PROFILE SYSTEM ---
function openMyProfile() {
    const me = allUsers[myId]; if(!me) return;
    document.getElementById('my_name').value = me.name || "";
    document.getElementById('my_phone').value = me.ph_no || "";
    document.getElementById('my_email').value = me.email || "";
    document.getElementById('my_insta').value = me.insta_id || "";
    document.getElementById('my_college').value = me.college || "";
    document.getElementById('my_dp_preview').src = me.dp_url || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    tempBase64DP = me.dp_url || null;
    openModal('myProfileModal');
}

function compressAndPreviewDP(event) {
    const file = event.target.files[0]; if(!file) return;
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image(); img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            canvas.width = 150; canvas.height = 150; ctx.drawImage(img, 0, 0, 150, 150);
            tempBase64DP = canvas.toDataURL('image/jpeg', 0.8);
            document.getElementById('my_dp_preview').src = tempBase64DP;
        };
    };
}

async function saveMyProfile() {
    let updates = {
        name: document.getElementById('my_name').value.trim(),
        ph_no: document.getElementById('my_phone').value.trim(),
        email: document.getElementById('my_email').value.trim(),
        insta_id: document.getElementById('my_insta').value.trim(),
        college: document.getElementById('my_college').value.trim()
    };
    if(tempBase64DP) updates.dp_url = tempBase64DP;
    await db.ref(`users/${myId}`).update(updates);
    closeModal('myProfileModal');
    triggerNotification("Profile Updated", "Changes saved.");
}

// --- UNIVERSAL USER PROFILE VIEWER ---
function viewUserProfile(uid) {
    const u = allUsers[uid];
    if (!u) return;
    document.getElementById('vu_dp').src = u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    document.getElementById('vu_name').innerText = u.name || 'N/A';
    document.getElementById('vu_role').innerText = u.role ? u.role.replace(/_/g, ' ').toUpperCase() : 'N/A';
    document.getElementById('vu_team').innerText = allTeams[u.team_id]?.team_name || 'Unassigned';
    document.getElementById('vu_score').innerText = u.total_score || 0;
    document.getElementById('vu_subs').innerText = Object.values(allReports || {}).filter(r => r.submitted_by === uid).length;
    document.getElementById('vu_college').innerText = u.college || 'N/A';
    document.getElementById('vu_phone').innerText = u.ph_no || '-';
    document.getElementById('vu_email').innerText = u.email || '-';
    const instaLink = u.insta_id
        ? `<a href="https://instagram.com/${u.insta_id.replace('@','')}" target="_blank" style="color:var(--primary-teal);text-decoration:none;"><i class="fab fa-instagram"></i> ${u.insta_id}</a>`
        : 'Not Linked';
    document.getElementById('vu_insta').innerHTML = instaLink;
    openModal('viewUserModal');
}

// --- GLOBAL LEADERBOARD ---
function renderGlobalLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    if(!container) return; container.innerHTML = "";
    
    let rankedUsers = Object.keys(allUsers)
        .map(uid => ({ id: uid, ...allUsers[uid], score: parseInt(allUsers[uid].total_score) || 0 }))
        .sort((a, b) => b.score - a.score).slice(0, 3);

    if(rankedUsers.length === 0 || rankedUsers[0].score === 0) {
        container.innerHTML = `<p style="color:#8ab4f8; text-align:center;">Competition results loading...</p>`;
        return;
    }

    rankedUsers.forEach((user, index) => {
        const medals = ['🥇', '🥈', '🥉'];
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:10px; margin-bottom:10px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.2rem;">${medals[index]}</span>
                    <img src="${user.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border:1px solid #00e5ff;">
                    <div><span class="user-link" onclick="viewUserProfile('${user.id}')">${user.name}</span><br><span style="font-size:0.7rem; color:#8ab4f8;">${allTeams[user.team_id]?.team_name || ''}</span></div>
                </div>
                <div style="font-weight:bold; color:#00e5ff;">${user.score} pts</div>
            </div>`;
    });
}

// --- DIRECTORY ---
function renderMembers() {
    const tbody = document.getElementById('members-tbody'); if(!tbody) return;
    const search = document.getElementById('searchMember').value.toLowerCase();
    const filterT = document.getElementById('filterTeam').value;
    const filterR = document.getElementById('filterRole').value;
    
    let userSubs = {}; 
    Object.values(allReports).forEach(r => { userSubs[r.submitted_by] = (userSubs[r.submitted_by] || 0) + 1; });
    
    tbody.innerHTML = "";
    Object.keys(allUsers).forEach(id => {
        const u = allUsers[id];
        const matchSearch = id.toLowerCase().includes(search) || (u.name && u.name.toLowerCase().includes(search));
        const matchTeam = filterT === 'all' || u.team_id === filterT;
        const matchRole = filterR === 'all' || u.role === filterR;

        if (matchSearch && matchTeam && matchRole) {
            tbody.innerHTML += `
                <tr>
                    <td><img src="${u.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #00e5ff; cursor:pointer;" onclick="viewUserProfile('${id}')"></td>
                    <td style="font-size:0.8rem; color:#8ab4f8;">${id}</td>
                    <td><span class="user-link" onclick="viewUserProfile('${id}')">${u.name}</span></td>
                    <td>${u.role.replace('_', ' ')}</td>
                    <td>${allTeams[u.team_id]?.team_name || 'Unassigned'}</td>
                    <td>${userSubs[id] || 0}</td>
                    <td><strong style="color:#00e5ff;">${u.total_score || 0}</strong></td>
                    <td><button class="action-btn" style="padding:8px 12px;" onclick="openEditUser('${id}')"><i class="fas fa-edit"></i></button></td>
                </tr>`;
        }
    });
}

function openUserModal() {
    editingUserId = null;
    document.getElementById('userModalTitle').innerText = 'Add New Member';
    ['u_id','u_name','u_phone','u_email','u_insta','u_college'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('u_id').disabled = false;
    document.getElementById('u_score').value = '0';
    const delBtn = document.getElementById('delete-user-btn');
    if (delBtn) delBtn.style.display = 'none';
    openModal('userModal');
}

function openEditUser(id) {
    editingUserId = id;
    const u = allUsers[id];
    document.getElementById('userModalTitle').innerText = 'Edit Member';
    document.getElementById('u_id').value = id;
    document.getElementById('u_id').disabled = true;
    document.getElementById('u_name').value = u.name || '';
    document.getElementById('u_phone').value = u.ph_no || '';
    document.getElementById('u_email').value = u.email || '';
    document.getElementById('u_insta').value = u.insta_id || '';
    document.getElementById('u_college').value = u.college || '';
    document.getElementById('u_role').value = u.role || 'member';
    document.getElementById('u_team').value = u.team_id || '';
    document.getElementById('u_score').value = u.total_score || 0;
    const delBtn = document.getElementById('delete-user-btn');
    if (delBtn) delBtn.style.display = 'inline-block';
    openModal('userModal');
}

async function saveUser() {
    const id = document.getElementById('u_id').value.trim();
    if(!id || !document.getElementById('u_name').value.trim()) return alert("ID and Name are required.");

    const userData = {
        name: document.getElementById('u_name').value.trim(),
        ph_no: document.getElementById('u_phone').value.trim(),
        email: document.getElementById('u_email').value.trim(),
        insta_id: document.getElementById('u_insta').value.trim(),
        college: document.getElementById('u_college').value.trim(),
        role: document.getElementById('u_role').value,
        team_id: document.getElementById('u_team').value,
        total_score: parseInt(document.getElementById('u_score').value) || 0
    };
    // Password default for new users
    if(!editingUserId) { userData.password = "welcome@urvi"; userData.password_changed = false; }
    
    await db.ref(`users/${id}`).update(userData);
    closeModal('userModal');
}

// --- TEAMS ---
function renderTeams() {
    const container = document.getElementById('teams-container'); if(!container) return;
    container.innerHTML = "";
    Object.keys(allTeams).forEach(id => {
        container.innerHTML += `
            <div class="item-card" style="cursor: pointer;" onclick="openTeamDetails('${id}')">
                <h3 style="color:var(--primary-teal); margin-bottom:10px; font-size:1.2rem;">${allTeams[id].team_name}</h3>
                <p style="color:#8ab4f8;"><strong>Head:</strong> ${allUsers[allTeams[id].head_id]?.name || 'None'}</p>
                <p style="margin-top:15px; font-size:0.8rem; color:#aaa;"><i class="fas fa-users"></i> Click to view members</p>
            </div>`;
    });
}

function openTeamDetails(teamId) {
    const team = allTeams[teamId];
    document.getElementById('td_title').innerText = team.team_name;
    document.getElementById('td_head').innerHTML = allUsers[team.head_id] ? `<span class="user-link" onclick="viewUserProfile('${team.head_id}')">${allUsers[team.head_id].name}</span>` : "No Head Assigned";
    
    const tbody = document.getElementById('td_members_tbody'); tbody.innerHTML = "";
    Object.keys(allUsers).forEach(uid => {
        if(allUsers[uid].team_id === teamId) {
            tbody.innerHTML += `<tr><td style="padding:10px; color:#8ab4f8; font-size:0.8rem;">${uid}</td><td style="padding:10px;"><span class="user-link" onclick="viewUserProfile('${uid}')">${allUsers[uid].name}</span></td><td style="padding:10px; color:#00e5ff;">${allUsers[uid].role.replace('_', ' ')}</td></tr>`;
        }
    });
    openModal('teamDetailsModal');
}

async function saveTeam() {
    const id = document.getElementById('t_id').value.trim();
    const name = document.getElementById('t_name').value.trim();
    if(!id || !name) return alert("Team ID and Name required.");
    await db.ref(`teams/${id}`).set({ 
        team_name: name, 
        head_id: document.getElementById('t_head').value.trim() || "" 
    });
    closeModal('teamModal');
}

// --- TASKS ---
function filterTasks(status) {
    currentTaskFilter = status;
    document.querySelectorAll('.task-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    if(document.getElementById('tab-' + status)) document.getElementById('tab-' + status).classList.add('active');
    renderTasks();
}

function updateTaskAssigneeDropdown() {
    const teamId = document.getElementById('tsk_team').value;
    const assigneeSelect = document.getElementById('tsk_assignee');
    assigneeSelect.innerHTML = `<option value="entire_team">Entire Team (Everyone)</option>`;
    if(!teamId) { assigneeSelect.disabled = true; return; }
    assigneeSelect.disabled = false;
    Object.keys(allUsers).forEach(uid => { if(allUsers[uid].team_id === teamId) assigneeSelect.innerHTML += `<option value="${uid}">${allUsers[uid].name}</option>`; });
}

function renderTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    container.innerHTML = '';
    const search = (document.getElementById('searchTask')?.value || '').toLowerCase();
    let count = 0;
    Object.keys(allTasks).forEach(id => {
        const t = allTasks[id];
        if (currentTaskFilter !== 'all' && t.status !== currentTaskFilter) return;
        if (search && !t.title.toLowerCase().includes(search)) return;
        count++;
        const badgeClass = t.status === 'active' ? 'badge-active' : 'badge-done';
        const assigned = t.assigned_to === 'entire_team' ? 'Everyone' : (allUsers[t.assigned_to]?.name || t.assigned_to);
        const nextStatus = t.status === 'active' ? 'completed' : 'active';
        const btnLabel = t.status === 'active' ? '&#10003; Mark Done' : '&#8635; Reactivate';
        container.innerHTML += `<div class="item-card" onclick="openTaskDetails('${id}')" style="cursor:pointer;${t.status === 'completed' ? 'opacity:0.75;' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <h4 style="flex:1;margin-right:8px;font-size:0.95rem;">${t.title}</h4>
                <span class="${badgeClass}">${t.status}</span>
            </div>
            <p style="font-size:0.8rem;color:#8ab4f8;margin-bottom:12px;">&#128100; ${assigned}</p>
            <button class="action-btn" style="width:100%;background:transparent;color:#00e5ff;border:1px solid rgba(0,229,255,0.35);padding:8px;font-size:0.82rem;"
                onclick="event.stopPropagation();db.ref('tasks/${id}/status').set('${nextStatus}')">${btnLabel}
            </button>
        </div>`;
    });
    if (count === 0) container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128203;</div><h3>No tasks found</h3><p>Try a different filter or assign a new task.</p></div>';
}

function openTaskDetails(taskId) {
    const task = allTasks[taskId];
    document.getElementById('taskd_title').innerText = task.title;
    document.getElementById('taskd_team').innerText = allTeams[task.team_id]?.team_name || "Unknown";
    document.getElementById('taskd_person').innerHTML = (task.assigned_to && task.assigned_to !== 'entire_team') ? `<span class="user-link" onclick="viewUserProfile('${task.assigned_to}')">${allUsers[task.assigned_to]?.name}</span>` : "Entire Team";
    document.getElementById('taskd_desc').innerText = task.description;
    
    const activityContainer = document.getElementById('taskd_activity'); activityContainer.innerHTML = ""; let hasReports = false;
    Object.keys(allReports).forEach(rid => {
        const r = allReports[rid];
        if(r.task_id === taskId) {
            hasReports = true;
            const submitterName = allUsers[r.submitted_by]?.name || r.submitted_by;
            const dp = allUsers[r.submitted_by]?.dp_url || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            const statusColor = r.status === 'verified' ? '#00e5ff' : '#ffb74d';
            activityContainer.innerHTML += `
                <div style="background:rgba(255,255,255,0.03); padding:15px; margin-bottom:10px; border-left: 4px solid ${statusColor}; border-radius:8px;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <img src="${dp}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <strong style="color:white;" class="user-link" onclick="viewUserProfile('${r.submitted_by}')">${submitterName}</strong>
                    </div>
                    <p style="font-size: 0.85rem; margin-bottom: 8px; color:#ccc;">${r.description}</p>
                    <a href="${r.submission_link}" target="_blank" style="display:inline-block; margin-bottom:10px; font-size:0.85rem; color:#00e5ff; text-decoration:underline;"><i class="fas fa-external-link-alt"></i> Open Work Link</a>
                    <p style="font-size:0.8rem; color:#8ab4f8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;">Status: <span style="color:${statusColor}; font-weight:bold;">${r.status.toUpperCase()}</span> | Score: ${r.score || 'Pending'}</p>
                </div>
            `;
        }
    });
    if(!hasReports) activityContainer.innerHTML = `<div style="padding: 15px; text-align: center; color: #8ab4f8; background: rgba(255,255,255,0.02); border-radius: 8px;">No submissions yet.</div>`;
    openModal('taskDetailsModal');
}

async function saveTask() {
    const title = document.getElementById('tsk_title').value;
    const desc = document.getElementById('tsk_desc').value;
    const team = document.getElementById('tsk_team').value;
    const assignee = document.getElementById('tsk_assignee').value;
    if(!title || !team) return alert("Title and Team required.");

    await db.ref('tasks').push().set({ 
        title, description: desc, team_id: team, assigned_to: assignee, 
        assigned_by: 'admin', status: 'active', timestamp: new Date().toISOString() 
    });
    closeModal('taskModal');
}

// --- REPORTS & REVIEWS ---
function renderReports() {
    const container = document.getElementById('reports-container'); 
    if(!container) return;
    container.innerHTML = ""; 
    let pendingCount = 0;

    Object.keys(allReports).forEach(id => {
        const r = allReports[id];
        if(r.status === 'pending') {
            pendingCount++;
            
            // TASK LOOKUP: Find the full task object using the ID
            const task = allTasks[r.task_id];
            const taskTitle = task ? task.title : "General Submission";
            const taskDesc = task ? task.description : "No specific task details.";

            container.innerHTML += `
                <div class="item-card" style="border-left: 4px solid #ffb74d;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                        <img src="${allUsers[r.submitted_by]?.dp_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" style="width:40px; height:40px; border-radius:50%; border:2px solid #ffb74d; cursor:pointer;" onclick="viewUserProfile('${r.submitted_by}')">
                        <h4 class="user-link" onclick="viewUserProfile('${r.submitted_by}')">${allUsers[r.submitted_by]?.name || r.submitted_by}</h4>
                    </div>
                    
                    <div style="background:rgba(0,229,255,0.05); padding:12px; border-radius:10px; border:1px solid rgba(0,229,255,0.1); margin-bottom:12px;">
                        <p style="font-size:0.7rem; color:#00e5ff; text-transform:uppercase; font-weight:700; margin-bottom:4px;">Work Submitted For:</p>
                        <h4 style="color:white; margin-bottom:4px;">${taskTitle}</h4>
                        <p style="font-size:0.8rem; color:#8ab4f8; font-style:italic;">"${taskDesc}"</p>
                    </div>

                    <p style="font-size:0.9rem; color:#ccc; margin-bottom:12px;"><b>Member Note:</b> ${r.description || 'No notes provided.'}</p>
                    
                    <a href="${r.submission_link}" target="_blank" style="font-size:0.85rem; color:#ffb74d; text-decoration:underline; display:block; margin-bottom:15px;">
                        <i class="fas fa-external-link-alt"></i> Open Submitted Work Link
                    </a>

                    <button class="action-btn" style="width:100%; background:#ffb74d; color:black;" onclick="openReviewModal('${id}')">
                        Review & Award Score
                    </button>
                </div>`;
        }
    });
    
    // Update count stats and badges
    if(document.getElementById('stat-pending')) document.getElementById('stat-pending').innerText = pendingCount;
    const badge = document.getElementById('badge');
    if(badge) {
        badge.innerText = pendingCount; 
        badge.style.display = pendingCount === 0 ? 'none' : 'inline';
    }
}

function openReviewModal(id) {
    selectedReportId = id; const r = allReports[id];
    document.getElementById('rev_desc').innerText = r.description;
    document.getElementById('rev_link').href = r.submission_link;
    document.getElementById('rev_score').value = ""; 
    document.getElementById('rev_feedback').value = ""; 
    document.getElementById('rev_public').checked = false;
    openModal('reviewModal');
}

async function submitReview() {
    const score = parseInt(document.getElementById('rev_score').value);
    const feedback = document.getElementById('rev_feedback').value;
    const isPublic = document.getElementById('rev_public').checked;
    if(isNaN(score)) return alert("Enter a valid number for score.");
    
    const r = allReports[selectedReportId];
    const userId = r.submitted_by;
    const currentScore = parseInt(allUsers[userId]?.total_score) || 0;
    
    await db.ref(`reports/${selectedReportId}`).update({ status: 'verified', score, admin_review: feedback, review_is_public: isPublic });
    await db.ref(`users/${userId}`).update({ total_score: currentScore + score });
    closeModal('reviewModal');
    triggerNotification("Verified", "Member has been awarded.");
}

function renderPublicShowcase() {
    const container = document.getElementById('public-reviews-container'); if(!container) return;
    container.innerHTML = ""; let count = 0;
    Object.keys(allReports).forEach(rid => {
        const r = allReports[rid];
        if(r.status === 'verified' && r.review_is_public) {
            count++; const u = allUsers[r.submitted_by];
            container.innerHTML += `
                <div class="item-card" style="border: 1px solid rgba(0,229,255,0.3);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <div><h4 style="color:#00e5ff;" class="user-link" onclick="viewUserProfile('${r.submitted_by}')">${u?.name || 'Unknown'}</h4><small style="color:#8ab4f8;">${allTeams[u?.team_id]?.team_name || 'N/A'}</small></div>
                        <span style="background:rgba(0,229,255,0.2); color:#00e5ff; padding:2px 8px; border-radius:5px; font-weight:bold;"><i class="fas fa-star"></i> ${r.score}</span>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-left:3px solid #00e5ff; border-radius:4px; margin-bottom:10px;"><p style="font-size:0.85rem; font-style:italic;">"${r.admin_review}"</p></div>
                    <button onclick="removeShowcase('${rid}')" style="background:transparent; border:1px solid #ff4d4d; color:#ff4d4d; padding:5px 10px; border-radius:5px; cursor:pointer; width:100%; font-size:0.8rem;">Remove from Public</button>
                </div>`;
        }
    });
}

async function removeShowcase(rid) {
    if(confirm("Make this review private again?")) {
        await db.ref(`reports/${rid}`).update({ review_is_public: false });
    }
}

// --- ANNOUNCEMENTS ---
async function sendAnnouncement() {
    const title = document.getElementById('ann_title').value.trim();
    const body = document.getElementById('ann_body').value.trim();
    if(!title || !body) return alert("Title and Content required.");
    await db.ref('announcements').push().set({ title, body, timestamp: Date.now() });
    document.getElementById('ann_title').value = ""; document.getElementById('ann_body').value = "";
    triggerNotification("Broadcast Sent", "Announcement is live.");
}

// --- STATS OVERVIEW ---
function updateOverviewStats() {
    const stats = {
        'stat-members': Object.keys(allUsers).length,
        'stat-teams': Object.keys(allTeams).length,
        'stat-tasks': Object.values(allTasks).filter(t => t.status === 'active').length,
        'stat-pending': Object.values(allReports).filter(r => r.status === 'pending').length
    };
    Object.keys(stats).forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerText = stats[id];
    });
    
    let topName = "N/A", topScore = -1;
    Object.values(allUsers).forEach(u => {
        let s = parseInt(u.total_score) || 0;
        if(s > topScore) { topScore = s; topName = u.name; }
    });
    if(document.getElementById('stat-top-user')) document.getElementById('stat-top-user').innerText = topName;
    if(document.getElementById('stat-top-score')) document.getElementById('stat-top-score').innerText = topScore + " Points";
}

// --- UTILS ---
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
    toast.innerHTML = `<i class="fas ${icon}" style="color:${color}"></i><div class="toast-content"><h4>${title}</h4><p>${message}</p></div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 350); }, 3800);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

async function deleteCurrentUser() {
    if (!editingUserId) return;
    if (!confirm('Permanently delete member ' + editingUserId + '? This cannot be undone.')) return;
    await db.ref('users/' + editingUserId).remove();
    closeModal('userModal');
    triggerNotification('Deleted', 'Member ' + editingUserId + ' removed.', true);
}

async function rejectReport() {
    if (!confirm('Reject this submission? The member will be notified.')) return;
    await db.ref('reports/' + selectedReportId).update({ status: 'rejected', admin_review: 'Submission rejected by admin.' });
    closeModal('reviewModal');
    triggerNotification('Rejected', 'Submission has been marked as rejected.', true);
}

function renderAnnouncements(data) {
    const list = document.getElementById('ann-history-list');
    if (!list) return;
    const items = Object.entries(data).sort((a, b) => b[1].timestamp - a[1].timestamp);
    if (items.length === 0) {
        list.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:0.85rem;text-align:center;padding:20px;">No announcements yet.</p>';
        return;
    }
    list.innerHTML = items.slice(0, 20).map(([id, ann]) => {
        const d = new Date(ann.timestamp);
        const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return '<div class="ann-item"><h4>' + ann.title + '</h4><p>' + ann.body + '</p><small><i class="fas fa-clock"></i> ' + dateStr + '</small></div>';
    }).join('');
}

function renderActivityFeed() {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;
    const events = [];
    Object.values(allReports || {}).forEach(r => {
        const name = allUsers[r.submitted_by]?.name || r.submitted_by;
        if (r.status === 'verified') events.push({ time: r.timestamp || 0, text: name + ' got verified', warn: false });
        else if (r.status === 'pending') events.push({ time: r.timestamp || 0, text: name + ' submitted work', warn: false });
    });
    Object.values(allTasks || {}).forEach(t => {
        events.push({ time: t.timestamp || 0, text: 'Task: "' + t.title + '"', warn: t.status === 'completed' });
    });
    events.sort((a, b) => new Date(b.time) - new Date(a.time));
    const top = events.slice(0, 6);
    if (top.length === 0) { feed.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:0.82rem;text-align:center;padding:10px;">No recent activity.</p>'; return; }
    feed.innerHTML = top.map(e => {
        const d = e.time ? new Date(e.time) : null;
        const timeStr = d && !isNaN(d) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
        return '<div class="activity-item"><div class="activity-dot' + (e.warn ? ' warn' : '') + '"></div><div style="flex:1"><span style="font-size:0.82rem;">' + e.text + '</span></div><span class="activity-time">' + timeStr + '</span></div>';
    }).join('');
}

// ── Change Password (profile modal) ──
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
    errEl.style.color = '#ff4d4d';
    errEl.innerText = '';
    if (!current || !newPw || !confirm) { errEl.innerText = 'Please fill all fields.'; return; }
    if (newPw.length < 6) { errEl.innerText = 'New password must be at least 6 characters.'; return; }
    if (newPw !== confirm) { errEl.innerText = 'Passwords do not match.'; return; }
    // Verify current password against Firebase
    const snap = await db.ref('users/' + myId).once('value');
    const userData = snap.val();
    if (!userData || userData.password.toString() !== current) { errEl.innerText = 'Current password is incorrect.'; return; }
    if (newPw === current) { errEl.innerText = 'New password must differ from current.'; return; }
    await db.ref('users/' + myId).update({ password: newPw, password_changed: true });
    errEl.style.color = '#00e5ff';
    errEl.innerText = '✓ Password updated successfully!';
    setTimeout(() => {
        document.getElementById('cp_current').value = '';
        document.getElementById('cp_new').value = '';
        document.getElementById('cp_confirm').value = '';
        errEl.innerText = '';
    }, 2500);
    triggerNotification('Password Changed', 'Your password has been updated.', false);
}

function logout() { localStorage.clear(); window.location.href = 'login.html'; }