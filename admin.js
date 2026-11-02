const authContainer = document.getElementById('auth-container');
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const dashboardSection = document.getElementById('dashboard-section');

let modules = [];
let currentAdmin = null;
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function toggleForms() {
    loginSection.classList.toggle('hidden');
    registerSection.classList.toggle('hidden');
}

async function checkAdminSession() {
    try {
        const response = await fetch('api.php?action=check_session');
        const data = await response.json();

        if (data.logged_in) {
            currentAdmin = data;
            authContainer.classList.add('hidden');
            dashboardSection.classList.remove('hidden');

            const greeting = document.getElementById('adminGreeting');
            if (greeting) {
                greeting.textContent = '👤 Admin: ' + data.username;
            }

            
            if (data.keys) {
                if (data.keys.start_hour) document.getElementById('cfgStart').value = data.keys.start_hour;
                if (data.keys.end_hour) document.getElementById('cfgEnd').value = data.keys.end_hour;
                if (data.keys.total_rooms) document.getElementById('cfgRooms').value = data.keys.total_rooms;
                if (data.keys.schedule_mode) document.getElementById('mMode').value = data.keys.schedule_mode;
                if (data.keys.pass_key) document.getElementById('accessPassOut').value = data.keys.pass_key;
                if (data.keys.modify_key) document.getElementById('modifyKeyOut').value = data.keys.modify_key;
            }

            modules = Array.isArray(data.modules) ? data.modules : [];
            updateModuleListUI();
            generateTimetable(false);
        } else {
            authContainer.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        }
    } catch (err) {
        console.error('Error verifying session:', err);
    }
}

async function saveAdminDataToServer() {
    const payload = {
        action: 'save_admin_data',
        pass_key: document.getElementById('accessPassOut').value.trim(),
        modify_key: document.getElementById('modifyKeyOut').value.trim(),
        schedule_mode: document.getElementById('mMode').value,
        total_rooms: parseInt(document.getElementById('cfgRooms').value) || 3,
        start_hour: document.getElementById('cfgStart').value,
        end_hour: document.getElementById('cfgEnd').value,
        modules: modules
    };

    try {
        const response = await fetch('api.php?action=save_admin_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        return res.success;
    } catch (err) {
        console.error('Error saving data to server:', err);
        return false;
    }
}

async function handleLogout() {
    try {
        await fetch('logout.php');
    } catch (e) {
        console.error(e);
    }
    
    localStorage.removeItem('timetable_modules');
    localStorage.removeItem('timetable_access_pass');
    localStorage.removeItem('timetable_modify_key');
    localStorage.removeItem('active_schedule_mode');

    window.location.href = 'tabhome.html';
}

function getModuleInputValues() {
    return {
        prog: document.getElementById('mProg').value.trim(),
        year: document.getElementById('mYear').value.trim(),
        sem: document.getElementById('mSem').value,
        name: document.getElementById('mName').value.trim(),
        id: document.getElementById('mId').value.trim(),
        lec: document.getElementById('mLec').value.trim(),
        fac: document.getElementById('mFac').value.trim()
    };
}

function clearModuleInputs() {
    document.getElementById('mName').value = '';
    document.getElementById('mId').value = '';
    document.getElementById('mLec').value = '';
}

async function saveAndRefreshModules() {
    updateModuleListUI();
    generateTimetable(false);
    await saveAdminDataToServer();
}

document.getElementById('addModBtn').addEventListener('click', async () => {
    const mod = getModuleInputValues();
    if (!mod.prog || !mod.year || !mod.name || !mod.id || !mod.lec) {
        alert('Please fill out all the primary module fields!');
        return;
    }
    modules.push(mod);
    clearModuleInputs();
    await saveAndRefreshModules();
});

function updateModuleListUI() {
    const listContainer = document.getElementById('modList');
    if (!modules || modules.length === 0) {
        listContainer.innerHTML = '<p class="note">No modules added yet.</p>';
        return;
    }
    listContainer.innerHTML = '<h4>Added Modules Queue:</h4>';
    modules.forEach((mod, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:5px; border-bottom:1px dashed silver; display:flex; justify-content:space-between;';
        item.innerHTML = `<span><strong>${mod.id}</strong>: ${mod.name} (${mod.lec} - ${mod.prog} Y${mod.year})</span> <button onclick="deleteModule(${index})" style="width:auto; margin:0; padding:2px 8px; background-color:crimson; color:white; border:none; border-radius:4px; cursor:pointer;">X</button>`;
        listContainer.appendChild(item);
    });
}

async function deleteModule(index) {
    modules.splice(index, 1);
    await saveAndRefreshModules();
}

document.getElementById('btnGenPass').addEventListener('click', async () => {
    const randomPass = 'PASS-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    document.getElementById('accessPassOut').value = randomPass;
    await saveAdminDataToServer();
    alert('Public Access Pass generated: ' + randomPass);
});

document.getElementById('btnGenKey').addEventListener('click', async () => {
    const randomKey = 'KEY-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('modifyKeyOut').value = randomKey;
    await saveAdminDataToServer();
    alert('Public Modify Key generated: ' + randomKey);
});

document.getElementById('btnGenMaster').addEventListener('click', async () => {
    generateTimetable(true);
    await saveAdminDataToServer();
    alert('Master timetable generated and synchronized to database!');
});

function generateTimetable(shouldAlert = false) {
    const table = document.getElementById('timetableTable');
    const totalRooms = parseInt(document.getElementById('cfgRooms').value) || 3;
    const mode = document.getElementById('mMode').value;
    table.innerHTML = '';

    if (!modules || modules.length === 0) {
        table.innerHTML = '<tr><td class="note">Add modules above to render your preview grid.</td></tr>';
        return;
    }

    let headerRow = '<tr><th>Day</th>';
    for (let r = 1; r <= totalRooms; r++) {
        headerRow += `<th>Room ${r}</th>`;
    }
    headerRow += '</tr>';
    table.innerHTML += headerRow;

    let pool = [...modules];
    const activeDays = mode === 'weekend' ? ['Saturday', 'Sunday'] : days;

    activeDays.forEach((day) => {
        let rowHtml = `<tr><td><strong>${day}</strong></td>`;
        for (let room = 1; room <= totalRooms; room++) {
            if (pool.length > 0) {
                const allocated = pool.shift();
                allocated.day = day;
                allocated.room = room;
                rowHtml += `<td><div style="font-size:12px; line-height:1.2;"><strong>${allocated.id}</strong><br>${allocated.name}<br><span style="color:dimgrey;">${allocated.lec}</span></div></td>`;
            } else {
                rowHtml += '<td style="color:silver; font-style:italic; font-size:12px;">Available Slot</td>';
            }
        }
        rowHtml += '</tr>';
        table.innerHTML += rowHtml;
    });
}

document.getElementById('mMode').addEventListener('change', async () => {
    generateTimetable(false);
    await saveAdminDataToServer();
});

document.getElementById('cfgRooms').addEventListener('input', async () => {
    generateTimetable(false);
    await saveAdminDataToServer();
});


const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const formData = new FormData(registerForm);
        try {
            const response = await fetch("register.php", {
                method: "POST",
                body: formData
            });
            const result = await response.json();

            if (response.ok && result.success) {
                alert(result.message);
                registerForm.reset();
                await checkAdminSession();
            } else {
                alert(result.message || "Registration failed.");
            }
        } catch (error) {
            console.error(error);
            alert("Could not connect to the server.");
        }
    });
}


const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const formData = new FormData(loginForm);

        try {
            const response = await fetch("login.php", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert(result.message);
                loginForm.reset();
                await checkAdminSession();
            } else {
                alert(result.message || "Login failed.");
            }
        } catch (error) {
            console.error(error);
            alert("Could not connect to the server.");
        }
    });
}


window.addEventListener('DOMContentLoaded', checkAdminSession);
