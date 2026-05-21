# TrueNAS Drive Inventory

| Position | Dev Name | Make/Model | Serial | Size | Mfg Date | Source | Warranty | Warranty Remaining | Pool Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | sdn | Toshiba MG08ACA16TE | 41Q0A3JXFWTG | 16TB | 2021-04-26 | GoHardDrive 1125 | 5yr | ~4yr 5mo | Core Storage | — |
| A2 | sdp | Toshiba MG08ACA16TE | 9542A01EFVGG | 16TB | 2025-09-04 | — | — | — | Core Storage | — |
| A3 | sdt | Toshiba MD08ACA16TR | 5560A062TW2G | 16TB | 2025-08-28 | GoHardDrive 0226 | 5yr | ~4yr 9mo | Core Storage | Refurbished |
| A4 | sds | Toshiba MG08ACA16TE | 41Q0A3XKFWTG | 16TB | 2021-04-26 | GoHardDrive 1125 | 5yr | ~4yr 5mo | Core Storage | — |
| B1 | sdm | Seagate Exos X18 ST16000NM000J | WRS00LSV | 16TB | 2021-11-29 | — (Recertified) | — | — | Core Storage | — |
| B2 | sdl | Toshiba MG08ACA14TE | 61H0A0GYFVJG | 14TB | 2021-06-18 | — | — | — | Core Storage | — |
| B3 | — | — | — | — | — | — | — | — | BAD SLOT | ❌ Bad backplane connector — drive moved to D2 |
| B4 | — | — | — | — | — | — | — | — | BAD SLOT | ❌ Bad backplane connector — drive moved to E3 |
| C1 | sdk | Toshiba MG08ACA16TE | 41Q0A2QLFWTG | 16TB | 2021-04-26 | GoHardDrive 1125 | 5yr | ~4yr 5mo | Core Storage | — |
| C2 | sdj | MDD OOS14000G | 000DVENP | 14TB | — | — | — | — | Core Storage | ✅ Serial misread from photo — actual serial 000DVENP, model OOS14000G (MDD rebranded OEM) |
| C3 | sdj | Toshiba MG08ACA14TE | 6180A0YFVJG | 14TB | 2021-06-09 | — | — | — | Core Storage | — |
| C4 | sdh | Toshiba MG08ACA16TE | Z0W0A075FYGG | 16TB | 2020-12-23 | GoHardDrive 1025 | 5yr | ~4yr 5mo | Core Storage | — |
| D1 | sdo | HGST HUH721212ALE601 | 8DH9KKKNH | 12TB | — | — | — | — | Core Storage | — |
| D2 | — | Toshiba MG08ACA14TE | 6180A17BFVJG | 14TB | 2021-06-09 | — | — | — | Core Storage | ♻️ Moved from B3 (bad slot) — now detected |
| D3 | sdr | HGST HUH721212ALE601 | 8DHS27BH | 12TB | — | — | — | — | Core Storage | — |
| D4 | sdq | HGST HUH721212ALE601 | 8HJVLX5Y | 12TB | — | — | — | — | Core Storage | — |
| E1 | sdc | Toshiba MG08ACA16TE | Z370A02MFVGG | 16TB | 2023-12-08 | — | — | — | Core Storage | — |
| E2 | sdb | HGST HUH721212ALE601 | 8HGHTZPH | 12TB | — | — | — | — | Core Storage | — |
| E3 | — | Seagate Exos X18 ST16000NM000J | ZR504HJS | 16TB | 2021-03-14 | — (Recertified) | — | — | Core Storage | ♻️ Moved from B4 (bad slot) — now detected |
| E4 | sda | HGST HUH721212ALE601 | 8DJAA0PH | 12TB | — | — | — | — | Core Storage | — |
| F1 | sdg | Toshiba MG08ACA16TE | 91T0A1NEFVGG | 16TB | 2021-09-30 | — | — | — | Core Storage | — |
| F2 | sdf | Toshiba MG08ACA16TE | 71K0A0FAFVGG | 16TB | 2021-07-20 | — | — | — | Core Storage | — |
| F3 | sde | Toshiba MG08ACA16TE | 71K0A0FGFVGG | 16TB | 2021-07-20 | — | — | — | Core Storage | — |
| F4 | sdd | Toshiba MG08ACA16TE | Z0J0A03MFVGG | 16TB | 2020-12-22 | GoHardDrive 1025 | 5yr | ~4yr 5mo | Core Storage | ♻️ Replaced faulted drive (51V0A1SLF57H) — resilvering |

---

## Legend

| Status | Meaning |
| --- | --- |
| NOT DETECTED | Drive not visible to TrueNAS — bad backplane slot confirmed |
| BAD SLOT | Backplane connector dead — do not use |
| PENDING TEST | Drive removed, on desk awaiting SMART testing |
| Core Storage | Drive online and healthy in pool |
| ♻️ note | Drive relocated from another slot |
| ⚠️ note | Attention needed |
| ❌ note | Confirmed bad |