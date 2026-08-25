# FOOD-V2 High-Res-Asset-Audit

*Gezielter Validierungs- und Korrekturbericht · 25. August 2026*

**Kernaussage: Die Zahl von 198 aktuellen FOOD-IDs stimmt. Die bisherige High-Res-Logik stimmt dagegen nicht auf Motivebene: große Sammel-PNGs liefern überwiegend nur DPR1 oder eine technisch unklare Basis, nicht automatisch eine Detailquelle für 96 px bei DPR3.**

Bewertet wurde ausschließlich echte vorhandene Pixelinformation. Kein Upscaling, keine Interpolation und keine künstliche Schärfung wurden berücksichtigt. *Bei den mit Stern markierten Sammel-PNGs existiert zwar ein Alphakanal, die Fläche zwischen den Motiven bleibt visuell ein eingebrannter/semiflüssiger Hintergrund; sie ist keine nutzbare freigestellte Einzelquelle.

## A) Repository-Abgleich

| Prüfpunkt | Ergebnis |
| --- | --- |
| Remote-main | 1ef50c344dc8a120a4eb686de02369c5092ba147 |
| Letzter Commit | 25.08.2026, 12:29 CEST · fix: publish centered high-resolution cow milk icon |
| App-Version | 10.1.26 |
| Aktuelle FOOD-IDs | 198 aus data/foods.js |
| Abweichung zum bestehenden Audit | Keine bei der Gesamtzahl; die 198 sind bestätigt. |

## B) Gefundene Auditfehler

| Typ | FOOD / Quelle | Bisher | Korrigiert | Begründung |
| --- | --- | --- | --- | --- |
| Mapping-Lücke | ei · image-gen-1(20260818-120950).png R5C1 | UNKLAR; keine Quelle | Sammelquelle, DETAIL_DPR1, Sicherheit hoch | Inventur nennt ausdrücklich Ei mit hoher Sicherheit; das Mapping ließ es trotzdem aus. |
| Quelltyp | erbsen-tk-moeglich · image-gen-1(20260810-180935).png | Sammel-PNG | Einzelquelle, 1024×1024, DETAIL_DPR3_PLUS | Die Inventur beschreibt eine Einzelquelle. Die lokale Datei bestätigt ein Einzelmotiv mit Alpha-BBox 781×578 px. |
| Auflösungslogik | alle verwendeten Sammelquellen | globales PNG als High-Res = JA | nur motivbezogene Klasse; keine Sammelquelle erreicht gesichert DPR3 | 1536×1024 bzw. 1254×1254 verteilt sich auf 5×2, 5×5, 6×5 oder 8×8 Motive. |
| Inventurmetadaten | image-gen-1(20260810-214808).png | „hochauflösend“, Pixelzahl nicht separat verifiziert | 1536×1024, 8×8, Feldobergrenze 192×128 | Die Datei ist konkret messbar; die Obergrenze schließt DPR2 bereits aus. |
| Transparenz | R04 Baby-Food-Icon-Set Vega.png | Transparenz: nein | echte Transparenz vorhanden | RGBA-Datei mit großen Alpha-0-Flächen; die Hauptmotive sind freigestellt. |
| Sicherheitsstufe | pecannuss / paranuss / macadamia | Mapping: mittel | hoch | Die zugehörigen Inventurzeilen R2C3–R2C5 bewerten alle drei mit hoch. |
| Sicherheitsstufe | endivie | Mapping: hoch | mittel | Die zugehörige Inventurzeile R4C2 bewertet Endivie mit mittel. |
| Sicherheitsstufe | rettich | Mapping: mittel | hoch | Die zugehörige Inventurzeile R4C5 bewertet Rettich mit hoch. |

## C) Technisch verwertbare Quellen

Die Tabelle bündelt FOODs mit identischem technischen Befund. Jede Zeile enthält die konkreten FOOD-IDs und Bezeichnungen; die Sortierung folgt der verlangten Detailklasse.

| FOOD-ID · Lebensmittel | Bevorzugte Quelle | Typ | Effektive Motivauflösung | Transparenz | Detailklasse | Zuordnung |
| --- | --- | --- | --- | --- | --- | --- |
| erbsen-tk-moeglich — Erbsen (TK möglich) | image-gen-1(20260810-180935).png | Einzel | Alpha-BBox 781×578 px | ja | DETAIL_DPR3_PLUS | erbsen-tk-moeglich: hoch |
| nektarine — Nektarine | image-gen-1(20260818-102321).png | Einzel | ca. 800–1000 px je Achse (Motiv füllt die Einzelquelle) | nein | DETAIL_DPR3_PLUS | nektarine: hoch |
| spargel — Spargel | image-gen-1(20260818-141814).png | Einzel | Alpha-BBox 1171×1157 px | ja | DETAIL_DPR3_PLUS | spargel: hoch |
| brombeere — Brombeere | image-gen-2(20260818-102324).png | Einzel | ca. 800–1000 px je Achse | nein | DETAIL_DPR3_PLUS | brombeere: hoch |
| petersilienwurzel — Petersilienwurzel | image-gen-2(20260818-141817).png | Einzel | Alpha-BBox 1235×1187 px | ja | DETAIL_DPR3_PLUS | petersilienwurzel: hoch |
| mangold — Mangold | image-gen-3(20260818-102328).png | Einzel | ca. 800–1000 px je Achse | nein | DETAIL_DPR3_PLUS | mangold: hoch |
| rhabarber — Rhabarber | image-gen-3(20260818-141821).png | Einzel | Alpha-BBox 1197×1207 px | ja | DETAIL_DPR3_PLUS | rhabarber: hoch |
| miesmuschel — Miesmuschel | image-gen-4(20260818-102331).png | Einzel | ca. 800–1000 px je Achse | nein | DETAIL_DPR3_PLUS | miesmuschel: hoch |
| tempeh — Tempeh | image-gen-5(20260818-102335).png | Einzel | ca. 800–1000 px je Achse | nein | DETAIL_DPR3_PLUS | tempeh: hoch |
| apfel — Apfel<br>avocado — Avocado<br>banane — Banane<br>birne — Birne<br>brokkoli — Brokkoli<br>karotte — Karotte<br>kartoffel — Kartoffel<br>suesskartoffel — Süßkartoffel<br>zucchini — Zucchini | R04 Baby-Food-Icon-Set Vega.png | Sammel | Hauptmotiv ca. 200–260×210–310 px | ja | DETAIL_DPR2 | apfel: hoch<br>avocado: hoch<br>banane: hoch<br>birne: hoch<br>brokkoli: hoch<br>karotte: hoch<br>kartoffel: hoch<br>suesskartoffel: hoch<br>zucchini: hoch |
| kren — Kren<br>lupine — Lupine<br>macadamia — Macadamia<br>paranuss — Paranuss<br>pecannuss — Pecannuss<br>sojaoel — Sojaöl<br>walnussoel — Walnussöl<br>weizenkeimoel — Weizenkeimöl | Hochwertiges Lebensmittel-Icon-Set auf transparentem Hintergrund.png | Sammel | Motiv ca. 160–270×130–190 px | praktisch nein* | DETAIL_DPR1 | kren: hoch<br>lupine: hoch<br>macadamia: hoch<br>paranuss: hoch<br>pecannuss: hoch<br>sojaoel: hoch<br>walnussoel: hoch<br>weizenkeimoel: hoch |
| brot — Brot<br>rettich — Rettich<br>soja-tofu — Tofu | Realistisches Zutaten-Stickerblatt mit Lebensmitteln.png | Sammel | Motiv ca. 150–230×120–185 px | praktisch nein* | DETAIL_DPR1 | brot: mittel<br>rettich: hoch<br>soja-tofu: mittel |
| blattsalat — Blattsalat<br>braune-gruene-linse — Braune Linse<br>bulgur — Bulgur<br>chinakohl — Chinakohl<br>ei — Ei<br>endivie — Endivie<br>feige — Feige<br>holunder — Holunderbeere<br>kaeferbohne — Käferbohne<br>kidneybohne — Kidneybohne<br>mohn — Mohn<br>preiselbeere — Preiselbeere<br>quitte — Quitte<br>radicchio — Radicchio<br>ribisel — Ribisel<br>rucola — Rucola<br>schnittlauch — Schnittlauch<br>weizengriess — Weizengrieß | image-gen-1(20260818-120950).png | Sammel | Motiv ca. 150–240×120–190 px | praktisch nein* | DETAIL_DPR1 | blattsalat: hoch<br>braune-gruene-linse: mittel<br>bulgur: mittel<br>chinakohl: hoch<br>ei: hoch<br>endivie: mittel<br>feige: hoch<br>holunder: hoch<br>kaeferbohne: hoch<br>kidneybohne: hoch<br>mohn: hoch<br>preiselbeere: hoch<br>quitte: hoch<br>radicchio: hoch<br>ribisel: hoch<br>rucola: hoch<br>schnittlauch: hoch<br>weizengriess: mittel |

## D) Noch offene Fälle

| FOOD-ID · Lebensmittel | Ursache | Vorhandene mögliche Quelle | Was zur Klärung fehlt |
| --- | --- | --- | --- |
| amaranth — Amaranth<br>buchweizen — Buchweizen<br>caimito-sternapfel — Caimito (Sternapfel)<br>calamansi — Calamansi<br>cassava-kamoting-kahoy — Cassava<br>chico-sapodilla — Chico (Sapodilla)<br>drachenfrucht — Drachenfrucht<br>gabi-taro — Gabi<br>gelbe-linsen — Gelbe Linsen<br>gerste — Gerste<br>granatapfel — Granatapfel<br>guave — Guave<br>guyabano-soursop — Guyabano (Soursop)<br>haselnuss — Haselnuss<br>jackfruit-langka — Jackfruit<br>kaki — Kaki<br>kamote-blaetter — Kamote-Blätter<br>kangkong-wasserspinat — Kangkong (Wasserspinat)<br>kohlrabi — Kohlrabi<br>koriandergruen — Koriandergrün<br>kuhmilch — Kuhmilch<br>kurkuma — Kurkuma<br>lamm — Lamm<br>lanzones — Lanzones<br>majoran — Majoran<br>malunggay-moringablaetter — Malunggay (Moringablätter)<br>maroni — Maroni<br>mungbohne — Mungbohne<br>okra — Okra<br>oregano — Oregano<br>pak-choi — Pak Choi<br>papaya — Papaya<br>patola-ridge-gourd — Patola (Ridge Gourd)<br>pistazie — Pistazie<br>pomelo — Pomelo<br>rambutan — Rambutan<br>rimas-brotfrucht — Rimas (Brotfrucht)<br>roggen — Roggen<br>rosenkohl — Rosenkohl<br>rosmarin — Rosmarin<br>rotkraut — Rotkraut<br>saba-banane — Saba-Banane<br>saluyot-juteblaetter — Saluyot (Juteblätter)<br>sayote-chayote — Sayote (Chayote)<br>schwarze-bohnen — Schwarze Bohnen<br>schwarze-linsen — Schwarze Linsen<br>schwarzwurzel — Schwarzwurzel<br>sellerie — Knollensellerie<br>sitaw-lange-bohnen — Sitaw (lange Bohnen)<br>stangensellerie — Stangensellerie<br>steckruebe — Steckrübe<br>thymian — Thymian<br>topinambur — Topinambur<br>ube-violette-yamswurzel — Ube (violette Yamswurzel)<br>upo-flaschenkuerbis — Upo (Flaschenkürbis)<br>vanille — Vanille<br>weisse-bohnen — Weiße Bohnen<br>weisskraut — Weißkraut<br>wirsing — Wirsing | AUFLOESUNG_UNKLAR | image-gen-1(20260810-214808).png | Je Lebensmittel eine belastbare Motiv-BBox/Crop-Messung; das 8×8-Raster liefert höchstens 192×128 pro Feld. |
| kabeljau — Kabeljau<br>seelachs — Seelachs<br>forelle — Forelle<br>pfirsich — Pfirsich<br>buttermilch — Buttermilch<br>bangus-milkfish — Bangus (Milkfish)<br>sardine — Sardine | MOTIV_IDENTITAET_UNKLAR | siehe mögliche Quelle je FOOD | Art/Produkt per beschrifteter oder eindeutig einzelner Referenz bestätigen; bei Fisch nicht aus dem Bild raten. |
| spinat — Spinat | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Blattgemüse). |
| kokosoel — Kokosöl<br>olivenoel — Olivenöl<br>rapsoel — Rapsöl | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Fett). |
| galunggong-round-scad — Galunggong (Round Scad)<br>lachs — Lachs<br>thunfisch — Thunfisch<br>tilapia — Tilapia | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Fisch). |
| huhn — Huhn<br>pute — Pute<br>rind — Rind<br>schwein — Schwein | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Fleisch). |
| aubergine — Aubergine<br>champignon — Champignon<br>fenchel — Fenchel<br>gruene-bohnen — Grüne Bohnen (Fisolen)<br>gurke — Gurke<br>karfiol — Karfiol<br>kuerbis — Kürbis<br>lauch — Lauch<br>paprika — Paprika<br>tomate — Tomate | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Gemüse). |
| couscous — Couscous<br>dinkel — Dinkel<br>hafer — Hafer<br>haferdrink — Haferdrink<br>hirse — Hirse<br>mais-polenta — Mais<br>nudeln-pasta — Nudeln<br>polenta — Polenta<br>quinoa — Quinoa<br>reis — Reis<br>weizen — Weizen | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Getreide/Stärke). |
| kichererbse — Kichererbse<br>rote-linsen — Rote Linsen<br>sojabohne — Sojabohne<br>sojajoghurt — Sojajoghurt | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Hülsenfrucht). |
| basilikum — Basilikum<br>dill — Dill<br>ingwer — Ingwer<br>petersilie — Petersilie<br>zimt — Zimt | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Kraut/Gewürz). |
| garnele — Garnele | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Meeresfrucht). |
| butter — Butter<br>frischkaese — Frischkäse<br>kaese — Käse<br>kefir — Kefir<br>mozzarella — Mozzarella<br>naturjoghurt — Naturjoghurt<br>quark — Quark<br>skyr — Skyr | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Milchprodukt). |
| cashew — Cashew<br>erdnuss — Erdnuss<br>mandel — Mandel<br>walnuss — Walnuss | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Nuss). |
| ananas — Ananas<br>aprikose — Aprikose<br>dattel — Dattel<br>erdbeere — Erdbeere<br>heidelbeere — Heidelbeere<br>himbeere — Himbeere<br>kirsche — Kirsche<br>kiwi — Kiwi<br>mandarine — Mandarine<br>mango — Mango<br>melone — Melone<br>orange — Orange<br>pflaume — Pflaume<br>rosine — Rosine<br>traube — Traube<br>wassermelone — Wassermelone<br>zitrone — Zitrone | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Obst). |
| kokos — Kokos | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Obst/Fett). |
| chiasamen — Chiasamen<br>kuerbiskerne — Kürbiskerne<br>leinsamen — Leinsamen<br>senf — Senf<br>sesam — Sesam<br>sonnenblumenkerne — Sonnenblumenkerne<br>tahin — Tahin | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Samen). |
| kakao — Kakao<br>knoblauch — Knoblauch<br>zwiebel — Zwiebel | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Sonstiges). |
| pastinake — Pastinake<br>rote-ruebe — Rote Rübe | QUELLE_NICHT_BELEGT | — | Neue passende Einzelquelle oder dokumentierte geeignete Sammelquelle beschaffen (Wurzel/Knolle). |

## E) Statistik

| Kennzahl | Wert | Einordnung |
| --- | --- | --- |
| Aktuelle FOOD-Anzahl | 198 | Remote-main bestätigt |
| DETAIL_DPR3_PLUS | 9 | 9 Einzelquellen · sofort verwendbar |
| DETAIL_DPR2 | 9 | 9 Sammelquellen · R04 5×2 |
| DETAIL_DPR1 | 29 | 29 Sammelquellen · technisch 96-px-tauglich, aber nicht Retina/DPR3 |
| ZU_KLEIN | 0 | kein Fall nach belastbarer Einzelfallmessung belegt |
| UNKLAR | 151 | 59 Auflösung unklar · 7 Identität unklar · 85 Quelle nicht belegt |
| davon Einzelquellen | 9 | alle DETAIL_DPR3_PLUS |
| davon Sammelquellen | 97 | 9 DPR2 + 29 DPR1 + 59 Auflösung unklar |

## F) Umsetzungspriorität

| Gruppe | Umfang | Entscheidung |
| --- | --- | --- |
| SOFORT VERWENDBAR | 9 FOODs | Die neun bestätigten Einzelquellen mit DETAIL_DPR3_PLUS: Erbsen (TK möglich), Nektarine, Brombeere, Mangold, Miesmuschel, Tempeh, Spargel, Petersilienwurzel und Rhabarber. |
| BEDINGT VERWENDBAR | 91 FOODs | 9 DETAIL_DPR2 + 23 eindeutig zugeordnete DETAIL_DPR1 + 59 mit Auflösungsunschärfe. DPR1/DPR2 nur einsetzen, wenn die geringere Detailreserve akzeptiert wird; die 8×8-Quelle vorher pro Motiv messen. |
| NEUE / ANDERE QUELLE NÖTIG | 98 FOODs | 85 ohne belegte Quelle sowie 13 mit nicht belastbarer Motividentität (6 bei DPR1, 7 weitere Kandidaten). Für diese FOODs keine Zuordnung durch optische Vermutung erzwingen. |

*Methodische Grenze: Dieser Korrekturdurchgang bewertet ausschließlich die im bestehenden Audit referenzierten Library-Dateien und den aktuellen PUBLIC-Repository-Stamm. Er erzeugt keine Assets und verändert das Repository nicht.*
