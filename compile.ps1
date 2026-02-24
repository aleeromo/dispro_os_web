$ErrorActionPreference = "Stop"

$workspace = "c:\Users\aleja\OneDrive\Escritorio\dispro_os_web"
$desktopOutput = "c:\Users\aleja\OneDrive\Escritorio\Dispro_OS_Ejecutable"

Write-Host "1. Compilando el frontend de React..."
Set-Location "$workspace\frontend"
npm install
npm run build

Write-Host "2. Preparando archivos estáticos para el backend..."
$distDest = "$workspace\backend\app\dist"
if (Test-Path $distDest) {
    Remove-Item -Recurse -Force $distDest
}
Copy-Item -Recurse -Force "$workspace\frontend\dist" $distDest

Write-Host "3. Compilando con PyInstaller..."
Set-Location "$workspace\backend\app"
# Borrar compilaciones anteriores si existen
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "Dispro_OS.spec") { Remove-Item -Force "Dispro_OS.spec" }

# Asegurar que la carpeta modelos_ia exista
if (-not (Test-Path "modelos_ia")) { New-Item -ItemType Directory -Path "modelos_ia" | Out-Null }

pyinstaller --name "Dispro_OS" `
    --onefile `
    --add-data "dist;dist" `
    --add-data "core;core" `
    --add-data "modelos_ia;modelos_ia" `
    --hidden-import "uvicorn" `
    --hidden-import "fastapi" `
    --hidden-import "cv2" `
    --hidden-import "numpy" `
    --hidden-import "easyocr" `
    --hidden-import "pydantic" `
    --hidden-import "multipart" `
    --hidden-import "requests" `
    main.py

Write-Host "4. Copiando el ejecutable al Escritorio..."
if (-not (Test-Path $desktopOutput)) {
    New-Item -ItemType Directory -Path $desktopOutput | Out-Null
}
Copy-Item -Force "$workspace\backend\app\dist\Dispro_OS.exe" "$desktopOutput\"

Write-Host "============================================="
Write-Host "¡Compilación terminada con éxito!"
Write-Host "El ejecutable se encuentra en: $desktopOutput\Dispro_OS.exe"
Write-Host "============================================="
