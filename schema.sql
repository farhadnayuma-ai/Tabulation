-- ==============================================================
-- Tabulation Database Schema
-- Database Name: tabulation_db
-- ==============================================================

CREATE DATABASE IF NOT EXISTS tabulation_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tabulation_db;

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    admin_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Admin Keys & Settings Table
CREATE TABLE IF NOT EXISTS admin_keys (
    key_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NOT NULL UNIQUE,
    pass_key VARCHAR(64) DEFAULT NULL,
    modify_key VARCHAR(64) DEFAULT NULL,
    pass_key_hash CHAR(64) DEFAULT NULL UNIQUE,
    modify_key_hash CHAR(64) DEFAULT NULL UNIQUE,
    schedule_mode VARCHAR(20) DEFAULT 'weekday',
    total_rooms INT DEFAULT 3,
    start_hour VARCHAR(10) DEFAULT '08:00',
    end_hour VARCHAR(10) DEFAULT '17:00',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Admin Modules Table (Each admin's timetable entries)
CREATE TABLE IF NOT EXISTS admin_modules (
    module_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NOT NULL,
    program VARCHAR(100) NOT NULL,
    study_year VARCHAR(20) NOT NULL,
    semester VARCHAR(30) NOT NULL,
    module_name VARCHAR(150) NOT NULL,
    module_code VARCHAR(30) NOT NULL,
    lecturer VARCHAR(100) NOT NULL,
    faculty VARCHAR(100) NOT NULL,
    assigned_day VARCHAR(20) DEFAULT NULL,
    room VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_admin_modules_admin (admin_id),
    CONSTRAINT fk_admin_modules_admin FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Timetables Table
CREATE TABLE IF NOT EXISTS timetables (
    timetable_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    semester VARCHAR(30) NOT NULL,
    course_code VARCHAR(30) NOT NULL,
    course_name VARCHAR(150) NOT NULL,
    lecturer VARCHAR(100),
    day_of_week ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_class_time CHECK (end_time > start_time),
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE,
    INDEX idx_admin_schedule (admin_id, academic_year, semester, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
