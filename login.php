
<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

function send_login_response($success, $message, $status = 200, $data = []) {
    http_response_code($status);
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_login_response(false, 'POST requests only.', 405);
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

if ($username === '' || $password === '') {
    send_login_response(false, 'Enter your username and password.', 400);
}

try {
    $query = $pdo->prepare(
        'SELECT admin_id, username, password_hash
         FROM admins
         WHERE username = ?'
    );

    $query->execute([$username]);
    $admin = $query->fetch(PDO::FETCH_ASSOC);

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        send_login_response(false, 'Incorrect username or password.', 401);
    }

    session_regenerate_id(true);

    $_SESSION['admin_id'] = (int) $admin['admin_id'];
    $_SESSION['admin_username'] = $admin['username'];

    send_login_response(true, 'Login successful!', 200, [
        'admin_id' => (int) $admin['admin_id'],
        'username' => $admin['username']
    ]);

} catch (PDOException $error) {
    error_log($error->getMessage());
    send_login_response(false, 'A server error occurred.', 500);
}
?>
