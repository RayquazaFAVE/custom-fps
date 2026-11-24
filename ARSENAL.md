# Arsenal expansion

The game now has **15 weapon cores: the original five plus two real-world guns per class**. All are available in the loadout builder; no progression unlock is required. A first-time visitor starts with the M4A1.

## New guns

These are arcade balance values, not ballistic simulations. Damage is per bullet, or per shotgun pellet. Fire rate is rounds per minute (RPM).

| Class | Gun | Damage | RPM | Magazine | Reload | Tradeoff |
|---|---|---:|---:|---:|---:|---|
| Assault rifle | AK-47 | 39 | 600 | 30 | 2.5 s | Heavier hits, stronger recoil, slower fire |
| Assault rifle | AUG A3 | 27 | 850 | 30 | 2.1 s | Lighter hits, faster fire, easier control |
| SMG | UMP45 | 28 | 600 | 25 | 2.25 s | More damage and range, smaller magazine |
| SMG | KRISS VECTOR | 16 | 1100 | 33 | 1.8 s | Very fast follow-up shots, lower damage and range |
| Shotgun | MOSSBERG 590 | 15 × 6 | 60 | 8 | 0.65 s/shell | Hard-hitting pump with a larger tube and slower handling |
| Shotgun | BENELLI M4 | 10 × 6 | 180 | 7 | 0.45 s/shell | Semi-automatic follow-up shots with less damage per shell |
| Sniper rifle | BARRETT M82 | 150 | 30 | 10 | 3.6 s | Maximum damage and reach; very slow fire, heavy recoil |
| Sniper rifle | SVD DRAGUNOV | 75 | 100 | 10 | 2.4 s | Two body hits on a fresh drone; faster, more forgiving shots |
| LMG | PKM | 34 | 600 | 100 | 5.2 s | Heavy sustained damage with stronger recoil |
| LMG | RPK | 27 | 800 | 75 | 3.6 s | Faster fire and handling, smaller magazine |

Recoil, effective range, and spread also differ between cores. See `weapons.js` for the complete shared catalog. Shotguns load one shell at a time; a partially loaded shotgun can interrupt reloading to fire once its shot cooldown has elapsed.

## One loadout per match

- **Loadout → Weapon Core:** filter by class and compare damage, RPM, and magazine size. Cards marked **NEW** are the additions.
- Changing core installs its factory barrel, stock, and magazine, while preserving the selected optic. Factory parts reproduce the new core's listed base stats exactly.
- Attachments remain interchangeable. The live stat preview includes their bonuses and penalties.
- **Save Loadout** persists the gun and all four parts in the browser. Deploying takes one snapshot of that saved build; unsaved selections do not replace it.
- **No weapon switching is allowed during a match.** Number keys, Q, and in-match weapon-selection buttons no longer change guns. Restarting a match keeps the same loadout. Return to the lobby, edit, save, and deploy again to use a different build.
- Automatic guns fire while held. Semi-automatic, pump-action, and bolt-action guns require a fresh click or **E** press for each shot.
- Every deployed gun uses its saved barrel, stock, magazine, and optic. The builder shows each selected part's exact modifiers. Barrels tune damage/recoil/range; stocks tune recoil/reload; magazines set capacity and tune damage/reload; optics set aim zoom. Select the AW scope for 6× aiming.

Original core IDs, base stats, and attachment bonuses are retained so existing saved loadouts remain usable. Cached stats are recalculated from the shared catalog when deploying.

## Verification

Run `npm test` for catalog, balance, attachment, save-compatibility, and match-unit-conversion checks. Browser regression checks cover the first-visit M4A1, saved-gun deployment, attachment effects, locked weapon controls, restarting with the same gun, firing modes, reloads, optics, and the mobile loadout layout.
