# Windows only. Git checks out .claude/skills and .claude/agents as text files
# when symlinks are disabled. Replace them with directory junctions to .ai/.
# No admin rights needed. Run from anywhere: powershell -File .claude/setup-windows-links.ps1
$ErrorActionPreference = 'Stop'
$root = (git rev-parse --show-toplevel).Trim()

foreach ($name in 'skills', 'agents') {
    $link = Join-Path $root ".claude\$name"
    $target = Join-Path $root ".ai\$name"

    if (-not (Test-Path $target)) { throw "Missing target: $target" }

    $item = Get-Item $link -Force -ErrorAction SilentlyContinue
    if ($item -and $item.PSIsContainer) {
        Write-Host ".claude/$name is already a directory or link - skipping"
        continue
    }
    if ($item) { Remove-Item $link -Force }

    New-Item -ItemType Junction -Path $link -Target $target | Out-Null
    git -C $root update-index --skip-worktree ".claude/$name"
    Write-Host "Linked .claude/$name -> .ai/$name"
}

Write-Host "Done. Run /reload-skills in Claude Code."
