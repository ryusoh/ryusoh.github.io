from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch


OUT = Path(__file__).with_name("orchestration-boundaries.png")

BG = "#f7f5f0"
INK = "#17191d"
SLATE = "#424c59"
MUTED = "#637a83"
RED = "#ce2323"
GREEN = "#547265"
WHITE = "#ffffff"

fig, ax = plt.subplots(figsize=(16, 9), dpi=150)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 16)
ax.set_ylim(0, 9)
ax.axis("off")

ax.text(
    0.75,
    8.48,
    "Authority boundaries in the ebook orchestration system",
    fontsize=24,
    fontweight="bold",
    color=INK,
    va="center",
)
ax.text(
    0.75,
    8.03,
    "Only the human decision gate can promote a proposal into the approved edition ledger.",
    fontsize=12.5,
    color=SLATE,
    va="center",
)

nodes = {
    1: (0.8, 6.25, "01  SOURCE OF TRUTH", "Originals · text · rights", SLATE),
    2: (6.0, 6.25, "02  DERIVED INVENTORY", "Hashes · metrics · candidates", MUTED),
    3: (11.2, 6.25, "03  CANDIDATE EDITS", "Sequences · layouts · explanations", RED),
    4: (11.2, 3.95, "04  HUMAN DECISION", "Approve · reject · revise", RED),
    5: (6.0, 3.95, "05  APPROVED LEDGER", "Versioned · locked · auditable", GREEN),
    6: (0.8, 3.95, "06  LAYOUT IR", "Deterministic · renderer-neutral", MUTED),
    7: (0.8, 1.65, "07  RENDERERS", "Display · archive · press", SLATE),
    8: (6.0, 1.65, "08  RELEASE GATES", "Preflight · repro · human proof", GREEN),
    9: (11.2, 1.65, "09  SIGNED-OFF EDITION", "Artifacts · manifest · approvals", GREEN),
}

box_w = 4.0
box_h = 1.25
centers = {}
for number, (x, y, title, subtitle, accent) in nodes.items():
    shadow = FancyBboxPatch(
        (x + 0.05, y - 0.06),
        box_w,
        box_h,
        boxstyle="round,pad=0.03,rounding_size=0.10",
        linewidth=0,
        facecolor=INK,
        alpha=0.08,
        zorder=1,
    )
    box = FancyBboxPatch(
        (x, y),
        box_w,
        box_h,
        boxstyle="round,pad=0.03,rounding_size=0.10",
        linewidth=1.5,
        edgecolor=accent,
        facecolor=WHITE,
        zorder=2,
    )
    ax.add_patch(shadow)
    ax.add_patch(box)
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            0.12,
            box_h,
            boxstyle="round,pad=0,rounding_size=0.06",
            linewidth=0,
            facecolor=accent,
            zorder=3,
        )
    )
    ax.text(x + 0.30, y + 0.80, title, fontsize=12.2, fontweight="bold", color=INK, zorder=4)
    ax.text(x + 0.30, y + 0.39, subtitle, fontsize=10.2, color=SLATE, zorder=4)
    centers[number] = (x + box_w / 2, y + box_h / 2)


def arrow(start, end, color=SLATE, style="-", rad=0.0, zorder=5):
    ax.annotate(
        "",
        xy=end,
        xytext=start,
        arrowprops={
            "arrowstyle": "-|>",
            "lw": 1.8,
            "color": color,
            "linestyle": style,
            "mutation_scale": 16,
            "connectionstyle": f"arc3,rad={rad}",
            "shrinkA": 0,
            "shrinkB": 0,
        },
        zorder=zorder,
    )


# Solid arrows describe the one-way production path.
arrow((4.83, 6.875), (5.94, 6.875))
arrow((10.03, 6.875), (11.14, 6.875))
arrow((13.20, 6.20), (13.20, 5.26))
arrow((11.14, 4.575), (10.06, 4.575))
arrow((5.94, 4.575), (4.86, 4.575))
arrow((2.80, 3.90), (2.80, 2.96))
arrow((4.83, 2.275), (5.94, 2.275))
arrow((10.03, 2.275), (11.14, 2.275))

# Human feedback informs another proposal; it never becomes an optimizer write-back.
arrow((15.25, 4.35), (15.25, 6.58), color=RED, style="--", rad=-0.25)
ax.text(
    15.62,
    5.46,
    "locks · bans ·\ntaste decisions",
    fontsize=9.5,
    color=RED,
    ha="center",
    va="center",
    rotation=90,
)

ax.plot([0.75, 15.25], [5.72, 5.72], color=MUTED, lw=0.8, alpha=0.35, zorder=0)
ax.text(0.78, 5.84, "PROPOSAL SPACE", fontsize=9.2, fontweight="bold", color=RED)
ax.text(0.78, 3.56, "APPROVED, REPRODUCIBLE BUILD SPACE", fontsize=9.2, fontweight="bold", color=GREEN)

ax.text(
    0.75,
    0.75,
    "Solid arrows: production data flow    ·    Dashed arrow: human feedback into a new proposal    ·    Originals remain read-only",
    fontsize=10.5,
    color=SLATE,
    va="center",
)
ax.text(
    0.75,
    0.35,
    "LLMs may explain or propose inside the candidate stage. Inventory, validation, rendering, and preflight remain deterministic.",
    fontsize=10.5,
    color=SLATE,
    va="center",
)

fig.savefig(OUT, dpi=150, facecolor=BG)
plt.close(fig)
print(OUT)
