# FOOD Handling Readiness – vollständiges Read-only-Audit

Stand: 2026-08-18  
Arbeitsbranch: `refactor/food-handling-readiness`  
Prüfbasis: `main`, Version 10.1.24  
Rezeptdaten: `RECIPE_DATA_REVISION = 10.0.0`

## Zweck

Dieses Audit prüft die bestehende lineare Kopplung von `textureStage`, Rezept-`stage` und Fingerfood gegen das fachlich freigegebene Sollbild: Brei/Löffelkost und geeignetes weiches BLW-/Fingerfood dürfen ab Beikostreife parallel möglich sein. Die Beikostphase steuert Mahlzeitenslots und darf nicht als Handling-Schwierigkeit missverstanden werden.

Dieser Commit verändert keine Produktivlogik und keine Rezept- oder FOOD-Daten.

## Executive Summary

### Rezeptbestand

Im tatsächlichen `RECIPES`-Array befinden sich **100 kanonische Rezeptobjekte**. Der Dateikopf nennt weiterhin **101 kanonische Rezeptkarten**. Das ist ein separater Daten-/Dokumentationsbefund und wird in diesem Audit nicht korrigiert.

Verteilung nach aktuellem `stage`:

- Stage 1: 30
- Stage 2: 30
- Stage 3: 31
- Stage 4: 9

Verteilung nach Kategorie:

- `porridge`: 33
- `balls`: 19
- `family`: 16
- `philippines`: 13
- `baking`: 12
- `pancakes`: 7

**41 unterschiedliche Rezeptkarten** tragen den pauschalen Standardtext `skillRequirement` für „weiche kompakte Fingerfoodstücke“. Dieser Text ist derzeit nur ein Sicherheitshinweis und keine aktive Freigabesperre.

### Hauptbefund

Die aktuelle Architektur behandelt Fingerfood faktisch linear:

1. `recipeStatesCore()` sperrt ein Rezept, wenn `textureStage < recipe.stage`.
2. Das UI bezeichnet Stage 3 als `weich-stückig / Fingerfood`.
3. `followUpPreparationOptions()` bietet die Option `fingerfood` erst ab `textureStage >= 3` an.
4. Gleichzeitig erlauben viele FOOD-`safeForm`-Datensätze bereits ausdrücklich parallele Wege wie `pürieren / zerdrücken / als weiches längliches Fingerfood anbieten`.

Damit ist nicht die FOOD-Sicherheitsdatenbasis das Grundproblem, sondern die lineare technische Abbildung.

## Auditklassen

### START-SPOON – 30

Bereits startkompatible löffelbare, pürierte oder weich zerdrückte Rezepte. Aus der Rezeptform selbst folgt keine zusätzliche Selbstfütterungs-Fähigkeit.

### START-FINGER – 24

Weiches, gut greifbares Fingerfood. Nach dem fachlich freigegebenen Sollmodell darf **Fingerfood allein** keine spätere lineare Texturstufe erzwingen. Die konkrete sichere Form bleibt verbindlich.

### ADAPTIVE – 30

Gerichte, die je nach Zubereitung löffelbar, zerdrückt oder stückiger angeboten werden können. Eine einzige Rezept-Stage bildet ihre zulässigen Darreichungswege nicht sauber ab. Sie benötigen künftig presentation-spezifische Eignung statt einer globalen Rezeptstufe.

### SAFETY-REVIEW – 8

Nicht pauschal früher freigeben. Vor einer Umstellung ist eine individuelle Prüfung nötig, insbesondere wegen Gräten, Fleisch-/Bällchenform, konkreter Geometrie oder Widersprüchen zwischen Rezept und FOOD-`safeForm`.

### LATER-REVIEW – 8

Derzeit spätere Back-/Snack-/Familienkostrezepte. Bestehende Altersorientierung oder Rezeptintention spricht gegen ein pauschales Frühfreigeben. Wenn `stage` als Sperre entfällt, muss eine tatsächlich fachlich begründete spätere Voraussetzung strukturiert ersetzt werden.

## START-SPOON – 30 Rezepte

- Obst-Haferbrei
- Obst-Hirsebrei
- Obst-Polentabrei
- Obst-Reisbrei
- Obst-Quinoabrei
- Obst-Buchweizenbrei
- Obst-Grießbrei
- Milch-Getreide-Brei
- Kürbis-Hafer-Brei
- Lugaw-Basis
- Kürbis-Lugaw
- Monggo-Kalabasa-Brei
- Karotten-Polenta-Brei
- Süßkartoffel-Rote-Linsen-Brei
- Bananen-Haferbrei mit Erdnussmus
- Karotten-Hirse-Brei mit Tahin
- Apfel-Hirse-Brei mit Mandelmus
- Apfel-Birnen-Kompott
- Karotte-Süßkartoffel-Brei
- Zucchini-Kartoffel-Brei
- Avocado-Bananen-Creme
- Ube-Hafer-Brei
- Obst-Joghurt
- Obst-Hafer-Joghurt
- Obst-Hirse-Joghurt
- Obst-Grieß-Joghurt
- Buttermilch-Hafer-Obstbrei
- Buttermilch-Hirse-Obstbrei
- Buttermilch-Grieß-Obstbrei
- Joghurt-Nussmus-Miniportion

## START-FINGER – 24 Rezepte

- Obst-Hafer-Pancakes
- Birne-Hirse-Pancakes
- Gemüse-Hafer-Pancakes
- Zucchini-Hafer-Pancakes
- Ube-Bananen-Pancakes
- Rote-Linsen-Gemüsebällchen
- Tofu-Brokkoli-Bällchen
- Brokkoli-Kartoffel-Taler
- Zucchini-Hafer-Puffer
- Kichererbsen-Kürbis-Taler
- Rote-Linsen-Bratlinge
- Polenta-Zucchini-Sticks
- Süßkartoffel-Hirse-Sticks
- Omelettstreifen
- Zucchini-Omelett
- Baby-Bananenbrot
- Kichererbsenmehl-Zucchini-Taler
- Paprika-Omelettstreifen
- Buchweizen-Bananen-Pancakes
- Süßkartoffel-Linsen-Taler
- Gebackene Saba-Banane
- Bananen-Joghurt-Hafer-Pancakes
- Obst-Joghurt-Hafer-Ofenbites
- Zucchini-Joghurt-Hafer-Bites

**Wichtig:** `START-FINGER` bedeutet nicht „automatisch ab Tag 1 planen“. Zutatenstatus, Mahlzeiteneignung, Allergene, Alter, sichere Zubereitung und Planner-Regeln bleiben vollständig wirksam. Die Klasse sagt nur: Die Fingerfood-Form selbst rechtfertigt keine lineare Sperre bis Stage 3.

## ADAPTIVE – 30 Rezepte

- Gemüse-Nudel-Sauce
- Baby-Linsen-Bolognese
- Tinola-inspiriert
- Arroz-caldo-inspiriert
- Kalabasa mit Kokos
- Tilapia-Reis-Brei
- Zucchini-Quinoa-Brei
- Brokkoli-Kartoffel-Stampf
- Karfiol-Kartoffel-Stampf
- Erbsen-Kartoffel-Stampf
- Kürbis-Linsen-Suppe
- Mildes Rote-Linsen-Dhal
- Huhn-Karotte-Nudel-Topf
- Huhn-Lauch-Kartoffel-Topf
- Huhn-Brokkoli-Reis
- Rind-Gemüse-Bolognese
- Tomaten-Linsen-Sauce
- Brokkoli-Linsen-Pasta
- Gemüse-Pasta mit Zucchini und Tomate
- Lachs-Reis-Erbsen
- Lachs-Süßkartoffel-Stampf
- Kabeljau-Tomaten-Gemüse
- Weiches Rührei
- Kürbis-Kichererbsen-Creme
- Tofu-Zucchini-Reis
- Huhn-Lugaw
- Sayote-Huhn-Reis
- Monggo-Süßkartoffel-Brei
- Gemüse-Fleisch-Nockerl
- Bohnen-Kartoffel-Stampf

Diese Gruppe zeigt besonders deutlich, warum `recipe.stage` zu grob ist: Das gleiche Gericht kann in einer sehr weichen/zerdrückten Form früher passend sein und später stückiger angeboten werden, ohne dass daraus mehrere fachlich unterschiedliche Rezepte entstehen müssen.

## SAFETY-REVIEW – 8 Rezepte

- Rind-Hafer-Bällchen
- Geflügel-Gemüse-Hafer-Bällchen
- Lachs-Kartoffel-Bällchen
- Bangus-Kartoffel-Taler
- Eier-Finger
- Ei-Champignon-Cups
- Hummus mit weichen Gemüsesticks
- Fleisch-Gemüse-Bällchen

### Besondere Konflikte

**Fleisch-Bällchen:** Die FOOD-Daten für Rind/Huhn enthalten historisch Formulierungen wie „später als sehr weiches Bällchen“, während die Rezepttexte inzwischen bewusst flache/längliche weiche Stücke statt fester runder Kugeln verlangen. Vor einer Frühfreigabe muss diese Semantik vereinheitlicht und strukturiert werden.

**Bangus:** Das Rezept weist selbst auf die vielen feinen Gräten hin. Hier darf ein allgemeiner „soft-graspable“-Schalter die spezifische Fischsicherheit nicht überstimmen.

**Hummus mit weichen Gemüsesticks:** Das Rezept verlangt aktuell Gurke und spricht von „sehr weichen Gemüsesticks“. Die geprüfte Gurken-`safeForm` sieht dagegen frische längliche greifbare Stücke bzw. alternativ Reiben/Zerdrücken vor und ausdrücklich kein pauschales Garen. Das ist ein konkreter Rezept-/FOOD-Formkonflikt.

## LATER-REVIEW – 8 Rezepte

- Obst-Hafer-Muffins
- Gemüse-Hafer-Muffins
- Kürbis-Hirse-Muffins
- Joghurt-Hafer-Waffeln
- Weiche Joghurt-Fladen
- Gemüse-Joghurt-Mini-Muffins
- Huhn-Gemüse-Muffins
- Süßkartoffel-Linsen-Muffins

Mehrere dieser Rezepte tragen `minMonths` 10 oder 11. `minMonths` ist aktuell aber nur Orientierung in der UI; die eigentliche technische Sperre entsteht durch `stage`. Deshalb darf `stage` hier nicht einfach entfernt werden, bevor eine explizite, fachlich bestätigte spätere Eignung strukturiert abgebildet werden kann.

`Kürbis-Hirse-Muffins` ist auffällig: Stage 4, aber keine entsprechende klare `minMonths`-Absicherung. Das ist ein eigener Reviewfall und kein Beleg dafür, dass alle Muffins früh gehören.

## FOOD-Safe-Form-Audit

### Bereits parallel modellierte sichere Formen

Die FOOD-Daten enthalten bereits zahlreiche parallele Darreichungen. Beispiele:

- Karotte: sehr weich garen; pürieren, zerdrücken **oder** als weiches längliches Fingerfood anbieten.
- Kartoffel: ebenso.
- Zucchini: ebenso.
- Brokkoli/Karfiol/Süßkartoffel und weitere Gemüse: ebenso.
- Banane im Runtime-Sicherheitsaudit: sehr reif und weich zerdrücken **oder** als weiches gut greifbares Stück anbieten.
- Avocado: zerdrücken **oder** als weiche gut greifbare Spalte anbieten.
- Gurke: längliche gut greifbare Stücke; bei fester Form alternativ reiben/zerdrücken.

Die Quelle kennt somit bereits parallele Darreichungswege. `followUpPreparationOptions()` reduziert diese Information aktuell künstlich auf eine lineare Stage-Abfolge.

### Safe Form ist eine eigene Sicherheitsdimension

Andere FOOD-Regeln zeigen, dass Darreichung nicht einfach „Texturstufe“ bedeutet:

- Trauben/Kirschen/Beeren: Form und Geometrie sind sicherheitsrelevant.
- Mais: keine ganzen Körner.
- Fisch: vollständig garen, Haut/Gräten entfernen, weich zerzupfen/zerdrücken.
- Blattgemüse: keine faserigen ganzen Blätter.
- ganze Getreidekörner: für junge Beikostkinder weich/zerdrückt/gemahlen, keine festen Körner.
- Honig: eigene Altersgrenze.
- Öle: Komponenten, nicht als eigenes Lebensmittel.

Diese Regeln dürfen durch eine neue BLW-Präferenz niemals abgeschwächt werden.

## Technisches Verwendungs-Audit

### `recipe.stage`

`recipeStatesCore()` vergleicht `state.settings.textureStage` direkt mit `recipe.stage`. Ist die Nutzerstufe niedriger, wird das Rezept als nicht freigeschaltet markiert. Planner-Pfade, die `recipeStates().filter(r => r.unlocked)` verwenden, übernehmen diese Sperre.

### `skillRequirement`

Wird derzeit auf Rezeptkarten unter `Sicher anbieten` dargestellt. Kein aktiver Bestandteil von `unlocked`.

### `textureStage`

Ist derzeit gleichzeitig:

- globale Konsistenz-Einstellung,
- Bestandteil des Textur-Coachs,
- Rezeptfreigabe-Schranke,
- Filter für Folge-Zubereitungsoptionen,
- in jedem Mahlzeitenlog gespeicherte und angezeigte Metainformation.

Eine Migration darf historische `textureStage`-Werte daher nicht nachträglich als „BLW-Fähigkeit“ umdeuten.

### `followUpPreparationOptions()`

Die Option `fingerfood` wird nur bei `textureStage >= 3` angeboten. Dieser konkrete Gate ist mit dem freigegebenen Parallelmodell nicht vereinbar.

## Sollmodell nach Audit

Das Audit spricht gegen einen neuen linearen „Skill 1–4“. Empfohlen ist eine **zweidimensionale Darreichungslogik**:

### Achse A – Löffel-/Speisentextur

Beispielsweise strukturiert:

- `smooth`
- `mashed`
- `soft-lumpy`

Diese Achse kann weiterhin Texturentwicklung beschreiben.

### Achse B – Selbstfütterungs-/Handlingform

Mindestens:

- `soft-graspable` – weiches, gut greifbares Fingerfood; darf parallel zu frühen Löffeltexturen möglich sein
- `small-soft-pieces` – kleine weiche Stücke; nur wenn eine tatsächlich weitergehende motorische Voraussetzung fachlich bestätigt ist

Die Begriffe sind Arbeitsnamen. Vor Produktivimplementierung werden Datenvertrag und UI-Texte separat freigegeben.

### Nutzerpräferenz separat

Planner-Präferenz:

- `spoon`
- `blw`
- `mixed`

Die Präferenz **bevorzugt** passende Darreichungen. Sie darf weder Alters-/Sicherheitsgrenzen noch Mahlzeiteneignung oder Zutatenfreigabe überstimmen.

## Datenmodell-Anforderung

Keine Steuerlogik aus beliebigem `safeForm`- oder `note`-Freitext ableiten.

Stattdessen braucht die nächste Phase einen kleinen strukturierten Presentation-/Handling-Contract, der mindestens ausdrücken kann:

- welche Darreichungsmodi ein FOOD/Rezept unterstützt,
- welche Modi bereits ab allgemeiner Beikostreife möglich sind,
- ob ein Modus eine zusätzliche bestätigte Fähigkeit verlangt,
- welche spezifischen Safety-Regeln unabhängig davon erhalten bleiben.

Bestehende Texte bleiben Erklärung für die Nutzerin, nicht Parser-Input für die Planner-Logik.

## Referenzfall Bananen-Ei-Pancakes

Das fehlende Rezept bleibt ein guter Regressionstest:

- Zutaten: Banane + Ei, kein Pflicht-Hafer
- Ei vollständig durchgaren
- Pancake weich und greifbar halten
- nicht allein wegen `pancakes`/Fingerfood auf Stage 2 oder 3 sperren
- Zutaten-/Allergenstatus und Mahlzeiteneignung bleiben unverändert verbindlich

Das Rezept wird **noch nicht** in diesem Audit-Commit ergänzt.

## P0-Tests für die nächste Phase

1. `mixed`: Bei geeigneter Karotte dürfen frühe löffelbare **und** weiche greifbare Darreichungen parallel verfügbar sein.
2. `blw`: Weiches greifbares Fingerfood darf nicht nur wegen `textureStage < 3` gesperrt werden.
3. `spoon`: Der Planner bevorzugt löffelbare Formen, ohne andere sichere Formen fachlich als „unreif“ zu deklarieren.
4. Omelettstreifen und fachlich freigegebene weiche Pancakes dürfen nicht allein durch die historische Stage-3-Fingerfoodkopplung gesperrt werden.
5. `SAFETY-REVIEW`-Rezepte werden nicht durch einen globalen Fingerfood-Schalter pauschal freigeschaltet.
6. Honig-/Altersgrenzen, eingeschränkte Fischarten, Mahlzeiteneignung und `autoPlan=false` bleiben unverändert wirksam.
7. Phase 1–4 steuert weiterhin nur die freigegebenen Mahlzeitenslots.
8. Bestehende Logs behalten ihren historischen `textureStage`-Wert unverändert.
9. Bestehende Backups werden ohne Informationsverlust migriert.
10. Bestehende automatische Plan-Locks werden durch das neue Präferenzfeld nicht stillschweigend umgeschrieben.

## Entscheidung nach Audit

**Nicht** jetzt alle Stage-3-Rezepte auf Stage 1 setzen und **nicht** `textureStage` einfach entfernen.

Der nächste technische Schritt soll stattdessen sein:

1. strukturierten Handling-/Presentation-Contract entwerfen,
2. migrationssicheren Nutzerwert `spoon | blw | mixed` festlegen,
3. Tests für die neue Eignungsfunktion zuerst schreiben,
4. erst danach die linearen Gates gezielt ersetzen,
5. anschließend Rezeptgruppen einzeln auf Basis dieses Audits migrieren.

## Status

Read-only-Audit abgeschlossen. Produktivlogik, Rezeptdaten, FOOD-Daten, Version und Schema bleiben unverändert.