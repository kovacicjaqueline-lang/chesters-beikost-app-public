# FOOD Handling – Oral-Processing-Rezeptreview

Stand: 2026-08-20  
Basis-main bei technischer Übernahme: `a26d3159bdb2ecc7713341270400fcc0f599549d`  
Verbindliche Fachreferenz: `docs/FOOD_HANDLING_ORAL_PROCESSING_CONTRACT.md`

## Zweck

Dieses Dokument hält die rezeptweise Prüfung der neuen oralen Verarbeitungsdimension fest.

Die Einstufung erfolgt **je konkretem Rezept und je konkret freigegebener Servierform**. Es wird keine Gruppenfreigabe aus Kategorien wie Pancake, Muffin, Bällchen, Waffel, Brot oder Fleisch abgeleitet.

Die orale Einstufung verändert keine unabhängigen Safety-, Zutaten-, Allergen-, Alters-, Mahlzeiten- oder Planner-Gates. Ein oral klar klassifiziertes Rezept kann daher aus einem anderen Grund weiterhin nicht migrationsreif sein.

## Technische Abbildung dieser Review-Welle

Die 30 klaren Einzelentscheidungen werden in `data/food-handling.js` als eigener `RECIPE_ORAL_PROCESSING_CONTRACT` abgebildet.

Diese Trennung ist absichtlich orthogonal:

- `RECIPE_HANDLING_CONTRACT` entscheidet weiterhin, ob ein Rezept handlingseitig aus dem konservativen Legacy-Stage-Fallback migriert ist;
- `RECIPE_ORAL_PROCESSING_CONTRACT` dokumentiert ausschließlich das fachlich bestätigte orale Profil plus die dafür geltende Servier-/Texturbedingung;
- ein Eintrag im Oral-Contract allein darf daher **keine** Stage-, Safety-, Alters- oder Planner-Sperre entfernen;
- `structured-chew-required` ist als Profil definiert, wird in dieser Welle aber keinem Rezept zugeordnet;
- es wird keine neue orale Capability eingeführt.

Damit können z. B. Lachs- oder Bangus-Taler oral als `soft-breakdown` dokumentiert sein, ohne dadurch automatisch handlingseitig migriert oder früher freigeschaltet zu werden.

Die Runtime stellt die orale Dimension additiv an den Rezeptzuständen bereit:

```js
{
  oralProcessing: "soft-breakdown" | "easy-bite-separate" | "",
  oralServingRequirement: "..."
}
```

Diese Felder sind **Metadaten**. Sie werden auch bei einem oral klassifizierten, aber noch nicht handlingseitig migrierten Rezept ausgegeben. In diesem Fall bleiben `handlingMigrated: false`, die bestehenden `requirementMissing`-Einträge sowie `unlocked` unverändert.

Die konkreten freigegebenen Servier-/Texturbedingungen liegen damit strukturiert vor und müssen nicht aus `note` oder `skillRequirement` geparst werden. Die bestehenden Rezept-`note`-Texte werden in dieser Wave nicht als Steuerlogik umgeschrieben; offene Rezepturen bleiben bewusst unverändert.

## Fachlich klare Einzelentscheidungen

| Rezept | Orales Profil | Verbindliche Form-/Texturbedingung |
|---|---|---|
| Obst-Hafer-Pancakes | `easy-bite-separate` | klein/flach, vollständig aber weich gegart, keine harte/stark gebräunte Kruste |
| Birne-Hirse-Pancakes | `easy-bite-separate` | klein/flach, weich durchgegart, keine harte/trockene Kruste |
| Gemüse-Hafer-Pancakes | `easy-bite-separate` | klein/flach, vollständig aber weich gegart, keine harte Kruste |
| Zucchini-Hafer-Pancakes | `easy-bite-separate` | dünn, weich, vollständig durchgegart; keine harte/trockene Kruste |
| Ube-Bananen-Pancakes | `easy-bite-separate` | Ube vollständig weich gegart, Pancake weich durchgegart; keine harte/trockene Kruste |
| Rind-Hafer-Bällchen | `easy-bite-separate` | separat freigegebene sehr weiche, flache/längliche Form; keine feste runde Kugel, keine harte Kruste |
| Geflügel-Gemüse-Hafer-Bällchen | `easy-bite-separate` | flach/länglich, vollständig durchgegart, weich/saftig, keine harte Kruste; leicht auseinanderteilbar; abgetrennter Bissen nicht federnd/gummiartig/kompakt-elastisch |
| Lachs-Kartoffel-Bällchen | `soft-breakdown` | vollständig gegarter, grätenfreier Lachs mit weicher Kartoffel zerdrückt, flach und weich |
| Rote-Linsen-Gemüsebällchen | `soft-breakdown` | sehr weiche Linsen + weiches Gemüse/Püree, flach, weich/saftig, nicht trocken |
| Tofu-Brokkoli-Bällchen | `soft-breakdown` | Naturtofu + sehr weicher Brokkoli fein zerdrückt, flach und weich |
| Brokkoli-Kartoffel-Taler | `soft-breakdown` | sehr weicher Brokkoli + Kartoffel zerdrückt, flach, nur weich erhitzt/gebacken |
| Zucchini-Hafer-Puffer | `easy-bite-separate` | dünn, weich, vollständig durchgegart, keine knusprige harte Kante |
| Kichererbsen-Kürbis-Taler | `soft-breakdown` | Kichererbsen sehr weich/fein zerdrückt, Kürbispüree, flach/weich; Binder nur sparsam |
| Rote-Linsen-Bratlinge | `soft-breakdown` | sehr weich gekochte Linsen, flach, weich und saftig statt trocken |
| Polenta-Zucchini-Sticks | `soft-breakdown` | dicke weiche Polenta + weiche Zucchini, breite greifbare Sticks, keine harte/trockene Kruste |
| Omelettstreifen | `easy-bite-separate` | verbindlicher Referenzfall: vollständig durchgegart, weich, breite gut greifbare Streifen |
| Zucchini-Omelett | `easy-bite-separate` | gilt für breite, weich gehaltene, gut greifbare Streifen; kleine Stücke separate Handlingfrage |
| Bangus-Kartoffel-Taler | `soft-breakdown` | weiche zerdrückte Fisch-Kartoffel-Masse; separate Entgrätungs-Safety bleibt vollständig bestehen |
| Kichererbsenmehl-Zucchini-Taler | `easy-bite-separate` | kleiner flacher Taler, vollständig durchgegart, weich; nicht trocken/knusprig |
| Eier-Finger | `easy-bite-separate` | vollständig gegartes Ei, länglich/gut greifbar, weich; nicht trocken/gummiartig übergaren |
| Paprika-Omelettstreifen | `easy-bite-separate` | Paprika sehr fein/weich, Omelett vollständig durchgegart/weich, breite greifbare Streifen |
| Ei-Champignon-Cups | `easy-bite-separate` | weich gebacken, nicht gummiartig, zum Servieren breit/länglich und gut greifbar schneiden |
| Buchweizen-Bananen-Pancakes | `easy-bite-separate` | kleiner weicher Pancake, vollständig durchgegart; keine harte/trockene Kruste |
| Süßkartoffel-Linsen-Taler | `soft-breakdown` | Süßkartoffel + sehr weiche rote Linsen zerdrückt, flach, vollständig gegart und weich |
| Gebackene Saba-Banane | `soft-breakdown` | reife Saba vollständig weich gebacken/gedämpft, gut greifbare weiche Stücke |
| Bananen-Joghurt-Hafer-Pancakes | `easy-bite-separate` | klein/flach, niedrige Hitze, vollständig durchgegart und weich |
| Obst-Joghurt-Hafer-Ofenbites | `easy-bite-separate` | flach/weich backen, nicht austrocknen, gut greifbar schneiden |
| Zucchini-Joghurt-Hafer-Bites | `easy-bite-separate` | flach/weich vollständig backen, keine harte Kruste, gut greifbar |
| Joghurt-Hafer-Waffeln | `easy-bite-separate` | nur hell/weich ausbacken, harte Kanten entfernen, breit/gut greifbar schneiden |
| Weiche Joghurt-Fladen | `easy-bite-separate` | klein/flach, vollständig aber weich gebacken, keine harte/dunkle Kruste, nicht trocken/zäh |

## Bewusst weiterhin offene Oral-Fälle

Diese Rezepte werden nicht vorsorglich zugeordnet:

| Rezept | Grund für Offenheit |
|---|---|
| Süßkartoffel-Hirse-Sticks | kann je nach Verhältnis locker zerfallend oder dicht/klebrig werden; „Konsistenz prüfen“ nicht reproduzierbar genug |
| Baby-Bananenbrot | Krume kann je nach Mehlmenge/Backergebnis locker oder dicht, klebrig beziehungsweise elastisch werden |
| Obst-Hafer-Muffins | saftig + Zwei-Finger-Test bestimmt den abgetrennten Bissen nicht ausreichend |
| Gemüse-Hafer-Muffins | Krume/Elastizität hängt stark von Gemüsevariante und Verhältnis ab |
| Kürbis-Hirse-Muffins | tatsächliche Krume aus Rezeptur noch nicht reproduzierbar genug ableitbar |
| Gemüse-Joghurt-Mini-Muffins | mögliche dichte/gummiartige Krume und Geometrie unzureichend bestimmt |
| Huhn-Gemüse-Muffins | Huhn kann die gebackene Struktur zusätzlich verändern |
| Süßkartoffel-Linsen-Muffins | feuchter Teig garantiert ohne konkrete Mengen/Servierform noch kein `soft-breakdown` |
| Fleisch-Gemüse-Bällchen | Varianten/Mengenverhältnisse schließen kompakt-elastisches Verhalten noch nicht sicher aus |
| Gemüse-Fleisch-Nockerl | gekochte Weizen-/Grießstruktur kann trotz Weichheit elastisch/gummiartig bleiben; starker Prüffall für `structured-chew-required` |

## Bewusst keine einheitliche Oral-Klassifikation

### Hummus mit weichen Gemüsesticks

Dip und Gemüsestick bleiben zwei unterschiedliche Komponenten. Das Profil des Sticks hängt vom konkreten Gemüse und seiner konkreten Zubereitung ab. Es wird keine gemeinsame orale Stufe erfunden.

## Separate Identitätsauffälligkeit

`Bananen-Ei-Pancakes` besitzt bereits einen eigenen Handling-Contract und wird im Browserkatalog separat ergänzt, war aber nicht Teil des 100-Rezepte-Audits dieser Review-Welle. Deshalb wird in dieser Welle **keine orale Einstufung aus dem Namen oder dem bestehenden Handling-Eintrag abgeleitet**.

## Status

Fachlich freigegebene und technisch abgebildete Oral-Processing-Wave: **30 klare Einzelentscheidungen**.

Technischer Stand auf dem Arbeitsbranch:

1. 20 × `easy-bite-separate`.
2. 10 × `soft-breakdown`.
3. 0 × `structured-chew-required`.
4. keine neue orale Capability.
5. offene Fälle bleiben ohne Oral-Eintrag.
6. Oral-Eintrag allein verändert keine Handling-/Legacy-Eligibility.
7. `recipeStates()` stellt `oralProcessing` und `oralServingRequirement` additiv bereit.
8. Regressionen sichern sowohl die exakten 30 Zuordnungen als auch die Nicht-Freischaltung oral-only klassifizierter Legacy-/Safety-Fälle ab.
9. Die bestehende Handling-Loaderkette und der Offline-Precache bleiben unverändert.
