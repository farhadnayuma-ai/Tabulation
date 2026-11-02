const btnLoadPass = document.getElementById('btnLoadPass');
const inputAccessPass = document.getElementById('inputAccessPass');
const studentTable = document.getElementById('studentTimetableTable');
const filterProg = document.getElementById('filterProg');
const filterYear = document.getElementById('filterYear');
const filterSem = document.getElementById('filterSem');
const lblProgram = document.getElementById('lblProgram');
const lblYear = document.getElementById('lblYear');
const lblSemester = document.getElementById('lblSemester');

let activeModules = [];
let scheduleMode = 'weekday';
let totalRooms = 3;

btnLoadPass.addEventListener('click', async () => {
    const enteredPass = inputAccessPass.value.trim();

    if (!enteredPass) {
        alert("Please enter a Public Access Pass.");
        return;
    }

    try {
        const response = await fetch('api.php?action=get_timetable_by_pass&pass=' + encodeURIComponent(enteredPass));
        const result = await response.json();

        if (response.ok && result.success) {
            alert(`🎫 Access Pass Accepted! Timetable loaded for Admin: ${result.username}`);
            activeModules = Array.isArray(result.modules) ? result.modules : [];
            scheduleMode = result.schedule_mode || 'weekday';
            totalRooms = result.total_rooms || 3;
            populateProgramDropdown();
            renderFilteredTimetable();
        } else {
            alert("❌ " + (result.message || "Invalid Access Pass! Please check and try again."));
            studentTable.innerHTML = '';
        }
    } catch (error) {
        console.error(error);
        alert("Could not connect to the server.");
    }
});

function populateProgramDropdown() {
    const uniquePrograms = [...new Set(activeModules.map(mod => mod.prog).filter(p => p && p.trim() !== ''))];
    filterProg.innerHTML = '<option value="">-- All Programs --</option>';
    
    uniquePrograms.forEach(prog => {
        const option = document.createElement('option');
        option.value = prog;
        option.textContent = prog;
        filterProg.appendChild(option);
    });
}

[filterProg, filterYear, filterSem].forEach(element => {
    element.addEventListener('change', () => {
        updateMetadataLabels();
        renderFilteredTimetable();
    });
});

function updateMetadataLabels() {
    lblProgram.textContent = filterProg.value || "All Programs";
    lblYear.textContent = filterYear.value ? `Year ${filterYear.value}` : "All Years";
    lblSemester.textContent = filterSem.value ? `Semester ${filterSem.value}` : "All Semesters";
}

function renderFilteredTimetable() {
    studentTable.innerHTML = '';
    
    const selectedProg = filterProg.value;
    const selectedYear = filterYear.value;
    const selectedSem = filterSem.value;

    let pool = activeModules.filter(mod => {
        const matchProg = !selectedProg || mod.prog === selectedProg;
        const matchYear = !selectedYear || String(mod.year) === selectedYear;
        const matchSem = !selectedSem || String(mod.sem) === selectedSem;
        return matchProg && matchYear && matchSem;
    });

    if (pool.length === 0) {
        studentTable.innerHTML = '<tr><td class="note">No schedule entries found matching this specific filter combo.</td></tr>';
        return;
    }

    const baseDays = scheduleMode === 'weekend' ? ['Saturday', 'Sunday'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    let headerRow = '<tr><th>Day</th>';
    for (let r = 1; r <= totalRooms; r++) {
        headerRow += `<th>Room ${r}</th>`;
    }
    headerRow += '</tr>';
    studentTable.innerHTML += headerRow;

    const hasAssignments = pool.some(m => m.day && m.room);

    if (hasAssignments) {
        baseDays.forEach(day => {
            let rowHtml = `<tr><td><strong>${day}</strong></td>`;
            for (let room = 1; room <= totalRooms; room++) {
                const item = pool.find(m => m.day === day && m.room === room);
                if (item) {
                    rowHtml += `<td>
                        <div style="font-size:12px; line-height:1.2;">
                            <strong style="color:royalblue;">${item.id}</strong><br>
                            <strong>${item.name}</strong><br>
                            <span style="color:slategrey;">Lec: ${item.lec}</span><br>
                            <span style="font-size:10px; background:whitesmoke; padding:2px 4px; border-radius:4px; display:inline-block; margin-top:2px;">${item.prog} Y${item.year} (Sem ${item.sem})</span>
                        </div>
                    </td>`;
                } else {
                    rowHtml += '<td style="color:slategrey; font-style:italic; font-size:11px;">Free Window</td>';
                }
            }
            rowHtml += '</tr>';
            studentTable.innerHTML += rowHtml;
        });
    } else {
        let slotPool = [...pool];
        baseDays.forEach(day => {
            let rowHtml = `<tr><td><strong>${day}</strong></td>`;
            for (let room = 1; room <= totalRooms; room++) {
                if (slotPool.length > 0) {
                    const currentSlot = slotPool.shift();
                    rowHtml += `<td>
                        <div style="font-size:12px; line-height:1.2;">
                            <strong style="color:royalblue;">${currentSlot.id}</strong><br>
                            <strong>${currentSlot.name}</strong><br>
                            <span style="color:slategrey;">Lec: ${currentSlot.lec}</span><br>
                            <span style="font-size:10px; background:whitesmoke; padding:2px 4px; border-radius:4px; display:inline-block; margin-top:2px;">${currentSlot.prog} Y${currentSlot.year} (Sem ${currentSlot.sem})</span>
                        </div>
                    </td>`;
                } else {
                    rowHtml += '<td style="color:slategrey; font-style:italic; font-size:11px;">Free Window</td>';
                }
            }
            rowHtml += '</tr>';
            studentTable.innerHTML += rowHtml;
        });
    }
}
