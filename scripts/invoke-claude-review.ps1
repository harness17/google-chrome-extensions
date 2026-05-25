param(
    [string]$TargetPath = ".",

    [string]$HandoffPath = "CLAUDE_CODE_HANDOFF.md",

    [string]$ProfilePath = ".claude/rules/project-collaboration-profile.md",

    [string]$ClaudeCommand = "claude",

    [decimal]$MaxBudgetUsd = 1,

    [int]$MaxHandoffChars = 20000,

    [int]$MaxProfileChars = 12000,

    [int]$MaxDiffChars = 40000,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$isDryRun = $DryRun.ToBool()

function Resolve-ExistingPath {
    param(
        [string]$Path,
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Description not found: $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

function Read-LimitedText {
    param(
        [string]$Path,
        [int]$MaxChars,
        [switch]$KeepTail
    )

    $content = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false, $true))

    if ($content.Length -le $MaxChars) {
        return $content
    }

    if ($KeepTail) {
        return "[truncated: showing last $MaxChars characters]`n" + $content.Substring($content.Length - $MaxChars)
    }

    return $content.Substring(0, $MaxChars) + "`n[truncated: showing first $MaxChars characters]"
}

function Limit-Text {
    param(
        [string]$Content,
        [int]$MaxChars
    )

    if ($Content.Length -le $MaxChars) {
        return $Content
    }

    return $Content.Substring(0, $MaxChars) + "`n[truncated: showing first $MaxChars characters]"
}

$targetRoot = Resolve-ExistingPath $TargetPath "target path"
$handoffFile = Resolve-ExistingPath (Join-Path $targetRoot $HandoffPath) "handoff file"
$profileFile = Resolve-ExistingPath (Join-Path $targetRoot $ProfilePath) "project collaboration profile"

$claude = Get-Command $ClaudeCommand -ErrorAction SilentlyContinue
if (-not $claude -and -not $isDryRun) {
    throw "Claude Code command not found: $ClaudeCommand"
}

$handoff = Read-LimitedText $handoffFile $MaxHandoffChars -KeepTail
$profile = Read-LimitedText $profileFile $MaxProfileChars

if ($isDryRun) {
    Write-Host "Dry run: Claude Code was not invoked and handoff was not modified."
    Write-Host "Target: $targetRoot"
    Write-Host "Handoff: $handoffFile"
    Write-Host "Profile: $profileFile"
    return
}

$diffStat = ""
$diff = ""
$gitAvailable = $false

$gitCheckOutput = & git -C $targetRoot rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -eq 0 -and ($gitCheckOutput -join "`n").Trim() -eq "true") {
    $gitAvailable = $true
    $diffStat = (& git -C $targetRoot diff --no-ext-diff --stat HEAD -- 2>$null) -join "`n"
    $diff = (& git -C $targetRoot diff --no-ext-diff HEAD -- 2>$null) -join "`n"
}
else {
    $diffStat = "git diff unavailable: target path is not inside a Git worktree"
    $diff = ""
}

if ([string]::IsNullOrWhiteSpace($diffStat)) {
    $diffStat = "(no diff against HEAD)"
}

if ([string]::IsNullOrWhiteSpace($diff)) {
    $diff = "(no diff against HEAD)"
}

$diff = Limit-Text $diff $MaxDiffChars

$promptLines = @(
    "You are Claude Code acting as the review-side agent in a Codex / Claude Code cross-agent harness.",
    "",
    "Task:",
    "- Review the current handoff and diff only.",
    "- Do not edit files.",
    "- Prioritize correctness, security, regressions, missing tests, and merge blockers.",
    "- Treat the project collaboration profile as binding.",
    "- If there are no blocking findings, say that clearly and list residual risks or verification gaps.",
    "- Reply in Japanese Markdown.",
    "",
    "Output format:",
    "## Claude Code Review",
    "",
    "### Findings",
    "- Severity, file/path if known, concrete problem, and recommended fix.",
    "",
    "### Verification Gaps",
    "- Commands or manual checks still needed.",
    "",
    "### Merge / Publish Judgment",
    "- One of: BLOCKED / REVIEWED_WITH_RISKS / REVIEWED_OK.",
    "",
    "Project root:",
    $targetRoot,
    "",
    "Project collaboration profile:",
    '```md',
    $profile,
    '```',
    "",
    "Handoff:",
    '```md',
    $handoff,
    '```',
    "",
    "Diff stat:",
    '```text',
    $diffStat,
    '```',
    "",
    "Diff:",
    '```diff',
    $diff,
    '```'
)
$prompt = $promptLines -join [Environment]::NewLine

$arguments = @(
    "--print",
    "--output-format", "text",
    "--permission-mode", "dontAsk",
    "--tools", "",
    "--max-budget-usd", $MaxBudgetUsd.ToString([System.Globalization.CultureInfo]::InvariantCulture),
    $prompt
)

$review = & $ClaudeCommand @arguments
$exitCode = if ($claude.CommandType -eq [System.Management.Automation.CommandTypes]::Application) {
    $LASTEXITCODE
}
else {
    0
}

if ($exitCode -ne 0) {
    throw "Claude Code review failed with exit code $exitCode"
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$appendLines = @(
    "",
    "---",
    "",
    "## $timestamp 追記（Claude Code 自動レビュー）",
    "",
    "- 対象: ``$targetRoot``",
    '- 呼び出し元: Codex / `scripts/invoke-claude-review.ps1`',
    '- 権限: review-only (`--tools ""`, `--permission-mode dontAsk`)',
    "- MaxBudgetUsd: $MaxBudgetUsd",
    "",
    ($review -join [Environment]::NewLine)
)
$appendText = $appendLines -join [Environment]::NewLine

Add-Content -LiteralPath $handoffFile -Value $appendText -Encoding utf8NoBOM
Write-Host "Claude Code review appended to: $handoffFile ($($appendText.Length) chars)"
