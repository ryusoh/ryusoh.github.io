// Canonical Typst template for INFINITE SYSTEMS (Fw:Books × VOID × MACK Portrait Monograph)
#let ir = json(sys.inputs.at("ir", default: "layout-ir.json"))
#let wf = ir.at("waveform", default: ())

#let renderWaveform(points, widthMm: 166, heightMm: 22, showAccent: false) = pdf.artifact(
  box(
    width: widthMm * 1mm,
    height: heightMm * 1mm,
    stroke: (bottom: 0.3pt + rgb("#2A2D34"), top: 0.3pt + rgb("#2A2D34")),
    inset: 0mm,
  )[
    #let yExhale = (1 - 75 / 255) * heightMm * 1mm
    #let yInhale = (1 - 135 / 255) * heightMm * 1mm
    #place(top + left, dy: yExhale, line(length: 100%, stroke: (paint: rgb("#2A2D34"), thickness: 0.25pt, dash: "densely-dotted")))
    #if showAccent [
      #place(top + left, dy: yInhale, line(length: 100%, stroke: (paint: rgb("#CE2323"), thickness: 0.3pt, dash: "densely-dotted")))
    ]
    #if points.len() > 1 [
      #let stepX = widthMm / (points.len() - 1)
      #let cmds = points.enumerate().map(((i, pt)) => {
        let x = (i * stepX) * 1mm
        let y = ((1 - calc.clamp(pt.luma255, 0, 255) / 255) * heightMm) * 1mm
        if i == 0 { curve.move((x, y)) } else { curve.line((x, y)) }
      })
      #place(top + left, curve(stroke: 0.45pt + rgb("#E6E4DF"), ..cmds))
    ]
  ]
)

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
  size: 9.5pt,
  cjk-latin-spacing: auto,
  overhang: true,
)

#for (idx, pg) in ir.pages.enumerate() [
  #if idx > 0 [ #pagebreak() ]
  #if pg.pageType == "cover" [
    #block(width: 100%, height: 100%)[
      #if pg.at("coverImagePath", default: none) != none [
        #place(
          top + left,
          image(pg.coverImagePath, width: 100%, height: 100%, fit: "cover", alt: "Monochrome close-up half-face portrait cover photograph")
        )
      ]
      #place(
        bottom + right,
        dx: -14mm,
        dy: -18mm,
        block(width: 122mm)[
          #align(right)[
            #set par(leading: 0.72em)
            #heading(level: 1, bookmarked: true)[
              #text(font: ("Syne", "Glow Sans SC Extended"), weight: "bold", size: 37pt, tracking: 0.4pt, fill: rgb("#E6E4DF"))[INFINITE \ SYSTEMS]
            ]
            #v(3.5mm)
            #text(font: ("Syne", "Glow Sans SC Extended"), weight: "medium", size: 17pt, tracking: 1.4pt, fill: rgb("#D8D5CE"))[Zhuang Liu]
          ]
        ]
      )
    ]
  ] else if pg.pageType == "phase-divider" [
    #let mRoman = pg.at("movementRoman", default: "I")
    #let mIdxLbl = pg.at("movementIndexLabel", default: pg.movementId)
    #let mModLbl = pg.at("modalityLabel", default: upper(pg.modality))
    #let mRange = pg.at("plateRange", default: "001")
    #let mCount = pg.at("plateCount", default: 0)
    #let mLuma = pg.at("meanLuma", default: 0)
    #let mWf = pg.at("waveformSlice", default: ())
    #block(width: 100%, height: 100%, inset: (x: 24mm, top: 48mm, bottom: 24mm))[
      #pdf.artifact(line(length: 100%, stroke: 0.3pt + rgb("#2A2D34")))
      #v(3.5mm)
      #grid(
        columns: (1fr, auto),
        text(font: "JetBrains Mono", size: 6.5pt, tracking: 1.0pt, fill: rgb("#8A9099"))[MOVEMENT #mIdxLbl · #upper(mModLbl)],
        text(font: "JetBrains Mono", size: 6.5pt, tracking: 1.0pt, fill: rgb("#8A9099"))[PLATES #mRange],
      )
      #v(14mm)
      #text(font: "JetBrains Mono", size: 8pt, tracking: 1.5pt, fill: rgb("#8A9099"))[#mRoman]
      #v(2.5mm)
      #heading(level: 1, bookmarked: true)[
        #text(font: ("Syne", "Glow Sans SC Extended"), weight: "bold", size: 15pt, tracking: 1.0pt, fill: rgb("#E6E4DF"))[#pg.title]
      ]
      #v(1fr)
      #if mWf.len() > 1 [
        #renderWaveform(mWf, widthMm: 162, heightMm: 16, showAccent: pg.modality == "color")
        #v(3mm)
      ]
      #grid(
        columns: (1fr, auto),
        text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#mCount PLATES · MEAN LUMA #mLuma],
        text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#pg.movementId],
      )
    ]
  ] else if pg.pageType == "spread-verso" or pg.pageType == "spread-recto" [
    #if pg.slot != none and pg.slot.kind == "epigraph" [
      #let epigraphLang = if pg.slot.language == "zh-Hans" { "zh" } else { "en" }
      #let epigraphScript = if pg.slot.language == "zh-Hans" { "hans" } else { auto }
      #let attr = pg.slot.at("attribution", default: none)
      #block(width: 100%, height: 100%, inset: (left: 32mm, right: 48mm, top: 82mm, bottom: 32mm))[
        #pdf.artifact(line(length: 14mm, stroke: 0.3pt + rgb("#2A2D34")))
        #v(5mm)
        #set par(leading: 1.05em, spacing: 1.5em, justify: false)
        #set text(
          font: ("Syne", "Glow Sans SC Extended"),
          lang: epigraphLang,
          script: epigraphScript,
          fill: rgb("#D8D5CE"),
          size: 9.5pt,
        )
        #pg.slot.text
        #if attr != none [
          #v(4mm)
          #text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[— #attr]
        ]
      ]
    ] else if pg.slot != none and pg.slot.kind == "plate" [
      #let isFull = pg.slot.scale == "full-bleed"
      #let isSym = pg.layout == "symmetric-diptych" and not isFull
      #let isAsym = pg.layout == "asymmetric-diptych" and not isFull
      #let isDiag = pg.layout == "diagonal-offset" and not isFull
      #let topHang = if isFull { 44mm } else if isDiag and pg.side == "recto" { 96mm } else if isDiag { 40mm } else { 50mm }
      #let outerRail = if isFull {
        0mm
      } else if isSym {
        38.6mm
      } else if isAsym {
        if pg.side == "verso" { 21.8mm } else { 70.5mm }
      } else if isDiag {
        26mm
      } else {
        (210mm - pg.slot.placedWidthMm * 1mm) / 2
      }
      #let plateInset = if isFull {
        (top: topHang, left: 0mm, right: 0mm)
      } else if isSym {
        if pg.side == "verso" { (top: topHang, right: 16mm) } else { (top: topHang, left: 16mm) }
      } else if isAsym {
        if pg.side == "verso" { (top: topHang, right: 16mm) } else { (top: topHang, left: 24mm) }
      } else if isDiag {
        if pg.side == "verso" { (top: topHang, left: 26mm) } else { (top: topHang, right: 26mm) }
      } else {
        (top: topHang)
      }
      #let plateAlign = if isFull {
        top + center
      } else if isSym or isAsym {
        if pg.side == "verso" { top + right } else { top + left }
      } else if isDiag {
        if pg.side == "verso" { top + left } else { top + right }
      } else {
        top + center
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
            dx: if pg.side == "verso" { outerRail } else { -outerRail },
            dy: -18mm,
            text(font: "JetBrains Mono", size: 6.5pt, tracking: 0.6pt, fill: rgb("#8A9099"))[#pg.slot.plateLabel],
          )
        ]
      ]
    ]
  ] else if pg.pageType == "colophon-telemetry" [
    #let summaries = pg.at("movementSummaries", default: ())
    #let fpShort = pg.at("sourceFingerprintShort", default: "9d2901560132539d")
    #block(width: 100%, height: 100%, fill: rgb("#111317"), inset: (x: 20mm, top: 22mm, bottom: 18mm))[
      #grid(
        columns: (1fr, auto),
        heading(level: 1, bookmarked: true)[
          #text(font: "JetBrains Mono", size: 7.5pt, tracking: 1.2pt, fill: rgb("#E6E4DF"))[ARCHIVAL COLOPHON & PHOTOMETRIC TELEMETRY]
        ],
        text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[REV. #ir.revision · #upper(ir.profileId)],
      )
      #v(3mm)
      #pdf.artifact(line(length: 100%, stroke: 0.3pt + rgb("#2A2D34")))
      #v(6mm)
      #text(font: "JetBrains Mono", size: 6.5pt, tracking: 0.8pt, fill: rgb("#8A9099"))[
        PHOTOMETRIC LUMINANCE TRAJECTORY · LUMA255(t) ACROSS #ir.totalPlates PLATES
      ]
      #v(2.5mm)
      #renderWaveform(wf, widthMm: 170, heightMm: 26, showAccent: true)
      #v(6mm)
      #text(font: "JetBrains Mono", size: 6.5pt, tracking: 0.8pt, fill: rgb("#8A9099"))[MOVEMENT ARCHITECTURE]
      #v(2.5mm)
      #for m in summaries [
        #pdf.artifact(line(length: 100%, stroke: 0.25pt + rgb("#2A2D34")))
        #v(1.8mm)
        #grid(
          columns: (18mm, 34mm, 38mm, 28mm, 1fr),
          text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#m.movementId],
          text(font: ("Syne", "Glow Sans SC Extended"), weight: "bold", size: 7pt, fill: rgb("#E6E4DF"))[#m.title],
          text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#D8D5CE"))[#m.modalityLabel],
          text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[PLATES #m.plateRange],
          align(right, text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[#m.plateCount FRAMES · L #m.meanLuma]),
        )
        #v(1.8mm)
      ]
      #pdf.artifact(line(length: 100%, stroke: 0.25pt + rgb("#2A2D34")))
      #v(1fr)
      #grid(
        columns: (1fr, 1fr),
        column-gutter: 10mm,
        text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[
          EDITION: #upper(ir.editionId) \
          AUTHOR: ZHUANG LIU \
          TRIM: #ir.pageSize.widthMm × #ir.pageSize.heightMm MM \
          EXTENT: #ir.totalPages PAGES · #ir.totalPlates PLATES
        ],
        text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[
          PROFILE: #upper(ir.profileId) \
          VIEW: TWOPAGERIGHT SPREADS \
          TYPESET: GLOW SANS SC · SYNE · JETBRAINS MONO \
          POOL SHA256: #fpShort
        ],
      )
    ]
  ] else if pg.pageType == "colophon-index" [
    #let entries = pg.at("entries", default: ())
    #let rangeLbl = pg.at("rangeLabel", default: "001–127")
    #let idxPg = pg.at("indexPageNumber", default: 1)
    #let idxTotal = pg.at("indexPageCount", default: 1)
    #block(width: 100%, height: 100%, fill: rgb("#111317"), inset: (x: 16mm, top: 20mm, bottom: 16mm))[
      #grid(
        columns: (1fr, auto),
        heading(level: 1, bookmarked: idxPg == 1)[
          #text(font: "JetBrains Mono", size: 7.5pt, tracking: 1.0pt, fill: rgb("#E6E4DF"))[ILLUSTRATED PLATE INDEX · #rangeLbl]
        ],
        text(font: "JetBrains Mono", size: 6.5pt, fill: rgb("#8A9099"))[INDEX #idxPg / #idxTotal],
      )
      #v(2.5mm)
      #pdf.artifact(line(length: 100%, stroke: 0.3pt + rgb("#2A2D34")))
      #v(4mm)
      #if entries.len() > 0 [
        #grid(
          columns: (1fr, 1fr, 1fr, 1fr),
          column-gutter: 4.5mm,
          row-gutter: 4.5mm,
          ..entries.map(e => block(width: 100%, height: 22.5mm, clip: true)[
            #grid(
              columns: (14mm, 1fr),
              column-gutter: 2.2mm,
              block(width: 14mm, height: 9.5mm, fill: rgb("#070709"))[
                #if e.path != "" [
                  #image(e.path, width: 14mm, height: 9.5mm, fit: "cover")
                ]
              ],
              block(width: 100%)[
                #text(font: "JetBrains Mono", size: 5.8pt, fill: rgb("#E6E4DF"))[#e.plateLabel · #e.seriesId]
                #linebreak()
                #text(font: "JetBrains Mono", size: 5.2pt, fill: rgb("#8A9099"))[#upper(e.modality) · L\* #e.labL]
              ],
            )
            #v(1.2mm)
            #set par(leading: 0.45em)
            #text(font: ("Glow Sans SC Extended", "Syne"), size: 5.2pt, fill: rgb("#D8D5CE"))[#e.shortCaption]
          ])
        )
      ] else [
        #text(font: "JetBrains Mono", size: 7.5pt, fill: rgb("#8A9099"))[
          All #ir.totalPlates photographs sequenced with strict monochrome / chroma movement separation.
        ]
      ]
    ]
  ]
]
