<?php
$host = 'localhost';
$dbname = 'tabulation_db';
$username = 'root';
$password = '';

try {
	$pdo = new PDO(
"mysql:host=$host;dbname=$dbname;charset=utf8mb4",
             $username,
             $password
	);

	$pdo->setAttribute(
         PDO::ATTR_ERRMODE,
         PDO::ERRMODE_EXCEPTION
	);
} catch (PDOException $e) {
	error_log($e->getMessage());
	http_response_code(500);
	exit("Database connection failed ");
}
?>