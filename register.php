<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

function send_json_response($is_successful, $alert_message, $http_status_code = 200, $data = []) {
    http_response_code($http_status_code);
    echo json_encode(array_merge([
        'success' => $is_successful,
        'message' => $alert_message
    ], $data));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_json_response(false, 'POST requests only.', 405);
}

$username = trim($_POST['username'] ?? '');

file_put_contents(
      __DIR__ . '/debug.txt',
      'Username received: [' . $username . ']'
);

$password = $_POST['password'] ?? '';

$username_length = strlen($username);
$has_allowed_characters = preg_match('/^[a-zA-Z0-9_.-]+$/', $username);

if ($username_length < 3 || $username_length > 50 || !$has_allowed_characters) {
    send_json_response(false, 'Username must be 3-50 valid characters.', 400);
}

$password_length = strlen($password);
if ($password_length < 10 || $password_length > 72) {
    send_json_response(false, 'Password must be 10-72 bytes long.', 400);
}

try {
    $database_query = $pdo->prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)');
    $database_query->execute([
        $username,
        password_hash($password, PASSWORD_DEFAULT)
    ]);

    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $pdo->lastInsertId();
    $_SESSION['admin_username'] = $username;

    send_json_response(true, 'Account created successfully.', 200, [
        'admin_id' => (int) $_SESSION['admin_id'],
        'username' => $username
    ]);

} catch (PDOException $database_error) {
    if ($database_error->getCode() === '23000') {
        send_json_response(false, 'That username already exists.', 409);
    }

    error_log($database_error->getMessage());
    send_json_response(false, 'Registration failed. Please try again.', 500);
}
?>

