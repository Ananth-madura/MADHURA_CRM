# ACHME CRM — Client Go-Live Quickstart Guide

This guide describes how to deploy the ACHME CRM on a client's Windows computer (server) and make it accessible to employees on the local network (WiFi/LAN).

---

## 💻 System Architecture

Once installed, the system runs as a lightweight self-hosted local intranet cloud:
```text
Employee Browser ──> http://<SERVER_IP>:82 ──> Nginx ──> PM2 Backend (Port 5000) ──> MySQL
```

---

## 📋 Requirements
The client computer only needs **two prerequisites** pre-installed:
1. **Node.js** (v18 or higher recommended)
2. **MySQL Server** (any version like 5.7, 8.0, 8.4, 9.0, or MariaDB)

*Everything else (Nginx, PM2, database user creation, database schema, firewall rules, hosts mapping, and startup schedulers) is automatically downloaded, configured, and run by the one-click installer.*

---

## 🚀 One-Click Go-Live Instructions

### 1. Prepare Folder on Client Computer
Copy the full `ACHME_COMUNICATION-main` folder to a simple location on the client computer, for example:
* `D:\ACHME_COMUNICATION-main`
* `C:\ACHME_COMUNICATION-main`
*(Avoid folders linked to OneDrive, temporary USB locations, or Windows Downloads cleanup folders).*

### 2. Run the One-Click Setup
1. Inside the folder, locate **`start-servers.bat`**.
2. **Right-click `start-servers.bat`** and select **"Run as Administrator"** (or double-click and click **Yes** to allow Administrator elevation).
3. The setup will launch a terminal console and perform the following 10 steps automatically:
   - **Step 1/10**: Detects and starts the local MySQL service.
   - **Step 2/10**: Verifies Node.js installation.
   - **Step 3/10**: Writes the production environment configuration.
   - **Step 4/10**: Configures database users and initializes tables.
   - **Step 5/10**: Installs PM2 globally and binds the PATH.
   - **Step 6/10**: Prepares the cached frontend web assets.
   - **Step 7/10**: Downloads Nginx, installs it to `C:\nginx\`, and writes configuration.
   - **Step 8/10**: Starts the backend under PM2 with automatic crash recovery.
   - **Step 9/10**: Adds persistent Port 82 & 5000 firewall rules, adds Nginx-specific application-level exceptions (bypassing corporate firewall/antivirus blocks), maps the `achme.com` domain, and registers boot startup schedulers.
   - **Step 10/10**: Performs a full health-check of Nginx, the Backend, and loopbacks, and automatically launches all 3 dynamic URLs (`localhost:82`, `IP:82`, `hostname:82`) in separate default browser tabs.

---

## 🌐 How to Access the System

Once setup completes, **`show.bat`** will automatically pop up in a new window. It dynamically detects the server’s active LAN IP and displays the access details:

### 1. From the Server Computer:
* **Friendly Domain**: `http://achme.com`
* **Localhost**: `http://localhost:82`
* **Loopback**: `http://127.0.0.1:82`
* **Hostname**: `http://<SERVER_HOSTNAME>:82`

### 2. From Employee Computers & Mobile Devices (on the same WiFi/LAN):
* **Direct IP URL**: `http://<SERVER_LAN_IP>:82` (Example: `http://192.168.1.110:82`)
* **Friendly Domain**: `http://achme.com` *(To use achme.com on an employee PC, simply copy the `employee-hosts-setup.bat` file from the server folder to their PC, right-click, and "Run as Administrator" once).*

### 🔑 Admin Credentials:
* **Email**: `Kk@achmecommunication.com`
* **Password**: `kk@admin@123`

---

## 🔄 Automated Lifetime Auto-Boot

You do not need to leave terminal windows open! Setup automatically configures two Scheduled Tasks for maximum uptime:
1. **`ACHME_CRM_AutoBoot` (Power-on task)**: Triggers silently when the computer turns on (before anyone logs in), starting Nginx, MySQL, and the PM2 backend in the background.
2. **`ACHME_CRM_Login_Startup` (Logon task)**: Triggers when the user logs in. It dynamically checks if their dynamic IP address changed, re-maps `achme.com` and `IBM-SERVER` to the new IP, and automatically pops up **`show.bat`** on their screen so they know the current access address!

---

## 🛠️ Troubleshooting & Support

### 🛑 If the setup closes instantly
* **Reason**: This was due to unescaped pipelines in the old installer. The new setup is **100% pipeline-free** and immune to CMD syntax crashes. Ensure you are running the updated `start-servers.bat`.
* **Fix**: Ensure your antivirus is not blocking PowerShell execution.

### 🔴 If you see "Cannot connect to server! Start backend on port 5000" in the browser
* **Reason**: Nginx is running on port 82, but the backend process is stopped under PM2.
* **Fix**: Run `start-servers.bat` as Administrator again to restore the backend, or check status with `pm2 status`.

### 🔄 What if the router changes the server's IP address dynamically?
* **No manual configuration needed!** The auto-boot script is fully dynamic. Simply restart the server computer (or re-run `start-servers.bat`), and Nginx, Hosts mappings, and `show.bat` will instantly re-configure and bind to their new dynamic IP!

---

## 📊 Useful Command Reference

* **Check backend status**: `pm2 status`
* **Check live backend logs**: `pm2 logs achme-backend` or double-click `show-live-logs.bat`
* **Stop Nginx manually**: `taskkill /F /IM nginx.exe`
* **Deregister all services & tasks (uninstaller)**: Run `uninstall-boot-startup.bat` as Administrator.
