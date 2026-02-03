# CivQuest Azure IIS Deployment Guide

Complete guide for deploying CivQuest on an Azure Windows Server using IIS with the following subdomains:
- `https://notify.civ.quest` - Notification subscriber portal
- `https://atlas.civ.quest` - GIS mapping application
- `https://admin.civ.quest` - Administration portal

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Azure VM Setup](#2-azure-vm-setup)
3. [Windows Server Configuration](#3-windows-server-configuration)
4. [IIS Installation & Configuration](#4-iis-installation--configuration)
5. [Node.js Installation](#5-nodejs-installation)
6. [DNS Configuration](#6-dns-configuration)
7. [SSL Certificate Setup](#7-ssl-certificate-setup)
8. [Application Deployment](#8-application-deployment)
9. [IIS Site Configuration](#9-iis-site-configuration)
10. [URL Rewrite Rules](#10-url-rewrite-rules)
11. [Environment Variables](#11-environment-variables)
12. [Testing & Verification](#12-testing--verification)
13. [Maintenance & Updates](#13-maintenance--updates)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] Azure subscription with permissions to create resources
- [ ] Domain `civ.quest` with DNS management access
- [ ] SSL certificates for `*.civ.quest` (wildcard) or individual certificates
- [ ] CivQuest source code access (this repository)
- [ ] Firebase project credentials (`civquest-notify`)
- [ ] API keys:
  - Brevo API key (for email services)
  - Google Gemini API key (for AI features)
  - ArcGIS OAuth Client ID (already configured: `SPmTwmqIB2qEz51L`)

---

## 2. Azure VM Setup

### Option A: Create a Windows Server VM (Recommended)

1. **Log into Azure Portal** → https://portal.azure.com

2. **Create a Virtual Machine**:
   ```
   Resource Group: CivQuest-Production (or your preferred name)
   Virtual Machine Name: civquest-web-01
   Region: Choose closest to your users
   Image: Windows Server 2022 Datacenter - Gen2
   Size: Standard_D2s_v3 (2 vCPUs, 8 GB RAM) minimum
   ```

3. **Administrator Account**:
   ```
   Username: civquestadmin
   Password: [Create a strong password]
   ```

4. **Networking**:
   - Create a new Virtual Network or use existing
   - Allow inbound ports: **RDP (3389), HTTP (80), HTTPS (443)**

5. **Disks**:
   - OS Disk: Premium SSD, 128 GB minimum
   - Consider adding a data disk for logs/backups

6. **Review + Create** → Wait for deployment

### Option B: Azure App Service (Alternative)

If you prefer PaaS over IaaS, you can use Azure App Service with Windows. However, this guide focuses on IIS on a VM for more control.

### Configure Network Security Group (NSG)

After VM creation, ensure NSG rules allow:

| Priority | Name | Port | Protocol | Source | Action |
|----------|------|------|----------|--------|--------|
| 100 | Allow-HTTPS | 443 | TCP | Any | Allow |
| 110 | Allow-HTTP | 80 | TCP | Any | Allow |
| 120 | Allow-RDP | 3389 | TCP | Your IP | Allow |

> **Security Note**: Restrict RDP access to your IP address only, or use Azure Bastion for secure access.

### Assign Static Public IP

1. Go to your VM → **Networking** → Click on the Network Interface
2. **IP configurations** → Click on the IP configuration
3. Change **Assignment** from Dynamic to **Static**
4. Note your public IP address: `___.___.___.___ `

---

## 3. Windows Server Configuration

### Connect to the VM

1. From Azure Portal, go to your VM → **Connect** → **RDP**
2. Download RDP file and connect using your admin credentials

### Initial Server Setup

Open **PowerShell as Administrator** and run:

```powershell
# Set timezone (adjust as needed)
Set-TimeZone -Id "Eastern Standard Time"

# Enable Windows Update
Install-Module PSWindowsUpdate -Force
Get-WindowsUpdate -Install -AcceptAll -AutoReboot

# Create application directories
New-Item -ItemType Directory -Path "C:\inetpub\civquest" -Force
New-Item -ItemType Directory -Path "C:\inetpub\civquest\logs" -Force
New-Item -ItemType Directory -Path "C:\inetpub\civquest\certs" -Force
New-Item -ItemType Directory -Path "C:\tools" -Force

# Set folder permissions for IIS
$acl = Get-Acl "C:\inetpub\civquest"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule)
Set-Acl "C:\inetpub\civquest" $acl
```

---

## 4. IIS Installation & Configuration

### Install IIS with Required Features

Open **PowerShell as Administrator**:

```powershell
# Install IIS with all required features
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
Install-WindowsFeature -Name Web-Default-Doc
Install-WindowsFeature -Name Web-Dir-Browsing
Install-WindowsFeature -Name Web-Http-Errors
Install-WindowsFeature -Name Web-Static-Content
Install-WindowsFeature -Name Web-Http-Redirect
Install-WindowsFeature -Name Web-Http-Logging
Install-WindowsFeature -Name Web-Custom-Logging
Install-WindowsFeature -Name Web-Request-Monitor
Install-WindowsFeature -Name Web-Http-Tracing
Install-WindowsFeature -Name Web-Stat-Compression
Install-WindowsFeature -Name Web-Dyn-Compression
Install-WindowsFeature -Name Web-Filtering
Install-WindowsFeature -Name Web-Basic-Auth
Install-WindowsFeature -Name Web-Windows-Auth
Install-WindowsFeature -Name Web-Mgmt-Console
Install-WindowsFeature -Name Web-Mgmt-Service

# Verify installation
Get-WindowsFeature -Name Web-* | Where-Object {$_.Installed -eq $true}
```

### Install URL Rewrite Module

The URL Rewrite module is **required** for SPA routing. Download and install:

```powershell
# Download URL Rewrite Module 2.1
$url = "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"
$output = "C:\tools\rewrite_amd64.msi"
Invoke-WebRequest -Uri $url -OutFile $output

# Install silently
Start-Process msiexec.exe -ArgumentList "/i", $output, "/qn" -Wait

# Restart IIS
iisreset
```

### Install Application Request Routing (ARR) - Optional

Only needed if you plan to use reverse proxy features:

```powershell
# Download ARR 3.0
$url = "https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi"
$output = "C:\tools\arr_amd64.msi"
Invoke-WebRequest -Uri $url -OutFile $output

Start-Process msiexec.exe -ArgumentList "/i", $output, "/qn" -Wait
iisreset
```

---

## 5. Node.js Installation

Node.js is required to build the CivQuest application.

### Install Node.js LTS

```powershell
# Download Node.js LTS (v20.x recommended)
$nodeVersion = "20.11.0"
$url = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-x64.msi"
$output = "C:\tools\nodejs.msi"
Invoke-WebRequest -Uri $url -OutFile $output

# Install Node.js
Start-Process msiexec.exe -ArgumentList "/i", $output, "/qn" -Wait

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify installation
node --version
npm --version
```

### Install Git

```powershell
# Download Git for Windows
$url = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
$output = "C:\tools\git-installer.exe"
Invoke-WebRequest -Uri $url -OutFile $output

# Install Git silently
Start-Process $output -ArgumentList "/VERYSILENT", "/NORESTART" -Wait

# Refresh environment
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verify
git --version
```

---

## 6. DNS Configuration

Configure DNS records for your subdomains. Access your DNS provider (e.g., Cloudflare, Route 53, GoDaddy).

### Required DNS Records

Add these A records pointing to your Azure VM's public IP:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | notify | `<Your-VM-Public-IP>` | 3600 |
| A | atlas | `<Your-VM-Public-IP>` | 3600 |
| A | admin | `<Your-VM-Public-IP>` | 3600 |

### Verify DNS Propagation

Wait for DNS propagation (can take up to 48 hours, usually faster):

```powershell
# Test DNS resolution
nslookup notify.civ.quest
nslookup atlas.civ.quest
nslookup admin.civ.quest
```

---

## 7. SSL Certificate Setup

### Option A: Let's Encrypt with Win-ACME (Free - Recommended)

#### Install Win-ACME

```powershell
# Download Win-ACME
$url = "https://github.com/win-acme/win-acme/releases/download/v2.2.8.1635/win-acme.v2.2.8.1635.x64.pluggable.zip"
$output = "C:\tools\win-acme.zip"
Invoke-WebRequest -Uri $url -OutFile $output

# Extract
Expand-Archive -Path $output -DestinationPath "C:\tools\win-acme" -Force
```

#### Create Temporary HTTP Sites for Certificate Validation

Before requesting certificates, create temporary IIS sites:

1. Open **IIS Manager** (`inetmgr`)
2. Create three sites (we'll configure properly later):

```powershell
# Create temporary directories for each site
New-Item -ItemType Directory -Path "C:\inetpub\civquest\notify" -Force
New-Item -ItemType Directory -Path "C:\inetpub\civquest\atlas" -Force
New-Item -ItemType Directory -Path "C:\inetpub\civquest\admin" -Force

# Import IIS cmdlets
Import-Module WebAdministration

# Remove default site
Remove-Website -Name "Default Web Site" -ErrorAction SilentlyContinue

# Create sites for certificate validation (HTTP only initially)
New-Website -Name "notify.civ.quest" -PhysicalPath "C:\inetpub\civquest\notify" -HostHeader "notify.civ.quest" -Port 80
New-Website -Name "atlas.civ.quest" -PhysicalPath "C:\inetpub\civquest\atlas" -HostHeader "atlas.civ.quest" -Port 80
New-Website -Name "admin.civ.quest" -PhysicalPath "C:\inetpub\civquest\admin" -HostHeader "admin.civ.quest" -Port 80
```

#### Request Certificates

```powershell
cd C:\tools\win-acme

# Request certificate for all three domains
.\wacs.exe --target manual --host notify.civ.quest,atlas.civ.quest,admin.civ.quest --validation filesystem --webroot C:\inetpub\civquest --store certificatestore --certificatestore My --installation iis
```

Follow the prompts:
1. Choose "M" for Manual input
2. Enter email for notifications
3. Accept terms of service
4. Win-ACME will automatically configure IIS bindings

#### Setup Auto-Renewal

Win-ACME creates a scheduled task automatically. Verify:

```powershell
Get-ScheduledTask | Where-Object {$_.TaskName -like "*win-acme*"}
```

### Option B: Azure Key Vault Certificates

If you have certificates in Azure Key Vault:

1. Export the PFX from Key Vault
2. Import to Windows Certificate Store:

```powershell
$pfxPath = "C:\inetpub\civquest\certs\civquest-cert.pfx"
$pfxPassword = ConvertTo-SecureString -String "your-password" -Force -AsPlainText
Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation Cert:\LocalMachine\My -Password $pfxPassword
```

### Option C: Commercial Wildcard Certificate

If you have a `*.civ.quest` wildcard certificate:

1. Obtain the certificate from your CA
2. Import using IIS Manager or PowerShell (as shown above)
3. Apply to all three sites

---

## 8. Application Deployment

### Clone the Repository

```powershell
cd C:\inetpub\civquest

# Clone the repository
git clone https://github.com/tallmanjamie/CivQuest.git source

cd source
```

### Create Environment File

Create the `.env` file with your API keys:

```powershell
# Create .env file
@"
VITE_BREVO_API_KEY=your-brevo-api-key-here
VITE_GEMINI_API_KEY=your-gemini-api-key-here
"@ | Out-File -FilePath "C:\inetpub\civquest\source\.env" -Encoding UTF8
```

> **Security Note**: Keep your API keys secure. Consider using Azure Key Vault for production secrets management.

### Build the Application

```powershell
cd C:\inetpub\civquest\source

# Install dependencies
npm install

# Build for production
npm run build

# The built files will be in the 'dist' folder
```

### Deploy Built Files

Since all three subdomains serve the same SPA (routing is handled client-side), deploy the same build to all sites:

```powershell
# Copy built files to each site directory
Copy-Item -Path "C:\inetpub\civquest\source\dist\*" -Destination "C:\inetpub\civquest\notify" -Recurse -Force
Copy-Item -Path "C:\inetpub\civquest\source\dist\*" -Destination "C:\inetpub\civquest\atlas" -Recurse -Force
Copy-Item -Path "C:\inetpub\civquest\source\dist\*" -Destination "C:\inetpub\civquest\admin" -Recurse -Force
```

---

## 9. IIS Site Configuration

### Configure Each Site

Open **IIS Manager** (`inetmgr`) or use PowerShell:

```powershell
Import-Module WebAdministration

# Ensure sites exist (should already be created from SSL step)
# If not, create them:

# Stop sites first
Stop-Website -Name "notify.civ.quest" -ErrorAction SilentlyContinue
Stop-Website -Name "atlas.civ.quest" -ErrorAction SilentlyContinue
Stop-Website -Name "admin.civ.quest" -ErrorAction SilentlyContinue

# Get the SSL certificate thumbprint
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*civ.quest*"} | Select-Object -First 1
$thumbprint = $cert.Thumbprint

# Configure notify.civ.quest
Set-ItemProperty "IIS:\Sites\notify.civ.quest" -Name physicalPath -Value "C:\inetpub\civquest\notify"
New-WebBinding -Name "notify.civ.quest" -Protocol "https" -Port 443 -HostHeader "notify.civ.quest" -SslFlags 1
$binding = Get-WebBinding -Name "notify.civ.quest" -Protocol "https"
$binding.AddSslCertificate($thumbprint, "My")

# Configure atlas.civ.quest
Set-ItemProperty "IIS:\Sites\atlas.civ.quest" -Name physicalPath -Value "C:\inetpub\civquest\atlas"
New-WebBinding -Name "atlas.civ.quest" -Protocol "https" -Port 443 -HostHeader "atlas.civ.quest" -SslFlags 1
$binding = Get-WebBinding -Name "atlas.civ.quest" -Protocol "https"
$binding.AddSslCertificate($thumbprint, "My")

# Configure admin.civ.quest
Set-ItemProperty "IIS:\Sites\admin.civ.quest" -Name physicalPath -Value "C:\inetpub\civquest\admin"
New-WebBinding -Name "admin.civ.quest" -Protocol "https" -Port 443 -HostHeader "admin.civ.quest" -SslFlags 1
$binding = Get-WebBinding -Name "admin.civ.quest" -Protocol "https"
$binding.AddSslCertificate($thumbprint, "My")

# Start sites
Start-Website -Name "notify.civ.quest"
Start-Website -Name "atlas.civ.quest"
Start-Website -Name "admin.civ.quest"
```

### Configure Application Pool

Create a dedicated application pool:

```powershell
# Create application pool
New-WebAppPool -Name "CivQuestPool"

# Configure pool settings
Set-ItemProperty "IIS:\AppPools\CivQuestPool" -Name "managedRuntimeVersion" -Value ""  # No managed code (static site)
Set-ItemProperty "IIS:\AppPools\CivQuestPool" -Name "enable32BitAppOnWin64" -Value $false
Set-ItemProperty "IIS:\AppPools\CivQuestPool" -Name "processModel.idleTimeout" -Value "00:00:00"  # Never timeout

# Assign pool to all sites
Set-ItemProperty "IIS:\Sites\notify.civ.quest" -Name applicationPool -Value "CivQuestPool"
Set-ItemProperty "IIS:\Sites\atlas.civ.quest" -Name applicationPool -Value "CivQuestPool"
Set-ItemProperty "IIS:\Sites\admin.civ.quest" -Name applicationPool -Value "CivQuestPool"
```

---

## 10. URL Rewrite Rules

Create a `web.config` file for SPA routing. This is **critical** for React Router to work.

### Create web.config

Create this file in each site's root directory:

```powershell
$webConfig = @'
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <!-- Enable compression -->
        <urlCompression doStaticCompression="true" doDynamicCompression="true" />

        <!-- MIME types for modern web assets -->
        <staticContent>
            <remove fileExtension=".js" />
            <mimeMap fileExtension=".js" mimeType="application/javascript" />
            <remove fileExtension=".mjs" />
            <mimeMap fileExtension=".mjs" mimeType="application/javascript" />
            <remove fileExtension=".json" />
            <mimeMap fileExtension=".json" mimeType="application/json" />
            <remove fileExtension=".woff" />
            <mimeMap fileExtension=".woff" mimeType="font/woff" />
            <remove fileExtension=".woff2" />
            <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
            <remove fileExtension=".webp" />
            <mimeMap fileExtension=".webp" mimeType="image/webp" />
            <remove fileExtension=".svg" />
            <mimeMap fileExtension=".svg" mimeType="image/svg+xml" />
            <remove fileExtension=".webmanifest" />
            <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
        </staticContent>

        <!-- Security headers -->
        <httpProtocol>
            <customHeaders>
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-Frame-Options" value="SAMEORIGIN" />
                <add name="X-XSS-Protection" value="1; mode=block" />
                <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
            </customHeaders>
        </httpProtocol>

        <!-- URL Rewrite Rules -->
        <rewrite>
            <rules>
                <!-- Redirect HTTP to HTTPS -->
                <rule name="HTTPS Redirect" stopProcessing="true">
                    <match url="(.*)" />
                    <conditions>
                        <add input="{HTTPS}" pattern="off" ignoreCase="true" />
                    </conditions>
                    <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
                </rule>

                <!-- SPA Fallback: Route all requests to index.html except for static files -->
                <rule name="SPA Routes" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <!-- Don't rewrite actual files -->
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <!-- Don't rewrite directories -->
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/index.html" />
                </rule>
            </rules>
        </rewrite>

        <!-- Cache Control for static assets -->
        <caching>
            <profiles>
                <add extension=".js" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
                <add extension=".css" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
                <add extension=".woff2" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
                <add extension=".png" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
                <add extension=".jpg" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
                <add extension=".svg" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
            </profiles>
        </caching>

        <!-- Default document -->
        <defaultDocument>
            <files>
                <clear />
                <add value="index.html" />
            </files>
        </defaultDocument>

        <!-- Error pages -->
        <httpErrors errorMode="Custom" existingResponse="Replace">
            <remove statusCode="404" />
            <error statusCode="404" path="/index.html" responseMode="ExecuteURL" />
        </httpErrors>
    </system.webServer>
</configuration>
'@

# Write to all site directories
$webConfig | Out-File -FilePath "C:\inetpub\civquest\notify\web.config" -Encoding UTF8
$webConfig | Out-File -FilePath "C:\inetpub\civquest\atlas\web.config" -Encoding UTF8
$webConfig | Out-File -FilePath "C:\inetpub\civquest\admin\web.config" -Encoding UTF8
```

### Restart IIS

```powershell
iisreset
```

---

## 11. Environment Variables

### Configure System Environment Variables

While Vite bakes environment variables into the build, you may want to set system-level variables for scripts:

```powershell
# Set environment variables (optional, for deployment scripts)
[Environment]::SetEnvironmentVariable("CIVQUEST_ENV", "production", "Machine")
[Environment]::SetEnvironmentVariable("CIVQUEST_PATH", "C:\inetpub\civquest", "Machine")
```

### Firebase Security

The Firebase configuration in the app is client-side and uses security rules for protection. Ensure your Firestore security rules are properly configured in the Firebase Console.

---

## 12. Testing & Verification

### Test Each Subdomain

Open a browser and test:

1. **https://notify.civ.quest**
   - Should show the Notify login/signup screen
   - Test authentication flow

2. **https://atlas.civ.quest**
   - Should show the Atlas map interface
   - Verify ArcGIS map loads correctly

3. **https://admin.civ.quest**
   - Should show the Admin login screen
   - Test admin authentication

### Verify SSL Certificates

```powershell
# Test SSL configuration
Test-NetConnection -ComputerName notify.civ.quest -Port 443
Test-NetConnection -ComputerName atlas.civ.quest -Port 443
Test-NetConnection -ComputerName admin.civ.quest -Port 443
```

Check certificates in browser - should show valid, no warnings.

### Test SPA Routing

1. Navigate to `https://atlas.civ.quest/some-random-path`
2. Should still load the Atlas app (not 404)
3. The client-side router will handle the route

### Check Browser Console

Open Developer Tools (F12) and check:
- No JavaScript errors
- Firebase connection works
- ArcGIS SDK loads
- Network requests complete successfully

---

## 13. Maintenance & Updates

### Create Update Script

Save this as `C:\inetpub\civquest\update.ps1`:

```powershell
# CivQuest Update Script
# Run as Administrator

param(
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$sourcePath = "C:\inetpub\civquest\source"
$sites = @("notify", "atlas", "admin")

Write-Host "Starting CivQuest update..." -ForegroundColor Green

# Navigate to source
Set-Location $sourcePath

# Pull latest changes
Write-Host "Pulling latest changes from $Branch..." -ForegroundColor Yellow
git fetch origin
git checkout $Branch
git pull origin $Branch

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Build
Write-Host "Building application..." -ForegroundColor Yellow
npm run build

# Stop IIS sites
Write-Host "Stopping IIS sites..." -ForegroundColor Yellow
foreach ($site in $sites) {
    Stop-Website -Name "$site.civ.quest" -ErrorAction SilentlyContinue
}

# Deploy
Write-Host "Deploying to sites..." -ForegroundColor Yellow
foreach ($site in $sites) {
    $destPath = "C:\inetpub\civquest\$site"

    # Backup current version (optional)
    # $backupPath = "C:\inetpub\civquest\backups\$site-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    # Copy-Item -Path $destPath -Destination $backupPath -Recurse -Force

    # Clear destination (except web.config)
    Get-ChildItem -Path $destPath -Exclude "web.config" | Remove-Item -Recurse -Force

    # Copy new files
    Copy-Item -Path "$sourcePath\dist\*" -Destination $destPath -Recurse -Force
}

# Start IIS sites
Write-Host "Starting IIS sites..." -ForegroundColor Yellow
foreach ($site in $sites) {
    Start-Website -Name "$site.civ.quest"
}

Write-Host "Update complete!" -ForegroundColor Green
```

### Schedule Automatic Updates (Optional)

```powershell
# Create scheduled task for daily updates (adjust as needed)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\inetpub\civquest\update.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "CivQuest-AutoUpdate" -Action $action -Trigger $trigger -Principal $principal -Description "Automatically update CivQuest"
```

### Monitor Logs

IIS logs are stored in:
```
C:\inetpub\logs\LogFiles\W3SVC{SiteId}\
```

View recent logs:
```powershell
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" -Tail 50
```

---

## 14. Troubleshooting

### Common Issues

#### 1. "HTTP Error 500.19 - Internal Server Error"

**Cause**: Invalid web.config or missing URL Rewrite module

**Solution**:
```powershell
# Verify URL Rewrite is installed
Get-WebGlobalModule | Where-Object {$_.Name -like "*Rewrite*"}

# If not found, reinstall
# See Section 4 for installation
```

#### 2. "ERR_TOO_MANY_REDIRECTS"

**Cause**: HTTP to HTTPS redirect loop

**Solution**: Check if there's a proxy (like Cloudflare) also doing redirects. Configure only one layer to redirect.

#### 3. "404 Not Found" for app routes

**Cause**: URL Rewrite not working

**Solution**:
- Verify `web.config` exists in site root
- Check IIS rewrite rules in IIS Manager
- Restart IIS: `iisreset`

#### 4. ArcGIS maps not loading

**Cause**: CORS or authentication issues

**Solution**:
- Check browser console for errors
- Verify ArcGIS OAuth client ID matches
- Check that `notify.civ.quest` is in ArcGIS OAuth redirect URIs

#### 5. Firebase authentication failing

**Cause**: Domain not authorized in Firebase

**Solution**:
1. Go to Firebase Console → Authentication → Settings
2. Add authorized domains:
   - `notify.civ.quest`
   - `atlas.civ.quest`
   - `admin.civ.quest`

#### 6. Slow initial load

**Cause**: Large bundle size or missing compression

**Solution**:
```powershell
# Enable dynamic compression
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/urlCompression" -name "doDynamicCompression" -value "True"

# Enable static compression
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/urlCompression" -name "doStaticCompression" -value "True"
```

#### 7. Certificate errors

**Cause**: Certificate not bound correctly

**Solution**:
```powershell
# List all certificate bindings
netsh http show sslcert

# Re-bind certificate (get thumbprint first)
$cert = Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*civ.quest*"}
$thumbprint = $cert.Thumbprint

# Remove old binding
netsh http delete sslcert hostnameport=notify.civ.quest:443

# Add new binding
netsh http add sslcert hostnameport=notify.civ.quest:443 certhash=$thumbprint appid="{4dc3e181-e14b-4a21-b022-59fc669b0914}" certstorename=My
```

### Getting Help

- Check IIS logs: `C:\inetpub\logs\LogFiles\`
- Check Windows Event Viewer: Application and System logs
- Browser Developer Tools: Console and Network tabs
- Firebase Console: For authentication and database issues

### Useful Commands

```powershell
# Restart IIS
iisreset

# View running sites
Get-Website

# View application pools
Get-WebAppPoolState

# Test SSL certificate
Test-Certificate -Cert (Get-ChildItem -Path Cert:\LocalMachine\My | Where-Object {$_.Subject -like "*civ.quest*"})

# Clear IIS cache
Remove-Item -Path "C:\inetpub\temp\IIS Temporary Compressed Files\*" -Recurse -Force
```

---

## Quick Reference

### File Locations

| Item | Path |
|------|------|
| Source code | `C:\inetpub\civquest\source` |
| Notify site | `C:\inetpub\civquest\notify` |
| Atlas site | `C:\inetpub\civquest\atlas` |
| Admin site | `C:\inetpub\civquest\admin` |
| IIS logs | `C:\inetpub\logs\LogFiles\` |
| Certificates | `Cert:\LocalMachine\My` |
| Update script | `C:\inetpub\civquest\update.ps1` |

### Important URLs

| Service | URL |
|---------|-----|
| Notify Portal | https://notify.civ.quest |
| Atlas Application | https://atlas.civ.quest |
| Admin Portal | https://admin.civ.quest |

### Configuration Checklist

- [ ] Azure VM created and configured
- [ ] IIS installed with URL Rewrite module
- [ ] Node.js and Git installed
- [ ] DNS records configured
- [ ] SSL certificates installed
- [ ] Sites created in IIS
- [ ] web.config deployed to all sites
- [ ] Application built and deployed
- [ ] Firebase domains authorized
- [ ] All three subdomains accessible via HTTPS

---

*Last updated: February 2026*
*CivQuest version: Based on current repository state*
