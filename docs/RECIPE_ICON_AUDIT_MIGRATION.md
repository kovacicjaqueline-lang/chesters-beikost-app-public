# Recipe-Icon-Audit: Migration in das Public-Repository

## Herkunft und Sicherung

- Verbindliches Ziel: `kovacicjaqueline-lang/chesters-beikost-app-public`
- Public-Ausgangsstand: `b890eccd51da7ac38d363a26d0c37fb6d1e103e5`, Version `10.1.25`
- Public-Arbeitsbranch: `audit/icon-audit`
- Erhaltener lokaler Quellstand: Branch `task/icon-audit-freigaben` auf
  `faae7f4c13cb8f4bf50963d648b552d970daf1ed`, Version `10.1.22`
- Der lokale Quellstand ist nur mit einem lokalen Git-Bundle verbunden. Er wurde nicht
  umgehängt, bereinigt oder verändert und bleibt als Sicherung erhalten.
- Das alte private GitHub-Repository wurde nicht verwendet oder verändert.

Im lokalen Quellstand lagen neun freigegebene Recipe-V2-Assets, die zugehörigen alten
Manifest-Hashes und eine Screenshotreferenz ungestagt vor. Zusätzlich existieren außerhalb
des Repositorys sieben finale semantische Bildquellen, zwei verworfene Huhn-Varianten und
temporäre 128-/27-px-Renderings.

## Semantisch geprüfte Migration

Die neun betroffenen Rezeptdatensätze sind zwischen dem lokalen Auditstand und Public-main
inhaltlich identisch. Auch Pfadzuordnung und Offline-Precache sind auf Public-main vorhanden.
Deshalb werden nur die weiterhin gültigen Assets selektiv übernommen.

| Rezept | Verbindlich freigegebene Änderung | SHA-256 nach Migration |
| --- | --- | --- |
| Baby-Linsen-Bolognese | fertiges Gericht mit sichtbarer, sehr weicher kleiner Pasta in auberginefarbener Schale | `194806d22d64a90109e93cf41db80230c62cf9861d048f502e56a5d1ef17b1a2` |
| Bohnen-Kartoffel-Stampf | schwarze Bohnen als zulässige Rezeptvariante in auberginefarbener Schale | `9128dbbbeebe80058b7639ceecfcf935e5feeb0de109079359d23c48adfa9aca` |
| Buttermilch-Hirse-Obstbrei | ausschließlich technische Entfernung halbtransparenter Rand-/Eckartefakte | `d3e71fb6745d6a9e830ed893b9767dceb64e7ef0a714def8215e16d8b3d1bb2d` |
| Huhn-Brokkoli-Reis | Reisgericht in auberginefarbener Schale statt auf einem Teller | `9dcac2fa7b58e669b43e3aa194258f850e65f8058b342126ce2a768e3d79e9c9` |
| Kalabasa mit Kokos | keine Kokoschips, Flocken oder Dekorspur; graublaue Schale | `84b198bd44aebf16d4566aeec2157a8d0939ec5c724bad0dd9689d667d57ec0d` |
| Obst-Hafer-Joghurt | ausschließlich Mango als gewählte Obstvariante; auberginefarbene Schale | `25d35610e3ed546b35c02efebd3af9a2bd99bab1c1ada1992aa43159227eac68` |
| Obst-Haferbrei | ausschließlich Banane als gewählte Obstvariante; graublaue Schale | `d2f821f135855a3de990af5f1a2ff64739ede98bec98c7d161a7990d3d939a48` |
| Rind-Gemüse-Bolognese | Sauce ohne Pasta; graublaue Schale | `a1c25e883ca12b116502eb69cda0eadc88a4ba828591448390f673dd2e4c682d` |
| Weiches Rührei | unverändertes freigegebenes Motiv technisch vergrößert, damit es bei 27 px als Eierspeise lesbar bleibt | `e97df2635b49be396be300a6e0dbcf9ec6ac4a2b4abc79a32483ce215ab90225` |

## Bereits auf Public-main korrekt

- `Joghurt-Zutatenwürfel` ist weder als Rezept noch als aktive Icon-Zuordnung vorhanden.
- Der freigegebene Ersatz für `Lachs-Reis-Erbsen` ist bereits identisch vorhanden.
- `Arroz-caldo-inspiriert` bleibt wegen der ausdrücklich bestätigten Suppenausnahme im Topf.
- `Rote-Linsen-Bratlinge` und `Lachs-Süßkartoffel-Stampf` verwenden bereits die geprüften
  aktiven Motive ohne die beanstandeten zusätzlichen Kräuter.
- Die übrigen früheren technischen Gruppen erfordern auf dem aktuellen aktiven
  Recipe-V2-Stand keine zusätzliche Produktänderung.

## Bewusst nicht übernommen

- `RECIPE_V2_INTEGRATION_10.1.22.json`: gehört zur alten Release-/Python-QA-Struktur und
  existiert im Public-Projekt nicht mehr.
- Die alte PNG-Screenshotreferenz: der aktuelle Public-Teststand verwendet eine andere
  Node-/WebKit-Struktur und enthält dieses QA-Verzeichnis nicht.
- Temporäre Renderings und verworfene Bildvarianten: bleiben außerhalb des Repositorys.
- Keine Rezeptdaten, Icon-Pfade, Version, Package-Konfiguration oder sonstige Produktlogik
  wird aus dem alten Projektstand zurückkopiert.

Die migrierten Prüfsummen und ihre aktive Zuordnung werden durch
`tests/recipe-icon-audit-migration.test.cjs` regressiv abgesichert.

## Prüfung im Public-Arbeitsstand

- Gezielte Recipe-Icon-Migrationsprüfung: 10/10 bestanden.
- Vollständige offizielle Node-Regression auf dem ursprünglichen lokalen Ausgangsstand:
  360/360 bestanden.
- Vor dem Rebase wurde ein temporärer Integrationsstand aus Public-main
  `d6db8887a76813600a1faf7472a7908d970f7ebe` plus exakt den elf Auditdateien geprüft:
  10/10 gezielte Migrationstests und 419/419 vollständige Node-Regressionen bestanden.
- `git diff --check`: bestanden.
- Keine Änderung an Version, Rezeptdaten, Icon-Zuordnung, Service-Worker-Dateiliste oder
  sonstiger Produktlogik.

## Aktueller Gesamtstatus

- Aktiver Recipe-V2-Bestand: 100 Rezeptkarten; vollständig über `RECIPE_ICON_PATHS` zugeordnet.
- 11 Runtime-FOODs haben derzeit noch kein eigenes V2-Asset; dieser Restbestand wird in den separaten FOOD-/Coverage-Arbeitssträngen behandelt.
- Der technische Vollbestands-/Integrity-Test bleibt bewusst ein separater Arbeitsstrang.
