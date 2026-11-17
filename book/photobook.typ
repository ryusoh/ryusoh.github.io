// Canonical Typst template for INFINITE SYSTEMS (Portrait Monograph IR-driven Geometry)
#let ir = json(sys.inputs.at("ir", default: "layout-ir.json"))

#set document(title: "INFINITE SYSTEMS", author: "Zhuang Liu")
#set page(
  width: ir.pageSize.widthMm * 1mm,
  height: ir.pageSize.heightMm * 1mm,
  margin: 0mm,
  fill: rgb("#070709"),
)
#set text(
  font: ("Syne", "Glow Sans SC Extended"),
  fill: rgb("#E6E4DF"),
  size: 10pt,
  cjk-latin-spacing: auto,
)

#for (idx, pg) in ir.pages.enumerate() [
  #if idx > 0 [ #pagebreak() ]
  #if pg.pageType == "cover" [
    #block(width: 100%, height: 100%, inset: (x: 18mm, top: 16mm, bottom: 14mm))[
      #grid(
        columns: (1fr, 1fr),
        text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[#("SYS // 2021–2026")],
        align(right, text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[ZHUANG LIU]),
      )
      #v(3mm)
      #pdf.artifact(line(length: 100%, stroke: 0.5pt + rgb("#CE2323")))
      #v(8mm)
      #heading(level: 1, bookmarked: true)[#text(weight: "extrabold", size: 22pt, tracking: 2.2pt)[INFINITE SYSTEMS]]
      #v(2mm)
      #text(font: "JetBrains Mono", size: 8.5pt, fill: rgb("#8A9099"))[#pg.subtitle]
      #if pg.at("coverImagePath", default: none) != none [
        #v(6mm)
        #align(center)[
          #image(pg.coverImagePath, width: 146mm, height: 173mm, fit: "contain", alt: "Monochrome close-up portrait cover photograph")
        ]
      ]
      #v(1fr)
      #text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[#pg.signature]
    ]
  ] else if pg.pageType == "phase-divider" [
    #block(width: 100%, height: 100%, inset: 22mm)[
      #v(1fr)
      #text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[#pg.movementId #("//") #upper(pg.modality)]
      #v(3mm)
      #pdf.artifact(line(length: 48mm, stroke: 0.5pt + rgb("#CE2323")))
      #v(4mm)
      #heading(level: 1, bookmarked: true)[#text(weight: "bold", size: 14pt, tracking: 2pt)[#pg.title]]
      #v(1.2fr)
    ]
  ] else if pg.pageType == "spread-verso" or pg.pageType == "spread-recto" [
    #if pg.slot != none and pg.slot.kind == "epigraph" [
      #block(width: 100%, height: 100%, inset: (x: 22mm, bottom: 26mm, top: 22mm))[
        #v(1fr)
        #let epigraphLang = if pg.slot.language == "zh-Hans" { "zh" } else if pg.slot.language == "mixed" { "en" } else { pg.slot.language }
        #let epigraphScript = if pg.slot.language == "zh-Hans" { "hans" } else { auto }
        #set text(lang: epigraphLang, script: epigraphScript, fill: rgb("#D8D5CE"), size: 10pt)
        #pg.slot.text
      ]
    ] else if pg.slot != none and pg.slot.kind == "plate" [
      #let isSym = pg.layout == "symmetric-diptych" and pg.slot.scale != "full-bleed"
      #let isDiag = pg.layout == "diagonal-offset" and pg.slot.scale != "full-bleed"
      #let plateAlign = if isSym {
        if pg.side == "verso" { right + horizon } else { left + horizon }
      } else if isDiag {
        if pg.side == "verso" { left + top } else { right + bottom }
      } else {
        center + horizon
      }
      #let plateInset = if isSym {
        if pg.side == "verso" { (right: 12mm, bottom: 12mm) } else { (left: 12mm, bottom: 12mm) }
      } else if isDiag {
        18mm
      } else {
        (bottom: 12mm)
      }
      #block(width: 100%, height: 100%)[
        #block(width: 100%, height: 100%, inset: plateInset)[
          #align(plateAlign)[
            #image(pg.slot.path, width: pg.slot.placedWidthMm * 1mm, height: pg.slot.placedHeightMm * 1mm, fit: "contain", alt: pg.slot.altText)
          ]
        ]
        #if pg.slot.showFolio [
          #place(
            if pg.side == "verso" { bottom + left } else { bottom + right },
            dx: if pg.side == "verso" { 18mm } else { -18mm },
            dy: -16mm,
            text(font: "JetBrains Mono", size: 7.5pt, fill: rgb("#8A9099"))[#pg.slot.plateLabel],
          )
        ]
      ]
    ]
  ] else if pg.pageType == "colophon-telemetry" or pg.pageType == "colophon-index" [
    #block(width: 100%, height: 100%, fill: rgb("#111317"), inset: 22mm)[
      #heading(level: 1, bookmarked: pg.pageType == "colophon-telemetry")[
        #text(font: "JetBrains Mono", size: 9.5pt, fill: rgb("#E6E4DF"))[SYSTEM COLOPHON #("//") #upper(pg.pageType)]
      ]
      #v(4mm)
      #pdf.artifact(line(length: 48mm, stroke: 0.5pt + rgb("#CE2323")))
      #v(8mm)
      #if pg.pageType == "colophon-telemetry" [
        #text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[
          EDITION: #upper(ir.editionId) \
          REVISION: #ir.revision \
          PROFILE: #upper(ir.profileId) \
          TRIM: #ir.pageSize.widthMm mm × #ir.pageSize.heightMm mm \
          PAGES: #ir.totalPages \
          PLATES: #ir.totalPlates
        ]
      ] else [
        #text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[
          All 127 photographs sequenced with strict monochrome / chroma movement separation.
        ]
      ]
    ]
  ]
]
