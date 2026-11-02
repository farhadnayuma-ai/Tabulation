const btnLoadPass = document.getElementById('btnLoadPass');
const inputAccessPass = document.getElementById('inputAccessPass');
const passStatus = document.getElementById('passStatus');

const modifyPanel = document.getElementById('modifyPanel');
const rosterPanel = document.getElementById('rosterPanel');
const schedulePanel = document.getElementById('schedulePanel');

const btnVerifyKey = document.getElementById('btnVerifyKey');
const inputModKey = document.getElementById('inputModKey');
const keyStatus = document.getElementById('keyStatus');
const rosterContainer = document.getElementById('lecNames');
const lecturerTable = document.getElementById('lecturerTimetableTable');
const scheduleTitle = document.getElementById('scheduleTitle');

let activeModules = [];
let scheduleMode = 'weekday';
let totalRooms = 3;
let selectedLecturer = null;
let holdsEditPrivileges = false;
let currentPass = '';
let currentKey = '';

btnLoadPass.addEventListener('click', async () => {
    const typedPass = inputAccessPass.value.trim();

    if (!typedPass) {
        passStatus.style.color = 'crimson';
        passStatus.textContent = "Please enter an Access Pass.";
        return;
    }

    try {
        const response = await fetch('api.php?action=get_timetable_by_pass&pass=' + encodeURIComponent(typedPass));
        const result = await response.json();

        if (response.ok && result.success) {
            currentPass = typedPass;
            activeModules = Array.isArray(result.modules) ? result.modules : [];
            scheduleMode = result.schedule_mode || 'weekday';
            totalRooms = result.total_rooms || 3;

            passStatus.style.color = 'seagreen';
            passStatus.textContent = `✅ Timetable loaded successfully for Admin: ${result.username}`;

            modifyPanel.classList.remove('hidden');
            rosterPanel.classList.remove('hidden');
            schedulePanel.classList.remove('hidden');

            assignDefaultCoordinates();
            renderRosterChips();
            renderLecturerSchedule();
        } else {
            passStatus.style.color = 'crimson';
            passStatus.textContent = "❌ " + (result.message || "Invalid Access Pass.");
            modifyPanel.classList.add('hidden');
            rosterPanel.classList.add('hidden');
            schedulePanel.classList.add('hidden');
        }
    } catch (error) {
        console.error(error);
        passStatus.style.color = 'crimson';
        passStatus.textContent = "Could not connect to the server.";
    }
});

function assignDefaultCoordinates() {
    const workingDays = scheduleMode === 'weekend' ? ['Saturday', 'Sunday'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    activeModules.forEach((mod, index) => {
        if (!mod.day || mod.room === undefined || mod.room === null) {
            const dayIndex = Math.floor(index / totalRooms) % workingDays.length;
            const roomIndex = index % totalRooms;
            mod.day = workingDays[dayIndex];
            mod.room = roomIndex + 1;
        }
    });
}

btnVerifyKey.addEventListener('click', async () => {
    const typedKey = inputModKey.value.trim();

    if (!currentPass) {
        keyStatus.style.color = 'crimson';
        keyStatus.textContent = "Please load a timetable using an Access Pass first.";
        return;
    }

    if (!typedKey) {
        keyStatus.style.color = 'crimson';
        keyStatus.textContent = "Please enter the Modify Key.";
        return;
    }

    try {
        const response = await fetch('api.php?action=verify_modify_key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pass: currentPass, key: typedKey })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            holdsEditPrivileges = true;
            currentKey = typedKey;
            keyStatus.style.color = 'seagreen';
            keyStatus.textContent = result.message;
            alert("Privileges Unlocked! You can now move, swap, or cancel classes.");
            renderLecturerSchedule();
        } else {
            holdsEditPrivileges = false;
            keyStatus.style.color = 'crimson';
            keyStatus.textContent = result.message || "Invalid verification key.";
        }
    } catch (error) {
        console.error(error);
        keyStatus.style.color = 'crimson';
        keyStatus.textContent = "Could not connect to the server.";
    }
});

function renderRosterChips() {
    rosterContainer.innerHTML = '';
    const lecturersList = [...new Set(activeModules.map(mod => mod.lec).filter(l => l && l.trim() !== ''))];

    if (lecturersList.length === 0) {
        rosterContainer.innerHTML = '<p class="note">No lecturers found in this timetable.</p>';
        return;
    }

    const allChip = document.createElement('button');
    allChip.className = selectedLecturer === null ? "lec-chip active" : "lec-chip";
    allChip.textContent = "Show All Faculty";
    allChip.addEventListener('click', () => handleChipSelection(allChip, null));
    rosterContainer.appendChild(allChip);

    lecturersList.forEach(name => {
        const chip = document.createElement('button');
        chip.className = selectedLecturer === name ? "lec-chip active" : "lec-chip";
        chip.textContent = name;
        chip.addEventListener('click', () => handleChipSelection(chip, name));
        rosterContainer.appendChild(chip);
    });
}

function handleChipSelection(clickedChip, name) {
    document.querySelectorAll('.lec-chip').forEach(c => c.classList.remove('active'));
    clickedChip.classList.add('active');
    selectedLecturer = name;
    scheduleTitle.textContent = name ? `Schedule View for Prof. ${name}` : 'Personal Lecture Schedule';
    renderLecturerSchedule();
}

async function syncLecturerChanges() {
    if (!currentPass || !currentKey) return;
    try {
        const response = await fetch('api.php?action=lecturer_save_timetable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pass: currentPass,
                key: currentKey,
                modules: activeModules
            })
        });
        const result = await response.json();
        if (!result.success) {
            alert('Warning: Could not save changes to server: ' + (result.message || 'Error'));
        }
    } catch (e) {
        console.error('Error updating timetable:', e);
    }
}

async function moveOrSwapClass(index) {
    const targetInput = prompt(`Enter target slot to move to (Format: Day, Room number):\nExample: Wednesday, 2 (Rooms 1 to ${totalRooms})`);
    if (!targetInput) return;

    const parts = targetInput.split(',');
    if (parts.length < 2) {
        alert("Invalid format! Please use: Day, Room (e.g., Wednesday, 2)");
        return;
    }

    const targetDayInput = parts[0].trim().toLowerCase();
    const targetRoom = parseInt(parts[1].trim());
    const workingDays = scheduleMode === 'weekend' ? ['saturday', 'sunday'] : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    const matchedDay = workingDays.find(d => d.toLowerCase() === targetDayInput);

    if (!matchedDay || isNaN(targetRoom) || targetRoom < 1 || targetRoom > totalRooms) {
        alert(`Invalid Day or Room number (Rooms are 1 to ${totalRooms}). Check your input.`);
        return;
    }

    const targetDayFormatted = matchedDay.charAt(0).toUpperCase() + matchedDay.slice(1);
    const occupantIndex = activeModules.findIndex(m => m.day === targetDayFormatted && m.room === targetRoom);

    if (occupantIndex !== -1 && occupantIndex !== index) {
        const tempDay = activeModules[index].day;
        const tempRoom = activeModules[index].room;

        activeModules[index].day = activeModules[occupantIndex].day;
        activeModules[index].room = activeModules[occupantIndex].room;

        activeModules[occupantIndex].day = tempDay;
        activeModules[occupantIndex].room = tempRoom;
    } else {
        activeModules[index].day = targetDayFormatted;
        activeModules[index].room = targetRoom;
    }

    await syncLecturerChanges();
    renderRosterChips();
    renderLecturerSchedule();
    alert("Class successfully relocated!");
}

async function cancelClass(index) {
    if (confirm("Are you sure you want to cancel/remove this class?")) {
        activeModules.splice(index, 1);
        await syncLecturerChanges();
        renderRosterChips();
        renderLecturerSchedule();
        alert("Class cancelled successfully!");
    }
}

function renderLecturerSchedule() {
    lecturerTable.innerHTML = '';

    if (activeModules.length === 0) {
        lecturerTable.innerHTML = '<tr><td class="note">No schedule entries found.</td></tr>';
        return;
    }

    const workingDays = scheduleMode === 'weekend' ? ['Saturday', 'Sunday'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    let headerRow = '<tr><th>Day</th>';
    for (let r = 1; r <= totalRooms; r++) {
        headerRow += `<th>Room ${r}</th>`;
    }
    headerRow += '</tr>';
    lecturerTable.innerHTML += headerRow;

    workingDays.forEach(day => {
        let rowHtml = `<tr><td><strong>${day}</strong></td>`;
        
        for (let room = 1; room <= totalRooms; room++) {
            const item = activeModules.find(m => m.day === day && m.room === room);

            if (item) {
                const globalIndex = activeModules.indexOf(item);

                if (!selectedLecturer || item.lec === selectedLecturer) {
                    let actionButtons = '';
                    if (holdsEditPrivileges) {
                        actionButtons = `
                            <div style="margin-top:6px; display:flex; gap:4px;">
                                <button onclick="moveOrSwapClass(${globalIndex})" style="padding:2px 6px; font-size:10px; background:royalblue; color:white; border:none; border-radius:3px; cursor:pointer;">Move/Swap</button>
                                <button onclick="cancelClass(${globalIndex})" style="padding:2px 6px; font-size:10px; background:crimson; color:white; border:none; border-radius:3px; cursor:pointer;">Cancel</button>
                            </div>`;
                    }

                    rowHtml += `<td style="${selectedLecturer ? 'background-color:whitesmoke; border-left:3px solid mediumpurple;' : ''}">
                        <div style="font-size:12px; line-height:1.2;">
                            <strong style="color:rebeccapurple;">[${item.id}]</strong> <strong>${item.name}</strong><br>
                            <span style="color:darkslategrey;">Fac: ${item.fac || 'General'}</span><br>
                            <span style="font-size:10px; color:slategrey; font-weight:600;">Group: ${item.prog} Y${item.year} (Sem ${item.sem})</span>
                            ${actionButtons}
                        </div>
                    </td>`;
                } else {
                    rowHtml += '<td style="color:silver; font-style:italic; font-size:11px;">Other Faculty Session</td>';
                }
            } else {
                rowHtml += '<td style="color:silver; font-style:italic; font-size:11px;">Unassigned Window</td>';
            }
        }
        rowHtml += '</tr>';
        lecturerTable.innerHTML += rowHtml;
    });
}