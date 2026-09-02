# Lebensmittelstatus + Vorlieben

Stand: 02.09.2026

Dieses Dokument ist für Lebensmittelstatus und Vorlieben die fachliche Referenz. Es ersetzt insoweit ältere Statusschwellen und Bezeichnungen im Planner-Fachkonzept; die dort dokumentierten strengeren Allergenregeln bleiben davon unberührt.

## Statusmodell

Der Lebensmittelstatus hat genau diese fachlichen Zustände:

`Offen → Probiert → Bekannt`

Zusätzlich existiert `Pausiert` als Sonderstatus.

- `Offen`: noch kein positiver Kontakt protokolliert.
- `Probiert`: mindestens eine positive Exposition (`Probiert` oder `Gegessen`), aber noch keine zwei getrennten `Gegessen`-Expositionen.
- `Bekannt`: mindestens zwei getrennte `Gegessen`-Expositionen.
- `Pausiert`: Sonderstatus, insbesondere nach dokumentierter Reaktion bzw. manueller Pause.

`Regelmäßig` entfällt vollständig. Frühere Werte `Vertragen`, `Verträgliche Basis` und `Regelmäßig` werden bei der Migration kompatibel als `Bekannt` übernommen.

`Probiert` und `Gegessen` bleiben Log-Ereignisse und werden nicht zu zusätzlichen Statusstufen. Mehrfaches `Probiert` darf als Erfahrung gezählt und angezeigt werden, führt aber nicht automatisch zu `Bekannt`. Drei oder mehr `Gegessen`-Expositionen erzeugen keinen weiteren Status. Für den Status gibt es kein Datums- oder Recency-Kriterium.

## Planner-Vertrag

Für Nicht-Allergene gilt:

- Ein nur probiertes Lebensmittel blockiert keine neue geeignete Einführung.
- `Probiert` allein erzeugt keine Pflicht-Wiederholung.
- Eine echte Ablehnung kann weiterhin eine gezielte Wiederholung auslösen.
- Ab mindestens einer getrennten `Gegessen`-Exposition darf ein Lebensmittel als bekannte Komponente verwendet werden.
- Erst `Bekannt` qualifiziert es nach den übrigen bestehenden Gates als bekannte Hauptbasis.
- Die strengere bestehende Allergenlogik wird nicht aus diesen allgemeinen Schwellen neu abgeleitet oder gelockert.

## Vorliebe

Jedes Lebensmittel kann unabhängig vom Status manuell mit `❤️ Wird gern gegessen` markiert werden.

- `liked = true` bedeutet positive Vorliebe.
- Nicht markiert bzw. `liked = false` ist neutral.
- Es gibt keinen negativen Status „mag er nicht“.
- Die Vorliebe verändert den Lebensmittelstatus nicht.

Der Planner darf die positive Vorliebe ausschließlich als nachgelagerten Tie-Breaker für geeignete bekannte Basen oder Begleiter verwenden. Bestehende Eignung, Abwechslung, neue Lebensmittel, sinnvolle Wiederholungen, Vorratslogik und Safety-/Allergenregeln haben Vorrang.

Es gibt keine starre „10-mal anbieten“-Regel. Wiederholtes Anbieten ist weder Zwang noch automatisch ein negatives Urteil über das Lebensmittel.

## Persistenz und Backups

Die Vorliebe wird als optionales boolesches Feld `liked` am bestehenden FOOD-Datensatz gespeichert. Alte Daten ohne dieses Feld bleiben neutral. Bestehende Logs werden nicht umgeschrieben; alte manuelle Statusbezeichnungen werden beim Laden auf das neue Statusmodell normalisiert.
