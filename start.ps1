# Start both servers
Write-Host "Starting Panini Trade..."
Start-Process -FilePath "cmd" -ArgumentList "/k cd backend && node server.js" -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process -FilePath "cmd" -ArgumentList "/k cd frontend && npm run dev" -WindowStyle Normal
Write-Host "Backend: http://localhost:3001"
Write-Host "Frontend: http://localhost:5173"
