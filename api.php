<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

function json_out($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === '' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = json_decode(file_get_contents('php://input'), true);
    if (is_array($rawInput) && !empty($rawInput['action'])) {
        $action = $rawInput['action'];
    }
}

if ($action === 'check_session') {
    if (!isset($_SESSION['admin_id'])) {
        json_out(['logged_in' => false]);
    }

    $adminId = (int) $_SESSION['admin_id'];
    $stmt = $pdo->prepare('SELECT admin_id, username FROM admins WHERE admin_id = ?');
    $stmt->execute([$adminId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$admin) {
        $_SESSION = [];
        session_destroy();
        json_out(['logged_in' => false]);
    }

    $stmtKey = $pdo->prepare('SELECT pass_key, modify_key, schedule_mode, total_rooms, start_hour, end_hour FROM admin_keys WHERE admin_id = ?');
    $stmtKey->execute([$adminId]);
    $keys = $stmtKey->fetch(PDO::FETCH_ASSOC) ?: [
        'pass_key' => '',
        'modify_key' => '',
        'schedule_mode' => 'weekday',
        'total_rooms' => 3,
        'start_hour' => '08:00',
        'end_hour' => '17:00'
    ];

    $stmtMods = $pdo->prepare('SELECT program AS prog, study_year AS year, semester AS sem, module_name AS name, module_code AS id, lecturer AS lec, faculty AS fac, assigned_day AS day, room FROM admin_modules WHERE admin_id = ? ORDER BY module_id ASC');
    $stmtMods->execute([$adminId]);
    $modules = $stmtMods->fetchAll(PDO::FETCH_ASSOC);

    foreach ($modules as &$m) {
        if ($m['room'] !== null) {
            $m['room'] = (int) $m['room'];
        }
    }

    json_out([
        'logged_in' => true,
        'admin_id' => $adminId,
        'username' => $admin['username'],
        'keys' => $keys,
        'modules' => $modules
    ]);
}

if ($action === 'save_admin_data') {
    if (!isset($_SESSION['admin_id'])) {
        json_out(['success' => false, 'message' => 'Unauthorized. Please log in.'], 401);
    }

    $adminId = (int) $_SESSION['admin_id'];
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        $input = $_POST;
    }

    $passKey = trim($input['pass_key'] ?? '');
    $modifyKey = trim($input['modify_key'] ?? '');
    $scheduleMode = in_array($input['schedule_mode'] ?? '', ['weekend', 'weekday']) ? $input['schedule_mode'] : 'weekday';
    $totalRooms = max(1, (int) ($input['total_rooms'] ?? 3));
    $startHour = trim($input['start_hour'] ?? '08:00');
    $endHour = trim($input['end_hour'] ?? '17:00');
    $modules = $input['modules'] ?? [];

    $pdo->beginTransaction();
    try {
        $passHash = $passKey !== '' ? hash('sha256', $passKey) : null;
        $modifyHash = $modifyKey !== '' ? hash('sha256', $modifyKey) : null;

        $upsertKeys = $pdo->prepare('
            INSERT INTO admin_keys (admin_id, pass_key, modify_key, pass_key_hash, modify_key_hash, schedule_mode, total_rooms, start_hour, end_hour)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                pass_key = VALUES(pass_key),
                modify_key = VALUES(modify_key),
                pass_key_hash = VALUES(pass_key_hash),
                modify_key_hash = VALUES(modify_key_hash),
                schedule_mode = VALUES(schedule_mode),
                total_rooms = VALUES(total_rooms),
                start_hour = VALUES(start_hour),
                end_hour = VALUES(end_hour)
        ');
        $upsertKeys->execute([
            $adminId,
            $passKey ?: null,
            $modifyKey ?: null,
            $passHash,
            $modifyHash,
            $scheduleMode,
            $totalRooms,
            $startHour,
            $endHour
        ]);

        $del = $pdo->prepare('DELETE FROM admin_modules WHERE admin_id = ?');
        $del->execute([$adminId]);

        if (is_array($modules) && count($modules) > 0) {
            $insert = $pdo->prepare('
                INSERT INTO admin_modules
                (admin_id, program, study_year, semester, module_name, module_code, lecturer, faculty, assigned_day, room)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');

            foreach ($modules as $mod) {
                $insert->execute([
                    $adminId,
                    trim($mod['prog'] ?? ''),
                    trim($mod['year'] ?? ''),
                    trim($mod['sem'] ?? ''),
                    trim($mod['name'] ?? ''),
                    trim($mod['id'] ?? ''),
                    trim($mod['lec'] ?? ''),
                    trim($mod['fac'] ?? ''),
                    !empty($mod['day']) ? trim($mod['day']) : null,
                    isset($mod['room']) && $mod['room'] !== '' ? (int) $mod['room'] : null
                ]);
            }
        }

        $pdo->commit();
        json_out(['success' => true, 'message' => 'Timetable saved successfully.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log($e->getMessage());
        json_out(['success' => false, 'message' => 'Failed to save data.'], 500);
    }
}

if ($action === 'get_timetable_by_pass') {
    $pass = trim($_GET['pass'] ?? $_POST['pass'] ?? '');

    if ($pass === '') {
        json_out(['success' => false, 'message' => 'Please enter an Access Pass.'], 400);
    }

    $passHash = hash('sha256', $pass);
    $stmt = $pdo->prepare('
        SELECT k.admin_id, k.schedule_mode, k.total_rooms, k.start_hour, k.end_hour, a.username
        FROM admin_keys k
        JOIN admins a ON a.admin_id = k.admin_id
        WHERE k.pass_key = ? OR k.pass_key_hash = ?
    ');
    $stmt->execute([$pass, $passHash]);
    $keyRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$keyRow) {
        json_out(['success' => false, 'message' => 'Invalid Access Pass! Please check and try again.'], 404);
    }

    $adminId = (int) $keyRow['admin_id'];

    $stmtMods = $pdo->prepare('
        SELECT program AS prog, study_year AS year, semester AS sem, module_name AS name, module_code AS id, lecturer AS lec, faculty AS fac, assigned_day AS day, room
        FROM admin_modules
        WHERE admin_id = ?
        ORDER BY module_id ASC
    ');
    $stmtMods->execute([$adminId]);
    $modules = $stmtMods->fetchAll(PDO::FETCH_ASSOC);

    foreach ($modules as &$m) {
        if ($m['room'] !== null) {
            $m['room'] = (int) $m['room'];
        }
    }

    json_out([
        'success' => true,
        'username' => $keyRow['username'],
        'schedule_mode' => $keyRow['schedule_mode'] ?: 'weekday',
        'total_rooms' => (int) ($keyRow['total_rooms'] ?: 3),
        'start_hour' => $keyRow['start_hour'] ?: '08:00',
        'end_hour' => $keyRow['end_hour'] ?: '17:00',
        'modules' => $modules
    ]);
}

if ($action === 'verify_modify_key') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $pass = trim($input['pass'] ?? $_GET['pass'] ?? '');
    $key = trim($input['key'] ?? $_GET['key'] ?? '');

    if ($pass === '' || $key === '') {
        json_out(['success' => false, 'message' => 'Access pass and modify key are required.'], 400);
    }

    $passHash = hash('sha256', $pass);
    $keyHash = hash('sha256', $key);

    $stmt = $pdo->prepare('
        SELECT admin_id
        FROM admin_keys
        WHERE (pass_key = ? OR pass_key_hash = ?)
          AND (modify_key = ? OR modify_key_hash = ?)
    ');
    $stmt->execute([$pass, $passHash, $key, $keyHash]);
    $found = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($found) {
        json_out(['success' => true, 'message' => 'Access Granted! Modification privileges unlocked.']);
    } else {
        json_out(['success' => false, 'message' => 'Invalid modify key for this timetable.'], 403);
    }
}

if ($action === 'lecturer_save_timetable') {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $pass = trim($input['pass'] ?? '');
    $key = trim($input['key'] ?? '');
    $modules = $input['modules'] ?? null;

    if ($pass === '' || $key === '' || !is_array($modules)) {
        json_out(['success' => false, 'message' => 'Missing required data.'], 400);
    }

    $passHash = hash('sha256', $pass);
    $keyHash = hash('sha256', $key);

    $stmt = $pdo->prepare('
        SELECT admin_id
        FROM admin_keys
        WHERE (pass_key = ? OR pass_key_hash = ?)
          AND (modify_key = ? OR modify_key_hash = ?)
    ');
    $stmt->execute([$pass, $passHash, $key, $keyHash]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        json_out(['success' => false, 'message' => 'Unauthorized modification.'], 403);
    }

    $adminId = (int) $row['admin_id'];

    $pdo->beginTransaction();
    try {
        $del = $pdo->prepare('DELETE FROM admin_modules WHERE admin_id = ?');
        $del->execute([$adminId]);

        $insert = $pdo->prepare('
            INSERT INTO admin_modules
            (admin_id, program, study_year, semester, module_name, module_code, lecturer, faculty, assigned_day, room)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');

        foreach ($modules as $mod) {
            $insert->execute([
                $adminId,
                trim($mod['prog'] ?? ''),
                trim($mod['year'] ?? ''),
                trim($mod['sem'] ?? ''),
                trim($mod['name'] ?? ''),
                trim($mod['id'] ?? ''),
                trim($mod['lec'] ?? ''),
                trim($mod['fac'] ?? ''),
                !empty($mod['day']) ? trim($mod['day']) : null,
                isset($mod['room']) && $mod['room'] !== '' ? (int) $mod['room'] : null
            ]);
        }

        $pdo->commit();
        json_out(['success' => true, 'message' => 'Timetable updated successfully.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log($e->getMessage());
        json_out(['success' => false, 'message' => 'Failed to update timetable.'], 500);
    }
}

json_out(['success' => false, 'message' => 'Unknown action.'], 400);
?>
