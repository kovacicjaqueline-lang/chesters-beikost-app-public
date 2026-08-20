# FOOD Handling – Orale Verarbeitungsdimension

Stand: 2026-08-20  
Status: fachlich freigegeben und für alle 103 Laufzeitrezepte einzeln auditiert  
Bezug: `docs/FOOD_HANDLING_READINESS_TECHNICAL_DESIGN.md` und `docs/PLANNER_FACHKONZEPT.md`

## Zweck

Der Handling-Contract trennt Darreichungsformen von der oralen Verarbeitung eines tatsächlich abgetrennten Bissens.

Für jede konkrete Rezept-/Servierform werden drei Dimensionen unabhängig bewertet:

1. **Handlingmodus** – z. B. `spoon-mashed`, `spoon-soft-lumpy`, `finger-graspable`, `finger-small-soft`.
2. **Orales Verarbeitungsprofil** – `soft-breakdown`, `easy-bite-separate`, `structured-chew-required`.
3. **Zusätzliche Fähigkeit**, aber nur wenn der konkrete Fall sie wirklich benötigt.

Weder Rezeptkategorie noch `stage`, `minMonths`, Backmethode oder Zwei-Finger-Test erzeugen automatisch ein späteres Gate.

## 1. Orale Profile

### `soft-breakdown`

Der essbare Bissen ist sehr weich beziehungsweise feucht und lässt sich unter leichtem Druck von Zunge, Gaumen, Zahnleisten oder Kiefer weiter zerdrücken beziehungsweise zerfällt leicht.

Es bleibt keine relevante zähe, elastische, faserige, trockene oder kompakte Struktur bestehen.

**Folge:** keine zusätzliche orale Capability allein aufgrund dieses Profils.

### `easy-bite-separate`

Das zusammenhängende Fingerfood kann leicht abgebissen, abgequetscht oder anderweitig abgetrennt werden. Der abgetrennte Bissen bleibt weich, gut beherrschbar, nicht zäh, nicht elastisch und nicht relevant faserig.

**Folge:** keine zusätzliche orale Capability. Das bloße Abbeißen ist ausdrücklich kein Grund für eine spätere Freigabe.

### `structured-chew-required`

Nach dem Abtrennen bleibt ein essbarer Bissen mit zusammenhängender, dichter, elastischer oder faseriger Struktur bestehen. Er muss aktiv im Mund positioniert und durch wiederholte Kiefer- und Zungenbewegungen weiter zerkleinert werden, bevor er schluckfähig wird.

**Folge:** zusätzliche Capability `structured-chew`.

`structured-chew-required` ist keine Altersstufe und insbesondere kein verstecktes „ab 10 Monaten“.

## 2. Entscheidend ist der abgetrennte Bissen

Für die Abgrenzung zählt nicht primär, wie viel Widerstand ein größeres Stück beim ersten Abbeißen bietet.

Entscheidend ist:

> Was passiert mit dem tatsächlich abgetrennten essbaren Bissen im Mund?

Daraus folgen zwei Regeln:

- Widerstand beim Nagen oder Abbeißen ist nicht automatisch `structured-chew-required`.
- Ein äußerlich weiches Lebensmittel kann trotzdem einen kompakten, elastischen oder faserigen Bissen bilden und dadurch oral anspruchsvoller sein.

Resistive Übungsformen sind durch diesen Contract nicht pauschal freigegeben.

## 3. Verbindliche Prüfkriterien

Bei jeder Einzelentscheidung sind mindestens zu prüfen:

1. konkrete Servierform und Geometrie;
2. Kompressibilität;
3. Abtrennverhalten;
4. Verhalten des abgetrennten Bissens;
5. Feuchtigkeit, Kruste, Haut und harte Kanten;
6. Geometrie des entstehenden Bissens;
7. Reproduzierbarkeit aus der konkreten Rezeptur;
8. unabhängige Safety-, Zutaten-, Allergen-, Alters- und Mahlzeitengates.

Der Zwei-Finger-Test bleibt ein nützlicher Sicherheits-/Konsistenzhinweis, reicht aber allein nicht für die orale Einstufung.

## 4. Ergebnis des vollständigen Rezept-Audits

Alle **103 Laufzeitrezepte** wurden einzeln geprüft.

Ergebnis:

- **87 Rezepte:** kein zusätzliches späteres Capability-/Form-Gate;
- **16 Rezepte:** bewusst später wegen konkreter Form, Handling oder oraler Verarbeitung;
- **0 offene Rezepte**.

Die 16 späteren Fälle zerfallen in drei unterschiedliche Gruppen. Diese Gruppen dürfen technisch und fachlich nicht vermischt werden.

### 4.1 Vier Fälle mit `structured-chew-required`

| Rezept | Handling | Oral | Capability |
| --- | --- | --- | --- |
| Rind-Hafer-Bällchen | `finger-graspable` | `structured-chew-required` | `structured-chew` |
| Baby-Bananenbrot | `finger-graspable` | `structured-chew-required` | `structured-chew` |
| Weiche Joghurt-Fladen | `finger-graspable` | `structured-chew-required` | `structured-chew` |
| Huhn-Gemüse-Muffins | `finger-graspable` | `structured-chew-required` | `structured-chew` |

Diese vier Entscheidungen sind Einzelentscheidungen. Sie erzeugen keine Regel wie „Fleisch“, „Brot“ oder „Muffin“ = Structured Chew.

#### Safety-Zusatz Baby-Bananenbrot

Das Bananenbrot muss vollständig durchgebacken und vollständig ausgekühlt sein. Die Krume darf nicht klebrig, teigig oder ballend sein.

Eine klebrig-teigige beziehungsweise ballende Charge ist **kein** „späteres Kaulevel“, sondern ein Safety-Ausschluss und darf nicht angeboten werden.

### 4.2 Drei Fälle mit `finger-small-soft`

| Rezept | Handling | Oral | Capability |
| --- | --- | --- | --- |
| Huhn-Zucchini-Nockerl | `finger-small-soft` | `soft-breakdown` | `small-soft-pieces` |
| Rind-Karotten-Nockerl | `finger-small-soft` | `soft-breakdown` | `small-soft-pieces` |
| Linsen-Süßkartoffel-Nockerl | `finger-small-soft` | `soft-breakdown` | `small-soft-pieces` |

Die Nockerl bleiben kleine einzelne, längliche, sehr weiche Stücke. Sie dürfen nicht gummiartig, klebrig-gummiartig oder kompakt-elastisch sein.

Der spätere Grund ist die **Handhabung kleiner weicher Einzelstücke**, nicht Structured Chew.

### 4.3 Neun Fälle mit weicher späterer Formorientierung

Diese Rezepte erhalten **keine** zusätzliche orale Capability:

- Gemüse-Nudel-Sauce
- Baby-Linsen-Bolognese
- Huhn-Karotte-Nudel-Topf
- Huhn-Lauch-Kartoffel-Topf
- Brokkoli-Linsen-Pasta
- Gemüse-Pasta mit Zucchini und Tomate
- Ei-Champignon-Cups
- Tinola-inspiriert
- Sayote-Huhn-Reis

Bei den weich-stückigen Löffelgerichten bleibt die Stück-/Mischtextur Teil der kanonischen Rezeptidentität. Glatt pürieren ist nicht die Begründung für eine frühe Einstufung, wenn dadurch das eigentliche Gericht verloren geht.

`Ei-Champignon-Cups` bleibt als weiche Cup-Form eine spätere weiche Orientierung, aber ohne `structured-chew`.

## 5. Explizite Gegenbeispiele gegen Kategorienlogik

Folgende einzeln geprüfte Rezepte bleiben ohne zusätzliche orale Capability, obwohl sie zusammenhängende Fingerfoods sind:

- Obst-Hafer-Pancakes
- Birne-Hirse-Pancakes
- Gemüse-Hafer-Pancakes
- Zucchini-Hafer-Pancakes
- Ube-Bananen-Pancakes
- Omelettstreifen
- Zucchini-Omelett als breite weiche Streifen
- Obst-Hafer-Muffins
- Gemüse-Hafer-Muffins
- Kürbis-Hirse-Muffins
- Joghurt-Hafer-Waffeln
- Gemüse-Joghurt-Mini-Muffins
- Süßkartoffel-Linsen-Muffins
- Geflügel-Gemüse-Hafer-Bällchen in der festgelegten flachen/länglichen saftigen Form
- Fleisch-Gemüse-Bällchen in der festgelegten flachen/länglichen saftigen Form

Damit gilt weiterhin ausdrücklich:

- `Muffin` != Structured Chew
- `Pancake` != Structured Chew
- `Bällchen` != Structured Chew
- `Fleisch` != Structured Chew
- `gebacken` != Structured Chew
- `finger-graspable` != „später“

## 6. Kanonische Form statt theoretischer Pürierbarkeit

Bewertet wird das **beabsichtigte Rezept in seiner kanonischen Form**.

Dass Zutaten theoretisch püriert werden könnten, ist kein Beleg dafür, dass das Rezept selbst früh geeignet ist. Aus Nockerln, Pasta, Muffins, Fladen oder einer weich-stückigen Mischmahlzeit darf nicht durch beliebiges Pürieren ein anderes Gericht gemacht werden, nur um ein früheres Profil zu begründen.

Umgekehrt darf eine zusammenhängende Form nicht künstlich nach hinten geschoben werden, wenn ihr tatsächlicher Bissen bereits `easy-bite-separate` oder `soft-breakdown` erfüllt.

## 7. Alterssemantik

Die orale Dimension erzeugt keine neue Altersleiter.

- `soft-breakdown` und `easy-bite-separate` können bei allgemeiner Beikostreife geeignet sein.
- `small-soft-pieces` ist eine konkret beobachtete Handlingfähigkeit, kein Geburtstagsschalter.
- `structured-chew` ist eine konkret beobachtete orale Fähigkeit, kein Geburtstagsschalter.
- `minMonths` bleibt eine weiche Orientierung.
- `hardMinMonths` bleibt ausschließlich unabhängigen echten Altersgründen vorbehalten.
- Safety wird nie in ein Alters- oder Fähigkeitsgate umgedeutet.

## 8. Technischer Contract

Die Runtime verwendet für migrierte Rezepte explizite Felder:

```js
{
  modes: ["finger-graspable"],
  oralProcessing: "structured-chew-required",
  oralRequiredCapability: "structured-chew"
}
```

Für kleine weiche Stücke bleibt die Capability handlingbezogen:

```js
{
  modes: ["finger-small-soft"],
  oralProcessing: "soft-breakdown",
  requiredCapabilities: {
    "finger-small-soft": "small-soft-pieces"
  }
}
```

Die beiden Fähigkeiten werden unabhängig gespeichert:

```js
handlingCapabilities: {
  smallSoftPieces: false,
  structuredChew: false
}
```

Fehlende Altwerte werden konservativ als `false` behandelt. Keine Fähigkeit wird aus Alter, `textureStage`, Rezeptkategorie oder Feeding-Präferenz abgeleitet.
