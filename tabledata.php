
<?php
session_start();

require_once __DIR__ . '/db.php';

$message = '';
$success = false;

if (!isset($_SESSION['admin_id'])) {
    http_response_code(401);
    exit('Please log in as Admin A first, then open this page again.');
}

$adminId = (int) $_SESSION['admin_id'];

$checkAdmin = $pdo->prepare(
    'SELECT username FROM admins WHERE admin_id = ?'
);
$checkAdmin->execute([$adminId]);
$admin = $checkAdmin->fetch(PDO::FETCH_ASSOC);

if (!$admin) {
    http_response_code(401);
    exit('Admin account not found. Please log in again.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (
            !isset($_FILES['backup']) ||
            $_FILES['backup']['error'] !== UPLOAD_ERR_OK
        ) {
            throw new RuntimeException('Please select your JSON backup file.');
        }

        if ($_FILES['backup']['size'] > 2 * 1024 * 1024) {
            throw new RuntimeException('The backup file must be under 2 MB.');
        }

        $json = file_get_contents($_FILES['backup']['tmp_name']);
        $modules = json_decode($json, true);

        if (!is_array($modules) || json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('The file is not valid JSON.');
        }

        if (count($modules) === 0 || count($modules) > 500) {
            throw new RuntimeException(
                'The backup must contain between 1 and 500 modules.'
            );
        }

        $count = $pdo->prepare(
            'SELECT COUNT(*) FROM admin_modules WHERE admin_id = ?'
        );
        $count->execute([$adminId]);

        if ((int) $count->fetchColumn() > 0) {
            throw new RuntimeException(
                'This admin already has imported modules. No data was changed.'
            );
        }

        $required = [
            'prog', 'year', 'sem', 'name', 'id', 'lec', 'fac'
        ];

        foreach ($modules as $index => $module) {
            if (!is_array($module)) {
                throw new RuntimeException(
                    'Invalid module at item ' . ($index + 1) . '.'
                );
            }

            foreach ($required as $field) {
                if (
                    !isset($module[$field]) ||
                    !is_string($module[$field]) ||
                    trim($module[$field]) === ''
                ) {
                    throw new RuntimeException(
                        'Missing or invalid "' . $field .
                        '" in module ' . ($index + 1) . '.'
                    );
                }
            }

            $limits = [
                'prog' => 100,
                'year' => 20,
                'sem' => 30,
                'name' => 150,
                'id' => 30,
                'lec' => 100,
                'fac' => 100
            ];

            foreach ($limits as $field => $limit) {
                if (strlen(trim($module[$field])) > $limit) {
                    throw new RuntimeException(
                        'Field "' . $field .
                        '" is too long in module ' . ($index + 1) . '.'
                    );
                }
            }
        }

        $insert = $pdo->prepare(
            'INSERT INTO admin_modules
            (admin_id, program, study_year, semester,
             module_name, module_code, lecturer, faculty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $pdo->beginTransaction();

        foreach ($modules as $module) {
            $insert->execute([
                $adminId,
                trim($module['prog']),
                trim($module['year']),
                trim($module['sem']),
                trim($module['name']),
                trim($module['id']),
                trim($module['lec']),
                trim($module['fac'])
            ]);
        }

        $pdo->commit();
        $success = true;
        $message = count($modules) .
            ' modules imported for ' . $admin['username'] . '.';

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        $message = $e instanceof RuntimeException
            ? $e->getMessage()
            : 'Import failed. No partial import was kept. Check the PHP error log.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Import Timetable Modules</title>
</head>
<body>
    <h2>Import Existing Modules</h2>

    <p>
        Logged-in admin:
        <strong><?= htmlspecialchars($admin['username']) ?></strong>
    </p>

    <?php if ($message !== ''): ?>
        <p>
            <?= htmlspecialchars($message) ?>
        </p>
    <?php endif; ?>

    <?php if (!$success): ?>
        <form method="post" enctype="multipart/form-data">
            <label for="backup">Select timetable_backup.json:</label>
            <input
                type="file"
                id="backup"
                name="backup"
                accept=".json,application/json"
                required
            >
            <button type="submit">Import Modules</button>
        </form>
    <?php endif; ?>
</body>
</html>

