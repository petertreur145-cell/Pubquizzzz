# Pubquizzz - zet Windows Firewall goed zodat telefoons kunnen verbinden.
#
# Wat dit script doet:
#  - verwijdert (stille) blokkeer-regels die Windows voor node.exe heeft
#    aangemaakt (die ontstaan als de firewall-vraag ooit is weggeklikt),
#    ook voor oudere kopieen van deze map
#  - zet een toestaan-regel voor node.exe en voor poort 3001
#  - controleert of de regels ook echt gelden (werk-laptops negeren
#    lokale regels soms) en of er een andere firewall draait
#
# Gebruik (via ScriptBlock zodat een strenge ExecutionPolicy geen rol speelt):
#   ... -CheckOnly -AppDir <map>  -> exitcode 0 = firewall staat goed
#                                    exitcode 1 = reparatie nodig
#   ... -AppDir <map>             -> repareert (vraagt zo nodig om
#                                    beheerdersrechten via Windows)
# Exitcodes reparatie: 0 = gelukt, 1 = mislukt/geweigerd,
#   2 = laptop negeert lokale regels (beheerde werklaptop),
#   3 = er draait een andere firewall (bijv. Norton/McAfee)

param(
    [switch]$CheckOnly,
    [string]$AppDir
)

if (-not $AppDir) {
    if ($PSScriptRoot) { $AppDir = $PSScriptRoot } else { $AppDir = (Get-Location).Path }
}
$selfPath = Join-Path $AppDir 'fix-firewall.ps1'
$nodeExe = Join-Path (Split-Path -Parent $AppDir) 'node\node.exe'
try { $nodeExe = (Resolve-Path -LiteralPath $nodeExe -ErrorAction Stop).Path } catch {}

# Alle firewall-programmafilters die bij een Pubquizzz-node.exe horen.
# Bewust client-side vergeleken: het -Program queryveld doet wildcard-
# matching, waardoor haakjes in het pad (bijv. "Pubquiz (2)") de query
# stilletjes laten mislukken.
function Get-QuizNodeFilters {
    try {
        $all = @(Get-NetFirewallApplicationFilter -ErrorAction Stop)
        return @($all | Where-Object {
            $_.Program -and (
                ($_.Program -ieq $nodeExe) -or
                ($_.Program -imatch 'pubquiz[^\\]*\\node\\node\.exe$')
            )
        })
    } catch {
        return @()
    }
}

function Get-CurrentNodeRules {
    $filters = @(Get-QuizNodeFilters | Where-Object { $_.Program -ieq $nodeExe })
    if ($filters.Count -eq 0) { return @() }
    return @($filters | Get-NetFirewallRule -ErrorAction SilentlyContinue)
}

# Netwerkcategorieen van de actieve verbinding(en): 'Public', 'Private',
# 'Domain'. Leeg bij twijfel; dan telt alleen een 'Any'-regel als goed.
function Get-ActiveCategories {
    try {
        $profiles = @(Get-NetConnectionProfile -ErrorAction Stop)
        return @($profiles | ForEach-Object {
            "$($_.NetworkCategory)" -replace 'Authenticated', ''
        } | Select-Object -Unique)
    } catch {
        return @()
    }
}

# Een toestaan-regel telt alleen als hij ook geldt op het netwerkprofiel
# waar de laptop NU op zit. Een regel voor alleen 'Openbaar' doet niets
# op een prive-netwerk (en andersom) - dat was precies zo'n stille blokkade.
function Test-RuleCoversActiveNetwork {
    param($rule, [string[]]$categories)
    $profileText = "$($rule.Profile)"
    if ($profileText -eq 'Any') { return $true }
    if ($categories.Count -eq 0) { return $false }
    foreach ($category in $categories) {
        if ($profileText -notmatch $category) { return $false }
    }
    return $true
}

function Test-FirewallOk {
    $rules = @(Get-CurrentNodeRules)
    $categories = Get-ActiveCategories
    $blockRules = @($rules | Where-Object { "$($_.Action)" -eq 'Block' -and "$($_.Enabled)" -eq 'True' })
    $allowRules = @($rules | Where-Object {
        "$($_.Action)" -eq 'Allow' -and "$($_.Enabled)" -eq 'True' -and "$($_.Direction)" -eq 'Inbound' -and
        (Test-RuleCoversActiveNetwork -rule $_ -categories $categories)
    })
    return (($blockRules.Count -eq 0) -and ($allowRules.Count -gt 0))
}

if ($CheckOnly) {
    try {
        if (Test-FirewallOk) { exit 0 } else { exit 1 }
    } catch {
        exit 1
    }
}

# --- Reparatie ---
$identity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    # Opnieuw starten met beheerdersrechten (Windows toont een ja/nee-vraag).
    # Via -EncodedCommand + ScriptBlock zodat quoting en ExecutionPolicy
    # geen roet in het eten gooien.
    try {
        $selfEsc = $selfPath.Replace("'", "''")
        $appEsc = $AppDir.Replace("'", "''")
        $inner = "& ([ScriptBlock]::Create((Get-Content -Raw -LiteralPath '$selfEsc'))) -AppDir '$appEsc'"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inner))
        $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $process = Start-Process -FilePath $psExe -Verb RunAs -Wait -PassThru `
            -ArgumentList "-NoProfile -EncodedCommand $encoded"
        if ($null -eq $process -or $null -eq $process.ExitCode) { exit 1 }
        exit $process.ExitCode
    } catch {
        # Gebruiker heeft 'Nee' gekozen bij de beheerdersvraag.
        exit 1
    }
}

try {
    Write-Host 'Firewall goedzetten voor Pubquizzz...'

    # 1. Alle bestaande regels voor Pubquizzz-node.exe weg (ook stille
    #    blokkeer-regels en regels van oudere kopieen van deze map).
    #    @() is nodig: PS 5.1 pakt .Count niet op een los CIM-object.
    $quizFilters = @(Get-QuizNodeFilters)
    if ($quizFilters.Count -gt 0) {
        $oldRules = @($quizFilters | Get-NetFirewallRule -ErrorAction SilentlyContinue)
        if ($oldRules.Count -gt 0) {
            $oldRules | Remove-NetFirewallRule -ErrorAction SilentlyContinue
        }
    }

    # 2. Oude Pubquizzz-regels op naam weg.
    try {
        Get-NetFirewallRule -DisplayName 'Pubquizzz*' -ErrorAction Stop |
            Remove-NetFirewallRule -ErrorAction SilentlyContinue
    } catch {}

    # 3. Nieuwe toestaan-regels.
    New-NetFirewallRule -DisplayName 'Pubquizzz node' -Direction Inbound -Program $nodeExe `
        -Action Allow -Profile Any -ErrorAction Stop | Out-Null
    New-NetFirewallRule -DisplayName 'Pubquizzz poort 3001' -Direction Inbound -Protocol TCP -LocalPort 3001 `
        -Action Allow -Profile Any -ErrorAction Stop | Out-Null
} catch {
    Write-Host "Er ging iets mis: $($_.Exception.Message)"
    Start-Sleep -Seconds 6
    exit 1
}

# 4. Draait er een andere firewall (bijv. Norton/McAfee)? Die blokkeert
#    telefoons dan alsnog, wat wij hier niet kunnen repareren.
$thirdParty = @()
try {
    $products = @(Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName 'FirewallProduct' -ErrorAction Stop)
    $thirdParty = @($products | Where-Object {
        $_.displayName -and ($_.displayName -notmatch 'windows|microsoft|defender')
    })
} catch {}
if ($thirdParty.Count -gt 0) {
    Write-Host "Let op: er draait een andere firewall: $($thirdParty[0].displayName)."
    Write-Host 'Sta node.exe daar toe als telefoons niet kunnen verbinden.'
    Start-Sleep -Seconds 4
    exit 3
}

# 5. Gelden onze lokale regels ook echt? Beheerde werklaptops kunnen
#    lokale firewall-regels negeren; dan is de reparatie voor niets.
$effective = @()
try {
    $effective = @(Get-NetFirewallRule -DisplayName 'Pubquizzz*' -PolicyStore ActiveStore -ErrorAction Stop)
} catch {}
if ($effective.Count -eq 0) {
    Write-Host 'Let op: deze laptop negeert lokale firewall-regels (beheerde werklaptop?).'
    Start-Sleep -Seconds 4
    exit 2
}

# 6. Eindcontrole: is de firewall nu ook echt goed? Zo vangen we af dat
#    een blokkeer-regel het verwijderen stilletjes heeft overleefd.
$finalOk = $false
try { $finalOk = Test-FirewallOk } catch {}
if (-not $finalOk) {
    Write-Host 'Let op: de reparatie is niet volledig gelukt. Probeer het opnieuw,'
    Write-Host 'of sta node.exe handmatig toe in Windows Firewall.'
    Start-Sleep -Seconds 6
    exit 1
}

Write-Host 'Klaar! Telefoons kunnen nu verbinden.'
Start-Sleep -Seconds 2
exit 0
