# Cursor Solutions 동기화 스크립트
# 이 스크립트는 GitHub에서 solutions.json 파일을 현재 프로젝트로 동기화합니다.

$repoUrl = "https://github.com/yymspharm/mspharmHQ.git"
$solutionsDir = "$env:USERPROFILE\.cursor-solutions"
$localPath = ".\.cursor\solutions.json"

# GitHub 저장소 복제 또는 업데이트 (이미 존재하는 경우)
if (-not (Test-Path $solutionsDir)) {
    Write-Host "솔루션 저장소 복제 중..."
    git clone $repoUrl $solutionsDir
} else {
    Write-Host "솔루션 저장소 업데이트 중..."
    $currentLocation = Get-Location
    Set-Location $solutionsDir
    git pull origin main
    Set-Location $currentLocation
}

# 솔루션 파일 존재 확인
$solutionsPath = "$solutionsDir\.cursor\solutions.json"
if (-not (Test-Path $solutionsPath)) {
    # 솔루션 파일이 없으면 현재 프로젝트에서 복사
    if (Test-Path $localPath) {
        Write-Host "솔루션 파일을 GitHub 저장소로 복사하는 중..."
        
        # 복제된 저장소에 .cursor 디렉토리 생성
        if (-not (Test-Path "$solutionsDir\.cursor")) {
            New-Item -ItemType Directory -Path "$solutionsDir\.cursor" -Force | Out-Null
        }
        
        Copy-Item -Path $localPath -Destination $solutionsPath -Force
        
        # 변경사항 커밋 및 푸시
        $currentLocation = Get-Location
        Set-Location $solutionsDir
        git add .cursor/solutions.json
        git commit -m "Add initial solutions.json"
        git push origin main
        Set-Location $currentLocation
        
        Write-Host "솔루션 파일이 GitHub에 업로드되었습니다."
    } else {
        Write-Host "오류: 로컬 solutions.json 파일이 없습니다. 먼저 솔루션 파일을 생성해주세요."
        exit 1
    }
} else {
    # 솔루션 파일이 있으면 현재 프로젝트로 복사
    Write-Host "GitHub에서 솔루션 파일을 가져오는 중..."
    
    # .cursor 디렉토리 확인
    if (-not (Test-Path (Split-Path $localPath))) {
        New-Item -ItemType Directory -Path (Split-Path $localPath) -Force | Out-Null
    }
    
    Copy-Item -Path $solutionsPath -Destination $localPath -Force
    Write-Host "솔루션 파일 복사 완료!"
}

# 로컬 파일을 GitHub로 푸시 (선택적)
function Push-ToGitHub {
    if (Test-Path $localPath) {
        Write-Host "현재 프로젝트의 솔루션 파일을 GitHub로 푸시하는 중..."
        
        # 솔루션 파일 복사
        Copy-Item -Path $localPath -Destination $solutionsPath -Force
        
        # 변경사항 커밋 및 푸시
        $currentLocation = Get-Location
        Set-Location $solutionsDir
        git add .cursor/solutions.json
        git commit -m "Update solutions.json from $((Get-Item $currentLocation).Name) project"
        git push origin main
        Set-Location $currentLocation
        
        Write-Host "GitHub 저장소 업데이트 완료!"
    } else {
        Write-Host "오류: 로컬 solutions.json 파일을 찾을 수 없습니다."
        exit 1
    }
}

# 인자에 따라 동기화 수행
if ($args[0] -eq "push") {
    Push-ToGitHub
} elseif ($args[0] -eq "sync") {
    Push-ToGitHub
    Write-Host "양방향 동기화 완료!"
}

Write-Host "동기화 작업이 완료되었습니다." 