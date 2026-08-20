# FOOD Handling Readiness – technisches Sollmodell

Stand: 2026-08-18  
Branch: `refactor/food-handling-readiness`  
Basis: aktueller `main` nach Merge von PLAN-08

## Ziel

Die fachlich freigegebene Parallelität von Löffel-/Breikost und geeignetem Fingerfood technisch abbilden, ohne Mahlzeitenphase, Alter, Allergene, Mahlzeiteneignung, FOOD-Sicherheit oder bestehende Planner-Locks abzuschwächen.

Das Modell ersetzt **nicht** die Beikostphase und führt **keinen neuen linearen Skill-Level** ein.

## Revalidierung nach PLAN-08-Merge

Der aktuelle `main` enthält inzwischen PLAN-08 Recipe-first. Das verändert den Integrationspunkt, aber nicht den Grundbefund:

- `recipeStatesCore()` sperrt weiterhin über `textureStage < recipe.stage`.
- PLAN-08 Recipe-first verwendet `recipeStates()` und verwirft Kandidaten mit `requirementMissing`.
- Damit reicht eine zentrale Korrektur der Rezept-Handling-Eignung in `recipeStatesCore()` aus, damit auch Recipe-first dieselben Regeln übernimmt.
- Keine zweite parallele Handling-Schranke in `planner-recipe-first.js` einbauen.
- Der bestehende `FOOD_PRESENTATION_CONTRACT` aus PLAN-08 bleibt Anzeige-/Darstellungslogik und darf nicht zur Handling-Eignung umgedeutet werden.

## Grundprinzipien

1. **Eligibility und Preference trennen.** Eine sichere Darreichungsform kann fachlich möglich sein, auch wenn sie nicht der bevorzugten Beikostform entspricht.
2. **Kein Parsen von Freitext.** `safeForm`, `note` und `skillRequirement` bleiben erklärende Texte, keine Steuerlogik.
3. **Bestehende Safety-Regeln bleiben härter als Handling-Präferenz.**
4. **Unmigrierte Rezepte behalten zunächst ihre alte `stage`-Sperre.** Dadurch entsteht keine globale Frühfreigabe.
5. **Migration erfolgt gruppenweise und explizit** auf Basis des Read-only-Audits.
6. **Historische `textureStage`-Logs behalten ihre Bedeutung.** Kein nachträgliches Umdeuten zu BLW-/Fingerfood-Fähigkeit.

## 1. Nutzerpräferenz

Neues Setting:

```js
feedingApproach: "mixed"
```

Zulässige Werte:

- `spoon` – Löffel/Brei bevorzugen
- `fingerfood` – selbst greifbare Formen bevorzugen
- `mixed` – beide Wege gleichwertig zulassen

### Semantik

`feedingApproach` ist **keine Reifestufe** und kein Safety-Override. Das Feld beeinflusst die Auswahl/Sortierung geeigneter Darreichungsformen, nicht die allgemeinen Lebensmittelregeln.

### Default/Migration

Empfehlung: `mixed` als neuer Default. Bestehende gespeicherte Zustände erhalten den Wert additiv bei Migration/Default-Merge.

Wichtig: Bereits vorhandene `planLocks`, manuelle Mahlzeiten und Logs werden durch das neue Feld nicht neu geschrieben. Änderungen wirken nur auf neu erzeugte automatische Planung bzw. neu gewählte Darreichungsformen.

## 2. Strukturierter Handling-Contract

Neue separate Datei, z. B.:

`data/food-handling.js`

Sie ist bewusst **nicht** `data/food-presentation.js`, weil PLAN-08 dort Anzeige-/Komponentenrollen hält, die ausdrücklich keine Planner-Eignung verändern.

### Darreichungsmodi

Arbeitsnamen:

```js
const HANDLING_MODES = {
  SPOON_SMOOTH: "spoon-smooth",
  SPOON_MASHED: "spoon-mashed",
  SPOON_SOFT_LUMPY: "spoon-soft-lumpy",
  FINGER_GRASPABLE: "finger-graspable",
  FINGER_SMALL_SOFT: "finger-small-soft",
};
```

### Semantik

- `spoon-smooth`: glatt/löffelbar
- `spoon-mashed`: weich zerdrückt
- `spoon-soft-lumpy`: weiche gröbere/stückige Löffeltextur
- `finger-graspable`: weiches, ausreichend großes, gut greifbares Fingerfood; **nicht** automatisch spätere Entwicklungsstufe
- `finger-small-soft`: kleine weiche Stücke; nur dort verwenden, wo eine zusätzliche feinmotorische Voraussetzung tatsächlich fachlich bestätigt ist

### Fachlich freigegebene orale Verarbeitungsdimension

Der Handlingmodus allein beschreibt bei zusammenhängendem Fingerfood nicht vollständig die orale Anforderung. Die am 20.08.2026 fachlich freigegebene additive Erweiterung ist verbindlich in

`docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`

dokumentiert.

Dort werden die orthogonalen Profile `soft-breakdown`, `easy-bite-separate` und `structured-chew-required` definiert. Sie bilden **keine lineare Alters- oder Entwicklungsleiter**. Insbesondere bedeutet `finger-graspable` nicht automatisch, dass ein Stück oral gleich anspruchsvoll ist, und `structured-chew-required` ist kein verstecktes „ab 10 Monaten“.

Für spätere technische Erweiterungen gilt daher zusätzlich:

- orale Verarbeitung getrennt vom Handlingmodus modellieren;
- Einstufung nur aus konkret geprüftem Rezept plus Servierform ableiten;
- keine Gruppenlogik aus `Muffin`, `Pancake`, `Bällchen`, `Fleisch`, `stage` oder `minMonths`;
- Zwei-Finger-Zerdrückbarkeit allein reicht nicht zur oralen Einstufung;
- bei unklarer reproduzierbarer Struktur bleibt das orale Profil offen;
- eine zusätzliche orale Capability darf erst für einen konkret fachlich freigegebenen Fall produktiv werden.

## 3. Rezept-Contract

Rezeptfreigabe wird künftig nicht aus `category === "pancakes"` oder `stage === 3` abgeleitet.

Beispielstruktur:

```js
const RECIPE_HANDLING_CONTRACT = Object.freeze({
  "Obst-Hafer-Pancakes": Object.freeze({
    modes: ["finger-graspable"],
  }),
  "Omelettstreifen": Object.freeze({
    modes: ["finger-graspable"],
  }),
  "Brokkoli-Kartoffel-Stampf": Object.freeze({
    modes: ["spoon-mashed", "spoon-soft-lumpy"],
  }),
});
```

Für einen migrierten Recipe-Eintrag ersetzt der Handling-Contract die historische `stage`-Sperre **nur für die Handling-Dimension**. `hardMinMonths`, Zutatenstatus, Milchregeln, Mahlzeiteneignung und andere unabhängige Regeln bleiben aktiv.

### Unmigrierte Rezepte

Wenn kein strukturierter Handling-Eintrag vorhanden ist:

```text
legacy fallback = bisherige recipe.stage / textureStage-Logik
```

So kann die Migration kontrolliert erfolgen und `SAFETY-REVIEW` / `LATER-REVIEW` bleiben zunächst unangetastet.

## 4. FOOD-Contract

Für einzelne FOODs wird ebenfalls explizit festgelegt, welche Darreichungsmodi fachlich bestätigt sind.

Beispiele aus bereits geprüften Safe-Forms:

```js
const FOOD_HANDLING_CONTRACT = Object.freeze({
  karotte: Object.freeze({
    modes: ["spoon-smooth", "spoon-mashed", "finger-graspable"],
  }),
  zucchini: Object.freeze({
    modes: ["spoon-smooth", "spoon-mashed", "finger-graspable"],
  }),
  banane: Object.freeze({
    modes: ["spoon-mashed", "finger-graspable"],
  }),
  avocado: Object.freeze({
    modes: ["spoon-mashed", "finger-graspable"],
  }),
});
```

Der Contract sagt **nur**, welche Form grundsätzlich existiert. Die konkrete `safeForm` bleibt verbindliche Zubereitungsanweisung.

## 5. Optionale echte Fähigkeit

Für die erste Implementierungsstufe ist **kein User-Skill für `finger-graspable` nötig**. Das ist der zentrale Unterschied zum heutigen Stage-3-Modell.

Eine zusätzliche Fähigkeit wird erst eingeführt, wenn ein konkreter Rezept-/FOOD-Fall sie benötigt. Vorgesehener Erweiterungspunkt:

```js
requiredCapability: "small-soft-pieces"
```

Möglicher Nutzerstatus später:

```js
handlingCapabilities: {
  smallSoftPieces: false,
}
```

Dieser Wert darf erst produktiv werden, wenn die zugehörigen Lebensmittel/Rezeptformen einzeln fachlich freigegeben sind. Kein pauschaler „Pinzettengriff = alles klein erlaubt“-Schalter.

Die orale Contract-Erweiterung reserviert dabei **keine** neue Capability pauschal. Ein möglicher späterer Wert wie `structured-chew` wäre erst nach einer konkreten Einzelentscheidung einzuführen.

## 6. Zentrale Eligibility-Funktion

Neue pure Funktion, z. B.:

```js
handlingEligibilityForRecipe(recipe, settings)
```

Ergebnisstruktur:

```js
{
  migrated: true,
  eligibleModes: ["finger-graspable"],
  preferredModes: ["finger-graspable"],
  blockedReasons: [],
}
```

### Ablauf

1. strukturierten Recipe-Handling-Eintrag suchen
2. wenn keiner vorhanden: Legacy-Stage-Fallback
3. Modi gegen tatsächlich erforderliche Capability prüfen
4. `feedingApproach` nur für `preferredModes`/Ranking verwenden
5. keine Alters-, Zutaten-, Mahlzeiten- oder Safety-Regel in dieser Funktion duplizieren

## 7. Integration in `recipeStatesCore()`

Heute:

```text
textureStage < recipe.stage -> requirementMissing
```

Neu:

- migriertes Rezept: Handling-Eligibility aus dem strukturierten Contract verwenden
- unmigriertes Rezept: bisherigen Stage-Vergleich unverändert beibehalten
- `hardMinMonths` bleibt wie bisher
- `ingredientMissing` bleibt wie bisher
- `unlocked` bleibt zentrale kombinierte Freigabe

Dadurch übernehmen automatisch auch:

- Rezeptliste
- Rezeptvorrat
- Snack-Rezeptkandidaten
- PLAN-08 Recipe-first

konsistent dieselbe Handlingfreigabe.

## 8. PLAN-08 Recipe-first

`plannerExactRecipeCandidates()` prüft bereits:

- Mahlzeiteneignung
- `recipeAllowedFn`
- `requirementMissing`
- exakte FOOD-ID-Übereinstimmung

Daher **keine neue Speziallogik in PLAN-08**. Ein Recipe-first-Kandidat ist nur dann möglich, wenn `recipeStates()` ihn nach der neuen zentralen Handlinglogik freigibt.

Wichtig: Wenn mehrere technisch gleichrangige Rezeptformen exakt passen, darf PLAN-08 weiterhin keine Darreichungsform erraten. Feeding-Präferenz kann später als expliziter Ranking-Faktor ergänzt werden; sie darf die bestehende Ambiguität nicht unbemerkt auflösen, bevor dieses Verhalten getestet/freigegeben ist.

## 9. FOOD-only-Folgeformen

`followUpPreparationOptions()` darf künftig nicht mehr `textureStage >= 3` als Fingerfood-Bedingung verwenden.

Stattdessen:

1. `FOOD_HANDLING_CONTRACT[foodId].modes` lesen
2. sichere verfügbare Modi bestimmen
3. nach `feedingApproach` sortieren
4. bestehende `safeForm`-Texte als Erklärung anzeigen

Für FOODs ohne Contract bleibt der heutige konservative Fallback zunächst bestehen.

## 10. Mahlzeit-/Plan-Daten

Neue optionale Eigenschaft auf einer konkret geplanten Mahlzeit:

```js
presentationMode: "finger-graspable"
```

Zweck:

- Prep weiß, welche Form geplant war
- Plananzeige kann die Form verständlich nennen
- Logging kann die tatsächlich angebotene Form übernehmen
- Locks frieren die konkrete Darreichung mit ein

### Lock-Kompatibilität

Alte Locks ohne `presentationMode` bleiben gültig. Neue Locks übernehmen das Feld nur additiv.

## 11. Logging

`textureStage` bleibt vorerst unverändert gespeichert, um Historie und vorhandene Statistiken nicht zu brechen.

Optional neues Feld:

```js
presentationMode: "spoon-mashed"
```

Dadurch können später getrennt ausgewertet werden:

- Speisentextur
- Selbstfütterungsform

Ein alter Log ohne `presentationMode` wird **nicht** aus `textureStage` rückwirkend als BLW oder Löffel interpretiert.

## 12. UI

### Beikostform

Neue verständliche Auswahl:

- Löffel/Brei
- Fingerfood/BLW
- Gemischt

Kurzer Hinweis:

> Die Auswahl steuert, welche passenden Darreichungsformen die Planung bevorzugt. Sie ist keine Entwicklungsstufe.

### Textur-Coach

Der Textur-Coach darf weiter Löffel-/Speisentextur begleiten, aber `Stage 3 = Fingerfood` muss entkoppelt werden.

Zieltexturbezeichnungen später z. B.:

- 1: glatt / fein zerdrückt
- 2: weich zerdrückt
- 3: weich-stückig
- 4: weiche Familienkost

Fingerfood wird separat über Handling-/Darreichungsform erklärt.

## 13. Erste migrationssichere Implementierungswelle

Nicht alle 100 Rezepte gleichzeitig migrieren.

### Wave 1 – eindeutige Referenzfälle

FOOD:

- Karotte
- Kartoffel
- Zucchini
- Brokkoli
- Karfiol
- Süßkartoffel
- Banane
- Avocado

Rezepte:

- Obst-Hafer-Pancakes
- Birne-Hirse-Pancakes
- Gemüse-Hafer-Pancakes
- Omelettstreifen
- Zucchini-Omelett
- Brokkoli-Kartoffel-Stampf
- Zucchini-Kartoffel-Brei
- Avocado-Bananen-Creme

Diese Fälle decken frühes Löffeln, frühes greifbares Fingerfood und adaptive Textur ab.

### Noch nicht Wave 1

- alle `SAFETY-REVIEW`-Rezepte
- alle `LATER-REVIEW`-Rezepte
- pauschale Migration aller Bällchen/Muffins/Bites

## 14. Bananen-Ei-Pancakes

Das neue Rezept wird erst nach funktionierender Wave-1-Handlinglogik ergänzt.

Geplanter Contract:

```js
"Bananen-Ei-Pancakes": {
  modes: ["finger-graspable"]
}
```

Damit dient das Rezept als Regression dafür, dass ein weiches Fingerfood nicht künstlich eine spätere `textureStage` braucht.

## 15. Tests-first

Vor Produktivänderung Tests für mindestens:

1. migriertes `finger-graspable`-Rezept ist bei `textureStage = 1` handlingseitig möglich
2. Legacy-Rezept ohne Contract behält Stage-Sperre
3. `hardMinMonths` bleibt unabhängig aktiv
4. unbekannte Zutat sperrt weiterhin
5. `feedingApproach=spoon` macht Fingerfood nicht „unsicher“, sondern nur nicht bevorzugt
6. `feedingApproach=fingerfood` macht Löffelform nicht fachlich ungültig
7. `mixed` lässt beide Mode-Familien gleichwertig zu
8. FOOD Karotte liefert bei Stage 1 sowohl Löffel- als auch `finger-graspable`-Option
9. PLAN-08 Recipe-first sieht nur zentral freigegebene Rezepte
10. bestehender Lock ohne `presentationMode` bleibt stabil
11. neuer Lock kann `presentationMode` tragen
12. alter Log behält `textureStage`; kein rückwirkendes BLW-Inferenzfeld

Bei einer späteren technischen Umsetzung der oralen Dimension kommen zusätzlich Regressionen aus `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md` hinzu; insbesondere muss `Omelettstreifen` als `easy-bite-separate` ohne zusätzliche orale Capability bei allgemeiner Beikostreife möglich bleiben.

## Status

Technisches Sollmodell festgelegt. Die additive orale Verarbeitungsdimension ist fachlich in `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md` festgelegt, aber noch nicht als Runtime-Feld oder Capability implementiert. Bestehende Produktlogik und Rezeptdaten werden durch diese Dokumentation nicht verändert.