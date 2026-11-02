# Project Report: Tabulation – University Timetable Management System

---

## 1. Executive Summary & Overview
**I built Tabulation**, a web-based timetable generation and distribution system using **PHP, MySQL, HTML, CSS, and JavaScript**, hosted locally on an Apache web server via **XAMPP**.

I designed the platform to make schedule planning effortless by splitting duties into three distinct portals:
1. **Admin Hub**: I configured this portal for authorized administrators to set academic parameters, input course modules, auto-generate timetables, and issue access tokens.
2. **Lecturer Portal**: I created this view for faculty members to check personalized schedules using an admin-issued **Public Access Pass**. If they have an authorized **Modify Key**, they can reschedule, relocate, or cancel classes.
3. **Student & Public Portal**: I built a simple interface where students enter an **Access Pass** to view timetable grids and filter schedules by program, academic year, and semester.

---

## 2. System Workflow & Data Architecture

### 2.1 Timetable Creation Workflow
1. **Configuration**: I programmed the system to let the administrator select the starting hour, finishing hour, total available lecture rooms, and schedule mode (Weekday or Weekend).
2. **Adding Modules**: I enabled the admin to enter course details including the program name, study year, semester, course name, course code, assigned lecturer, and faculty.
3. **Auto-Allocation Algorithm**: I wrote an algorithm that cycles through each working day and assigns queued courses to available rooms. I configured it to automatically label remaining unfilled slots as `Available Slot` or `Free Window`.
4. **Publishing**: I wired the **Generate Master Timetable** button to send assignments directly to the server, permanently saving them to the MySQL database.

---

### 2.2 User Authentication (Login & Logout)
* **Registration (`register.php`)**: I implemented secure administrator registration by checking for unique usernames and hashing passwords using PHP's `password_hash($password, PASSWORD_DEFAULT)`.
* **Login (`login.php`)**: I integrated PHP's `password_verify()` to authenticate admin credentials against saved hashes. Once validated, I started a protected session by storing `$_SESSION['admin_id']`.
* **Session Verification (`api.php`)**: I attached an immediate backend session check to `admin.html` that locks unauthorized users out of the dashboard and forces them to see the login box if a session is missing.
* **Logout (`logout.php`)**: I configured the logout script to clear the `$_SESSION` array, invalidate browser session cookies, and redirect users to `tabhome.html`.

---

### 2.3 Data Storage Architecture
I replaced the volatile browser memory (`localStorage`) with a persistent **MySQL** architecture utilizing PHP Data Objects (`PDO`):

| Table | Purpose |
| :--- | :--- |
| **`admins`** | I created this to store admin accounts and hashed credentials. |
| **`admin_modules`** | I created this to track course modules, assigned days, and rooms linked to an admin. |
| **`admin_keys`** | I created this to store unique security tokens and timetable constraints. |

---

## 3. Core Challenges Solved

### Issue 1: Migrating from Volatile Browser Storage to XAMPP
* **What I changed**: I found that saving data using JavaScript's `localStorage` restricted data to a single browser window. **I created a dedicated backend database (`tabulation_db`) in MySQL** and wrote `db.php` using `PDO` to establish a persistent server link, migrating all data saving from browser memory into database queries inside `api.php`.

### Issue 2: Eliminating Admin Data Overlap
* **What I changed**: Because data was previously read from a single shared storage key, administrators risked overwriting each other's schedules. **I rewrote the database queries in `api.php` to strictly filter records** by the logged-in user's unique ID (`$_SESSION['admin_id']`), isolating each workspace completely.

### Issue 3: Securing the Admin Console Frontdoor
* **What I changed**: The original `admin.html` was a static file that merely used a CSS class to hide the dashboard, making it easy to bypass using browser developer tools. **I built a server-side session guard in `api.php`** to reject unauthorized requests and added an immediate asynchronous check in `admin.js` to keep the interface locked until the server authorizes the user.

### Issue 4: Restricting Public Access to Lecturer Schedules
* **What I changed**: Previously, `lecturer.html` automatically rendered whatever schedule was cached without verifying identity. **I hid all timetable data and modification tools by default** and configured the script to only pull and render schedules after verifying a valid **Public Access Pass** with the server.

---

## 4. Token & Security Key Mechanisms

I developed a two-token system to grant tailored access to external users without forcing them to create full administrator login accounts:

### 1. Public Access Pass (`PASS-XXXXX`)
* **How I built it**: I wrote a script in `admin.js` to automatically generate a unique random string starting with `PASS-`. 
* **How I used it**: I engineered `api.php` to accept this pass from students or lecturers, look up the corresponding `admin_id` in `admin_keys`, and securely fetch the associated read-only timetable data.

### 2. Public Modify Key (`KEY-XXXXX`)
* **How I built it**: I set up an additional generator in `admin.js` that outputs a separate authorization key prefixed with `KEY-`.
* **How I used it**: I built an authentication query in `api.php` that verifies both the active Access Pass and the entered Modify Key. The system activates the **Move/Swap** and **Cancel** adjustment buttons in the Lecturer Portal only when both keys match a valid administrator record.

---

## 5. System File Architecture

I organized the project files utilizing the **Separation of Concerns** principle, splitting tasks into clear layers rather than keeping markup, styling, and server logic tangled together:

* **HTML (`.html`)**: I used these files (`admin.html`, `lecturer.html`, `student.html`, `tabhome.html`) strictly to construct the layout skeleton, buttons, and display tables.
* **CSS (`.css`)**: I wrote these stylesheets to isolate visual design, responsiveness, card styling, and custom layouts from structural logic.
* **JavaScript (`.js`)**: I deployed frontend scripts to make the interface dynamic, letting users click buttons, filter listings, and fetch backend updates instantly without page reloads.
* **PHP (`.php`)**: I implemented server-side logic scripts to securely handle database interaction (`db.php`), authorize incoming API requests (`api.php`), and manage login sessions safely away from the browser.
* **Configuration Files (`.htaccess`, `.sql`)**: I configured Apache routing rules via `.htaccess` to serve `tabhome.html` as the automatic root homepage and generated `schema.sql` to map our relational database setup.

---

## 6. Project Checklist
- [x] **Database Migration**: All information lives in MySQL via XAMPP instead of browser storage.
- [x] **Session Protection**: Implemented server-side guards and secure `BCRYPT` password hashing.
- [x] **Workspace Isolation**: Configured queries to isolate admin accounts from seeing or overwriting other data.
- [x] **Token Authentication**: Implemented explicit Access Pass validation for read-only timetable queries.
- [x] **Action Logging**: Enabled live schedule modifications exclusively through verified Modify Keys.
- [x] **Home Directory Routing**: Maintained explicit default routing to serve `tabhome.html` at the project root.
