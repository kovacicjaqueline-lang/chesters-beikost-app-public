# FOOD Handling – Bite Separation und orale Verarbeitung

Stand: 2026-08-21  
Status: fachlich freigegeben; bestehender Laufzeitkatalog gezielt auf Bite Separation nachauditiert  
Bezug: `docs/FOOD_HANDLING_READINESS_TECHNICAL_DESIGN.md` und `docs/PLANNER_FACHKONZEPT.md`

## Zweck

Der Contract trennt bei einer konkreten Rezept-/Servierform vier unabhängige Fragen:

1. **Handlingmodus** – wie wird das Food aufgenommen beziehungsweise angeboten?
2. **Bite Separation** – wie anspruchsvoll ist es, aus einem größeren zusammenhängenden Fingerfood einen beherrschbaren Bissen abzutrennen?
3. **Oral Processing** – was verlangt der bereits abgetrennte Bissen im Mund?
4. **Beobachtete Capability** – nur wenn die konkrete Form tatsächlich eine zusätzliche Fähigkeit voraussetzt.

Diese Dimensionen sind orthogonal. Weder Rezeptkategorie noch `stage`, `minMonths`, Backmethode, Fingerfood-Label, Zwei-Finger-Test oder eine andere Capability darf eine Einstufung automatisch erzeugen.

Insbesondere gilt:

- `graded-bite` => **nicht** automatisch `structured-chew`;
- `structured-chew` => **nicht** automatisch `graded-bite`;
- Zähne sind keine Voraussetzung für `graded-bite`;
- Alter bleibt Orientierung, sofern keine eigenständige harte Alters-/Safety-Regel vorliegt.

## 1. Handlingmodus

Unverändert:

- `spoon-smooth`
- `spoon-mashed`
- `spoon-soft-lumpy`
- `finger-graspable`
- `finger-small-soft`

`finger-graspable` ist keine spätere Entwicklungsstufe. Ein geeignetes weiches, gut greifbares Fingerfood kann unabhängig von der Löffelkonsistenz angeboten werden.

`finger-small-soft` bezeichnet kleine weiche Einzelstücke. Die dafür bestehende Capability `small-soft-pieces` wird fachlich auf **Aufnehmen und selbst zum Mund führen** begrenzt; sie beschreibt keine separate orale Small-Piece-Fähigkeit.

## 2. Bite Separation

Bite Separation wird nur für zusammenhängende `finger-graspable`-Formen verwendet. Für Löffelkost und bereits einzeln angebotene kleine Stücke ist die Dimension nicht anwendbar.

### `low-resistance-separate`

Die konkrete Form gibt bereits unter sehr geringem Mund-/Kieferdruck nach, kollabiert, quetscht sich ab oder trennt sich sehr leicht. Eine relevante graduierte Steuerung der Bissgröße ist nicht erforderlich.

**Folge:** keine zusätzliche Capability.

### `easy-bite-separate`

Ein tatsächliches Abbeißen oder Abquetschen findet statt, die weiche Struktur trennt sich aber zuverlässig unter geringer Belastung. Eine besondere Bite-Capability ist nicht erforderlich.

**Folge:** keine zusätzliche Capability.

### `graded-bite-required`

Das Food ist weich, aber ausreichend formstabil beziehungsweise kohäsiv, dass das Kind es geeignet positionieren und durch kontrollierten Kieferschluss einen beherrschbaren Bissen gezielt abtrennen muss.

**Folge:** zusätzliche Capability `graded-bite`.

`graded-bite` bedeutet **Kontrolle**, nicht „kräftiger beißen“.

Beobachtbare Nutzersemantik:

> Mein Kind kann bei einem weichen, aber formstabilen Stück gezielt einen passenden Bissen abtrennen.

Nicht Bestandteil der Capability:

- bestimmtes Alter;
- bestimmte Zahl von Zähnen;
- bestimmte Bisskraft;
- Rotary Chew;
- Verarbeitung eines danach faserigen/elastischen Bissens;
- bloßes Zerreißen mit der Hand;
- zufälliges Abbrechen eines extrem weichen Foods.

Ein späteres `controlled-sustained-bite` wird im aktuellen Rezeptumfang bewusst **nicht** als weitere Capability modelliert.

## 3. Oral Processing nach dem Abtrennen

Diese Dimension beantwortet ausschließlich:

> Was verlangt der bereits abgetrennte essbare Bissen?

### `soft-breakdown`

Der Bissen ist sehr weich beziehungsweise feucht und lässt sich unter leichtem Druck von Zunge, Gaumen, Zahnleisten oder Kiefer weiter zerdrücken beziehungsweise zerfällt leicht.

Es bleibt keine relevante zähe, elastische, faserige, trockene oder kompakte Struktur bestehen.

**Folge:** keine zusätzliche orale Capability.

### `easy-chew`

Der Bissen bleibt als weicher, beherrschbarer Bissen erkennbar zusammenhängend und benötigt einfache Mund-/Kieferarbeit, ist aber nicht relevant zäh, elastisch, faserig, trocken oder dicht-kompakt.

**Folge:** keine zusätzliche orale Capability.

`easy-chew` übernimmt damit den post-separation-Anteil, der zuvor mit `easy-bite-separate` in einer gemeinsamen Oral-Semantik vermischt war.

### `structured-chew-required`

Nach dem Abtrennen bleibt ein zusammenhängender, dichter, elastischer oder faseriger Bissen bestehen. Er muss aktiv im Mund positioniert und durch wiederholte Kiefer- und Zungenbewegungen weiter zerkleinert werden.

**Folge:** zusätzliche Capability `structured-chew`.

`structured-chew-required` ist keine Altersstufe.

## 4. Verbindliche Prüfkriterien

Bei jeder Einzelentscheidung sind mindestens zu prüfen:

1. konkrete kanonische Servierform und Geometrie;
2. Kompressibilität beziehungsweise `firmness`;
3. Kohäsion beziehungsweise `cohesion`;
4. Feuchtigkeit beziehungsweise `moisture`;
5. Partikel-/Mischstruktur beziehungsweise `particleStructure`;
6. Abtrennverhalten;
7. Verhalten des abgetrennten Bissens;
8. Kruste, Haut, harte Kanten, Faserigkeit und Elastizität;
9. Geometrie des entstehenden Bissens;
10. Reproduzierbarkeit aus der konkreten Rezeptur;
11. unabhängige Safety-, Zutaten-, Allergen-, Alters- und Mahlzeitengates.

Die vier mechanischen Eigenschaften `firmness`, `cohesion`, `moisture` und `particleStructure` sind Auditmerkmale. Sie erzeugen **keine automatische Regelmaschine** und müssen nicht allein deshalb als Runtime-Felder gespeichert werden.

Der Zwei-Finger-Test bleibt ein nützlicher Konsistenzhinweis, reicht aber allein nicht für Bite-/Oral-Einstufungen.

## 5. Ergebnis des gezielten Bite-Separation-Rechecks

Alle **41 bestehenden zusammenhängenden `finger-graspable`-Rezepte** wurden für die neue Dimension einzeln geprüft.

| Bite Separation | Anzahl | zusätzliche Bite-Capability |
| --- | ---: | --- |
| `low-resistance-separate` | 13 | keine |
| `easy-bite-separate` | 28 | keine |
| `graded-bite-required` | 0 | `graded-bite` nur bei künftig individuell freigegebenem Fall |

Die 13 `low-resistance-separate`-Fälle sind:

- Lachs-Kartoffel-Bällchen
- Rote-Linsen-Gemüsebällchen
- Tofu-Brokkoli-Bällchen
- Brokkoli-Kartoffel-Taler
- Kichererbsen-Kürbis-Taler
- Süßkartoffel-Hirse-Sticks
- Omelettstreifen
- Zucchini-Omelett
- Bangus-Kartoffel-Taler
- Paprika-Omelettstreifen
- Süßkartoffel-Linsen-Taler
- Gebackene Saba-Banane
- Bananen-Ei-Pancakes

Alle übrigen bestehenden zusammenhängenden Fingerfoods sind `easy-bite-separate`.

Wichtig: Der Bestandskatalog bekommt durch die Einführung von `graded-bite` **kein neues zusätzliches Gate**. Die Capability ist vorhanden, damit künftig konkret geprüfte formstabile weiche Servierformen korrekt modelliert werden können.

## 6. Vier bestehende Structured-Chew-Fälle

Die vier bereits freigegebenen `structured-chew`-Rezepte wurden auf Bite Separation **separat** nachgeprüft:

| Rezept | Bite Separation | Oral Processing | Capability |
| --- | --- | --- | --- |
| Rind-Hafer-Bällchen | `easy-bite-separate` | `structured-chew-required` | `structured-chew` |
| Baby-Bananenbrot | `easy-bite-separate` | `structured-chew-required` | `structured-chew` |
| Weiche Joghurt-Fladen | `easy-bite-separate` | `structured-chew-required` | `structured-chew` |
| Huhn-Gemüse-Muffins | `easy-bite-separate` | `structured-chew-required` | `structured-chew` |

Keines dieser vier Rezepte verlangt allein wegen `structured-chew` zusätzlich `graded-bite`.

Das ist ein verbindliches Gegenbeispiel gegen eine lineare Skill-Leiter.

### Safety-Zusatz Baby-Bananenbrot

Das Bananenbrot muss vollständig durchgebacken und vollständig ausgekühlt sein. Die Krume darf nicht klebrig, teigig oder ballend sein. Eine solche Fehlcharge ist ein Safety-Ausschluss und darf nicht durch irgendeine Capability freigeschaltet werden.

## 7. Drei `finger-small-soft`-Fälle

| Rezept | Handling | Bite Separation | Oral | Capability |
| --- | --- | --- | --- | --- |
| Huhn-Zucchini-Nockerl | `finger-small-soft` | nicht anwendbar | `soft-breakdown` | `small-soft-pieces` |
| Rind-Karotten-Nockerl | `finger-small-soft` | nicht anwendbar | `soft-breakdown` | `small-soft-pieces` |
| Linsen-Süßkartoffel-Nockerl | `finger-small-soft` | nicht anwendbar | `soft-breakdown` | `small-soft-pieces` |

Die kanonische Form bleibt bewusst **kleine einzelne, längliche, sehr weiche Nockerl**. Der spätere Grund ist Aufnehmen/Selbstfüttern, nicht Bite Separation oder Structured Chew.

## 8. Hummus mit weichen Gemüsesticks

„Weich“ ist eine **mechanische Eigenschaft**, keine Zubereitungsmethode.

Für die kanonische Stickform gilt deshalb:

- in der tatsächlich angebotenen Form mechanisch weich;
- sicher greifbar;
- keine harten, zähen oder spröden Bissen;
- roh **oder** gegart möglich, sofern die konkrete Form diese Kriterien erfüllt.

Eine rohe und eine gegarte Form dürfen nicht allein aufgrund der Zubereitungsart unterschiedlich eingestuft werden; entscheidend ist das reale mechanische Verhalten.

## 9. Mischtexturen und weitere mögliche Fähigkeiten

Für Mischtexturen wird derzeit **keine** eigene harte Capability eingeführt.

`spoon-soft-lumpy`, tatsächliche Partikel-/Mischstruktur und das Oral-Profil reichen im aktuellen Katalog aus. Zungenlateralisierung bleibt ein Review-Kriterium, aber kein eigenes Nutzer-Boolean.

Ebenso wird keine zusätzliche orale `small-piece`-Capability eingeführt.

## 10. Alters- und Zahnsemantik

- `minMonths` bleibt eine weiche Altersorientierung.
- `hardMinMonths` bleibt echten unabhängigen Alters-/Safety-Gründen vorbehalten.
- Eine höhere Quellenaltersangabe ist Review-Signal, kein automatisches Gate.
- Bite-/Oral-Capabilities werden nur aus beobachtbaren Fähigkeiten bestätigt.
- **Zahl oder Vorhandensein von Zähnen ist kein Capability-Gate.**

## 11. Technischer Contract

Beispiel ohne zusätzliche Capability:

```js
{
  modes: ["finger-graspable"],
  biteSeparation: "easy-bite-separate",
  oralProcessing: "easy-chew"
}
```

Beispiel mit Bite-Capability:

```js
{
  modes: ["finger-graspable"],
  biteSeparation: "graded-bite-required",
  biteRequiredCapability: "graded-bite",
  oralProcessing: "easy-chew"
}
```

Beispiel mit Structured Chew:

```js
{
  modes: ["finger-graspable"],
  biteSeparation: "easy-bite-separate",
  oralProcessing: "structured-chew-required",
  oralRequiredCapability: "structured-chew"
}
```

Die Fähigkeiten werden unabhängig gespeichert:

```js
handlingCapabilities: {
  smallSoftPieces: false,
  gradedBite: false,
  structuredChew: false
}
```

Fehlende Altwerte werden konservativ als `false` normalisiert. Keine Fähigkeit wird aus Alter, `textureStage`, Rezeptkategorie, Feeding-Präferenz oder einer anderen Fähigkeit abgeleitet.
