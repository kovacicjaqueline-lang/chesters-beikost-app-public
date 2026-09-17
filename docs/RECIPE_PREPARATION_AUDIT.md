# Rezept-Zubereitungs-Audit 2026-09-17

Geprüfter Ausgangsstand: `de6babd3a8b0e63a1fb9fe934e8bbce0b1dc9b15` (`main`).

Gegenstand: alle 123 Laufzeitrezepte nach Installation der Runtime-Ergänzungen in `js/recipes.js`.

## Ergebnis

- 20 Zubereitungstexte waren klar unvollständig: wesentliche Zutatenverarbeitung oder das Zusammenführen der Rezeptbestandteile fehlte.
- 23 weitere Zubereitungstexte waren fachlich erkennbar, aber für eine reproduzierbare Zubereitung zu knapp.
- `Monggo-Kalabasa-Brei` enthielt zusätzlich eine Freigabe-Inkonsistenz: Malunggay wurde in der Zubereitung als optionale Ergänzung erwähnt, obwohl es weder Bestandteil von `requires` noch eine deklarierte Rezeptoption war.
- Der separate Draft-PR #180 zur Baby-Linsen-Bolognese wurde nicht übernommen. Seine Änderung wurde nur gegen den aktuellen `main` gegengeprüft; die vollständige Korrektur ist Bestandteil dieses Audits.
- Die 21 Runtime-Ergänzungen aus `RECIPE_CATALOG_ADDITIONS` sowie die drei Runtime-Nockerlvarianten waren bereits ausreichend vollständig und wurden nicht unnötig umgeschrieben.

## Klar unvollständig (20)

Birne-Hirse-Pancakes; Rind-Hafer-Bällchen; Geflügel-Gemüse-Hafer-Bällchen; Rote-Linsen-Gemüsebällchen; Tofu-Brokkoli-Bällchen; Zucchini-Hafer-Puffer; Polenta-Zucchini-Sticks; Zucchini-Omelett; Kürbis-Hafer-Brei; Gemüse-Nudel-Sauce; Baby-Linsen-Bolognese; Bangus-Kartoffel-Taler; Obst-Hafer-Muffins; Gemüse-Hafer-Muffins; Kürbis-Hirse-Muffins; Bananen-Haferbrei mit Erdnussmus; Karotten-Hirse-Brei mit Tahin; Apfel-Hirse-Brei mit Mandelmus; Paprika-Omelettstreifen; Ei-Champignon-Cups.

## Zu knapp (23)

Zucchini-Hafer-Pancakes; Ube-Bananen-Pancakes; Lachs-Kartoffel-Bällchen; Brokkoli-Kartoffel-Taler; Kichererbsen-Kürbis-Taler; Rote-Linsen-Bratlinge; Süßkartoffel-Hirse-Sticks; Omelettstreifen; Obst-Hirsebrei; Obst-Polentabrei; Obst-Reisbrei; Obst-Buchweizenbrei; Obst-Grießbrei; Lugaw-Basis; Kürbis-Lugaw; Tinola-inspiriert; Arroz-caldo-inspiriert; Kalabasa mit Kokos; Tilapia-Reis-Brei; Kürbis-Linsen-Suppe; Mildes Rote-Linsen-Dhal; Huhn-Karotte-Nudel-Topf; Huhn-Lauch-Kartoffel-Topf.

## Änderungsgrenze

Mengenangaben, `stage`, `minMonths`, `hardMinMonths`, `skillRequirement`, `requires`, `oneOf`, `alternatives`, Milch-/Allergenlogik und Rezeptauswahl bleiben unverändert. Geändert werden ausschließlich Zubereitungstexte und die nicht deklarierte Malunggay-Erwähnung.
