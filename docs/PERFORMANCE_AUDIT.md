# Performance-Audit

## Stand

- Produktionsbasis: `main` bei `62c1fcc50de39482f2a4e8b1fed78d71dbeb4b3f`
- Produktions-URL: <https://beikost.kovacicjaqueline.workers.dev>
- Optimierte Preview: Commit `5b42a89b1e4c2d60f379a373fca35fb2befd9e77`
- Messdatum: 14. September 2026

## Wallclock-Messung

Gemessen wurde in derselben Cloud-Chrome-Sitzung mit fünf warmen Reloads je
Origin. Die Wallclock startet unmittelbar vor dem Reload. `load` bezeichnet das
Ende der Browsernavigation; „Heute sichtbar“ endet, sobald `#todayCard` sichtbar
ist. Die Sichtbarkeit wurde alle 25 ms geprüft.

| Ziel | Produktion (ms) | Preview (ms) | Median Produktion | Median Preview | Änderung |
| --- | --- | --- | ---: | ---: | ---: |
| Reload bis `load` | 2990, 2697, 2173, 1443, 2358 | 1509, 1410, 1368, 2315, 1200 | 2358 ms | 1410 ms | −40,2 % |
| Reload bis „Heute sichtbar“ | 6302, 6665, 5094, 6673, 4258 | 1649, 1557, 1498, 2444, 1329 | 6302 ms | 1557 ms | −75,3 % |

Der mediane Nachlauf zwischen `load` und sichtbarer Startansicht sinkt damit von
rund 3944 ms auf 147 ms. Das stützt die Änderung am seriellen, sichtbarkeitskritischen
Planner-/Handling-Ladepfad unmittelbar.

Ein erster Aufruf pro Origin lag bei 13 699 ms für Produktion und 12 191 ms für
die Preview. Diese Einzelwerte enthalten Verbindungsaufbau und die
Browsersteuerung und werden deshalb nicht für die Prozentangaben verwendet.

Die Werte sind reale End-to-End-Wallclock-Werte dieser Sitzung, keine
Lighthouse-Labwerte. Netzwerk, Service Worker, Cloudflare-Cache und der kleine
Polling-/Steuerungsanteil sind enthalten.
