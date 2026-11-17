// Canonical Typst template for INFINITE SYSTEMS (300mm x 200mm 3:2 Landscape)
#let ir = json(sys.inputs.at("ir", default: "layout-ir.json"))

#set document(title: "INFINITE SYSTEMS", author: "Zhuang Liu")
#set page(
  width: 300mm,
  height: 200mm,
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
    #block(width: 100%, height: 100%, inset: 18mm)[
      #grid(
        columns: (1fr, 1fr),
        text(font: "JetBrains Mono", size: 8.5pt, fill: rgb("#8A9099"))[SYS // 2021–2026],
        align(right, text(font: "JetBrains Mono", size: 8.5pt, fill: rgb("#8A9099"))[ZHUANG LIU]),
      )
      #v(3mm)
      #pdf.artifact(line(length: 100%, stroke: 0.5pt + rgb("#CE2323")))
      #v(6mm)
      #heading(level: 1, bookmarked: true)[#text(weight: "extrabold", size: 28pt, tracking: 3pt)[INFINITE SYSTEMS]]
      #v(1fr)
      #text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[#pg.signature]
    ]
  ] else if pg.pageType == "phase-divider" [
    #block(width: 100%, height: 100%, inset: 24mm)[
      #v(1fr)
      #text(font: "JetBrains Mono", size: 8pt, fill: rgb("#8A9099"))[#pg.movementId // #upper(pg.modality)]
      #v(3mm)
      #pdf.artifact(line(length: 48mm, stroke: 0.5pt + rgb("#CE2323")))
      #v(4mm)
      #heading(level: 1, bookmarked: true)[#text(weight: "bold", size: 14pt, tracking: 2pt)[#pg.title]]
      #v(1fr)
    ]
  ] else if pg.pageType == "spread-verso" or pg.pageType == "spread-recto" [
    #if pg.slot != none and pg.slot.kind == "epigraph" [
      #block(width: 100%, height: 100%, inset: 24mm)[
        #v(1fr)
        #set text(lang: pg.slot.language, fill: rgb("#D8D5CE"), size: 10pt)
        #pg.slot.text
      ]
    ] else if pg.slot != none and pg.slot.kind == "plate" [
      #block(width: 100%, height: 100%)[
        #align(center + horizon)[
          #image(pg.slot.path, width: pg.slot.placedWidthMm * 1mm, fit: "contain", alt: pg.slot.altText)
        ]
        #if pg.slot.showFolio [
          #place(
            if pg.side == "verso" { bottom + left } else { bottom + right },
            dx: if pg.side == "verso" { 10mm } else { -10mm },
            dy: -10mm,
            text(font: "JetBrains Mono", size: 7.5pt, fill: rgb("#8A9099"))[#pg.slot.plateLabel],
          )
        ]
      ]
    ]
  ] else if pg.pageType == "colophon-telemetry" or pg.pageType == "colophon-index" [
    #block(width: 100%, height: 100%, fill: rgb("#111317"), inset: 20mm)[
      #heading(level: 1, bookmarked: pg.pageType == "colophon-telemetry")[
        #text(font: "JetBrains Mono", size: 10pt, fill: rgb("#E6E4DF"))[SYSTEM COLOPHON // #upper(pg.pageType)]
      ]
    ]
  ]
]
