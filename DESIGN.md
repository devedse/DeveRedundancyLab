# Deve Disk Recovery Simulator — Functional Design Document

## 1. Vision & Purpose

An interactive, animated Vue.js web application that **visually teaches** how disk redundancy systems (RAID 5/6, Reed-Solomon, erasure coding) protect data against failures. Users drag pixel-art images onto a virtual disk array and watch — pixel by pixel — how data is striped across disks, how parity is calculated (with full math shown), and how data survives disk failures and cosmic-ray bit-flips.

---

## 2. Core Concepts

| Concept | How It's Taught |
|---|---|
| **Data Striping** | Pixels from an image are visually distributed across disks in animated stripes |
| **Parity (XOR)** | Parity pixels are calculated live; hover to see the XOR equation |
| **RAID 5** | Single distributed parity — one parity block per stripe rotates across disks |
| **RAID 6** | Dual distributed parity (P + Q) using Galois Field arithmetic |
| **Reed-Solomon Codes** | Generalized erasure coding with configurable data/parity disk count |
| **Galois Fields (GF(2⁸))** | Interactive GF arithmetic explorer; used for RAID 6 Q-syndrome & Reed-Solomon |
| **Checksums** | CRC / simple checksum shown per block; detects silent corruption |
| **Failure & Recovery** | Remove/corrupt disks → watch the rebuild algorithm reconstruct missing pixels |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vue 3 + Vite SPA                     │
├──────────┬──────────┬──────────┬────────────────────────┤
│  Image   │  Volume  │  Disk    │  Math / Algorithm      │
│  Library │  Config  │  Array   │  Inspector Panel       │
│  Panel   │  Bar     │  View    │                        │
└──────────┴──────────┴──────────┴────────────────────────┘
        ▲                ▲                  ▲
        │                │                  │
   PixelArt          RAID Engine        GF(2⁸) Math
   Assets            (pure TS)          Library
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API + `<script setup>`) |
| Build | Vite |
| State | Pinia |
| Animation | GSAP + CSS transitions |
| Drag & Drop | `@vueuse/core` useDraggable / HTML5 DnD |
| Pixel Rendering | `<canvas>` elements (zoomable pixel grids) |
| Math Rendering | KaTeX (inline formulas) |
| Styling | Tailwind CSS + custom pixel-art theme |
| Language | TypeScript |

---

## 4. UI Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER BAR: "Deve Disk Recovery Simulator"       [Algorithm ▼] [?] │
├────────────┬─────────────────────────────────────────────────────────┤
│            │  VOLUME CONFIGURATION BAR                               │
│            │  ┌─────────────────────────────────────────────────┐    │
│  IMAGE     │  │ Algorithm: [RAID 5 ▼]  Data Disks: [3]         │    │
│  LIBRARY   │  │ Parity Disks: [1]  Block Size: [32px]          │    │
│            │  │ Checksum: [CRC-8 ▼]  [▶ Auto-Animate]          │    │
│  ┌──────┐  │  └─────────────────────────────────────────────────┘    │
│  │ 8x8  │  │                                                        │
│  │image1│  │  DISK ARRAY VISUALIZATION                               │
│  └──────┘  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  ┌──────┐  │  │ Disk 0 │ │ Disk 1 │ │ Disk 2 │ │ Disk 3 │          │
│  │ 8x8  │  │  │ DATA   │ │ DATA   │ │ DATA   │ │ PARITY │          │
│  │image2│  │  │┌──┬──┐ │ │┌──┬──┐ │ │┌──┬──┐ │ │┌──┬──┐ │          │
│  └──────┘  │  ││px│px│ │ ││px│px│ │ ││px│px│ │ ││pp│pp│ │          │
│  ┌──────┐  │  ││px│px│ │ ││px│px│ │ ││px│px│ │ ││pp│pp│ │          │
│  │ 8x8  │  │  │└──┴──┘ │ │└──┴──┘ │ │└──┴──┘ │ │└──┴──┘ │          │
│  │image3│  │  │         │ │         │ │         │ │         │          │
│  └──────┘  │  │ [💀Del] │ │ [🧹Wipe]│ │ [☢️Flip]│ │ [➕Add] │          │
│            │  └────────┘ └────────┘ └────────┘ └────────┘          │
│  (drag me  │                                                        │
│  onto the  ├────────────────────────────────────────────────────────┤
│  volume)   │  MATH INSPECTOR PANEL                                  │
│            │  ┌────────────────────────────────────────────────┐    │
│            │  │ Parity pixel [3,0] = D0[0,0] ⊕ D1[0,0] ⊕     │    │
│            │  │                      D2[0,0]                    │    │
│            │  │ = 0xA3 ⊕ 0x7F ⊕ 0x12 = 0xCC                   │    │
│            │  │                                                 │    │
│            │  │ Galois Field: GF(2⁸) with primitive poly        │    │
│            │  │ x⁸ + x⁴ + x³ + x² + 1  (0x11D)                │    │
│            │  └────────────────────────────────────────────────┘    │
└────────────┴────────────────────────────────────────────────────────┘
```

---

## 5. Panels & Components

### 5.1 Image Library Panel (Left Sidebar)

- **Pre-loaded pixel art images** (8×8, 16×16, 32×32) with 8-bit color depth (256 colors)
- User can **upload custom images** (auto-scaled to nearest supported size)
- Each image shows a **zoomed preview** on hover
- **Drag handle** on each image; dragging initiates the distribution animation
- Image data is internally represented as a flat `Uint8Array` of pixel values

### 5.2 Volume Configuration Bar (Top)

| Control | Type | Options |
|---|---|---|
| Algorithm | Dropdown | XOR Parity, RAID 5, RAID 6, Reed-Solomon (n,k) |
| Data Disks | Slider + Input | 2 – 16 |
| Parity Disks | Slider + Input | 1 – 4 (algorithm-dependent) |
| Block Size | Dropdown | 8, 16, 32, 64 pixels per stripe unit |
| Stripe Width | Auto-calculated | = data disks × block size |
| Checksum | Dropdown | None, XOR-8, CRC-8, CRC-32 |
| Auto-Animate | Toggle | Animate stripe-by-stripe vs. instant |
| Animation Speed | Slider | 0.25× – 4× |
| Galois Primitive Poly | Dropdown | Common GF(2⁸) polynomials |

**Algorithm constraints:**
- RAID 5 → exactly 1 parity disk, rotates position each stripe
- RAID 6 → exactly 2 parity disks (P = XOR, Q = GF multiply)
- Reed-Solomon → 1–4 parity disks, full GF(2⁸) encoding

### 5.3 Disk Array View (Center — Main Area)

Each disk is a **visual column** rendered as a pixel grid (canvas):

- **Data pixels** show their actual color
- **Parity pixels** show the computed parity value *as a color* (8-bit palette)
- **Stripe rows** are visually grouped with alternating subtle background tinting
- **Parity rotation** in RAID 5 is clearly visible (the parity column shifts each stripe)
- Disk header shows: disk index, role label (Data / Parity / P / Q), status icon

**Pixel Interaction:**
- **Hover** → highlight the pixel, draw colored connection lines to all source pixels used in its calculation, open Math Inspector
- **Click** → pin the Math Inspector to stay open for that pixel

**Disk Status States:**

| State | Visual | Description |
|---|---|---|
| 🟢 Healthy | Normal rendering | Operational disk |
| 🔴 Failed / Removed | Red overlay, "X" watermark, pixels ghosted | Disk removed from array |
| 🟡 Degraded | Yellow tint | Data readable but redundancy lost |
| 🔵 Rebuilding | Blue sweep animation | Reconstruction in progress |
| 🟣 Corrupted | Purple glitch pixels on affected area | Bit-flip corruption |
| ⚪ Empty / New | Gray placeholder | Newly added disk, not yet built |

**Per-Disk Action Buttons:**

| Button | Action |
|---|---|
| 💀 Remove Disk | Marks disk as failed; if recoverable, triggers degraded mode |
| 🧹 Wipe Disk | Zeros all data (disk stays in array but is blank) |
| ☢️ Cosmic Ray | Flips 1–N random bits in a random pixel(s) on this disk |
| ➕ Add / Re-add | Adds a new blank disk or reinserts a removed disk |
| 🔄 Rebuild | Triggers animated reconstruction of a failed/wiped/new disk |

### 5.4 Math Inspector / Calculation Engine Panel (Bottom)

The Math Inspector doubles as the **Calculation Engine** — it is not just a display, it is the visual heart of every computation. All parity generation and recovery operations are **animated through this panel**: input pixels physically fly into it, the math plays out step-by-step inside it, and output pixels fly out to their destination disks.

#### Layout

```
┌─ CALCULATION ENGINE ──────────────────────────────────────────────────┐
│                                                                       │
│  ┌─ INPUT SLOTS ─┐     ┌─ FORMULA ──────────────────┐  ┌─ OUTPUT ─┐  │
│  │ [██ 0xA3 D₀]  │     │ P = D₀ ⊕ D₁ ⊕ D₂         │  │ [██ 0xCC] │  │
│  │ [██ 0x7F D₁]  │ ──▶ │   = 0xA3 ⊕ 0x7F ⊕ 0x12   │  │  ──▶ D₃  │  │
│  │ [██ 0x12 D₂]  │     │   = 0xCC                   │  │          │  │
│  └───────────────┘     └────────────────────────────┘  └──────────┘  │
│                                                                       │
│  Binary: 10100011 ⊕ 01111111 ⊕ 00010010 = 11001100                   │
└───────────────────────────────────────────────────────────────────────┘
```

The panel has three zones:

| Zone | Purpose |
|---|---|
| **Input Slots** (left) | Landing area for incoming pixels. Each slot shows: color swatch, hex value, source disk label. Empty slots show a dashed placeholder. Missing/unavailable inputs show **`?`** with red tint. |
| **Formula Area** (center) | The algebraic expression + step-by-step evaluation. Animates line-by-line as the computation progresses. |
| **Output Slots** (right) | The computed result pixel(s). RAID 5 → 1 output. RAID 6 → 2 outputs (P, Q). Reed-Solomon → N outputs. Failed computation shows **`✕`** (red cross). Output pixel then animates out to its target disk position. |

#### Behavior Modes

| Mode | Trigger | Behavior |
|---|---|---|
| **Parity Calculation** | During image distribution | Data pixels fly from disk slots → input slots. Formula animates. Output pixel(s) fly → parity disk slot(s). |
| **Recovery Calculation** | During disk rebuild | Surviving data + parity pixels fly → input slots. Missing input(s) shown as `?`. Formula animates (inverse operation). Recovered pixel flies → rebuilt disk slot. |
| **Failed Recovery** | Rebuild with insufficient data | Available pixels fly → input slots. Missing slots show `?` (red). Formula shows "insufficient data". Output slot shows `✕` (red cross). No pixel emitted. |
| **Hover Inspect** | Mouse hover on any pixel | No flying animation — instant display of the formula + values. Source pixels highlighted on disks with connection lines. |

#### Example: RAID 5 Parity Calculation

```
INPUT:  [██ 0xA3 from D₀]  [██ 0x7F from D₁]  [██ 0x12 from D₂]

FORMULA (animates line by line):
  P = D₀[7] ⊕ D₁[7] ⊕ D₂[7]
    = 0xA3  ⊕ 0x7F  ⊕ 0x12
    = 10100011₂ ⊕ 01111111₂ ⊕ 00010010₂
    = 11001100₂
    = 0xCC

OUTPUT: [██ 0xCC → flies to Disk 3, parity slot]
```

#### Example: RAID 6 Parity Calculation (2 outputs)

```
INPUT:  [██ 0xA3 from D₀]  [██ 0x7F from D₁]  [██ 0x12 from D₂]

FORMULA — Pass 1 (P):
  P = D₀ ⊕ D₁ ⊕ D₂ = 0xCC             OUTPUT P: [██ 0xCC → Disk 3]

FORMULA — Pass 2 (Q):
  Q = g⁰·D₀ ⊕ g¹·D₁ ⊕ g²·D₂
    = 0x01⊗0xA3 ⊕ 0x02⊗0x7F ⊕ 0x04⊗0x12
    = 0xA3 ⊕ 0xFE ⊕ 0x48 = 0x19        OUTPUT Q: [██ 0x19 → Disk 4]
```

#### Example: Recovery (1 disk lost, RAID 5)

```
INPUT:  [?? missing D₁]  [██ 0xA3 from D₀]  [██ 0x12 from D₂]  [██ 0xCC from P]

FORMULA (inverse):
  D₁ = P ⊕ D₀ ⊕ D₂
     = 0xCC ⊕ 0xA3 ⊕ 0x12
     = 0x7F

OUTPUT: [██ 0x7F → flies to rebuilt Disk 1]
```

#### Example: Failed Recovery (too many disks lost)

```
INPUT:  [?? missing D₀]  [?? missing D₁]  [██ 0x12 from D₂]  [██ 0xCC from P]

FORMULA:
  ✕ Cannot recover — need 2 values but only have P (single parity).
  2 disks lost > 1 parity disk. Data unrecoverable.

OUTPUT: [✕ red cross — no pixel emitted]
```

### 5.5 Galois Field Explorer (Modal / Side Panel)

Accessible via a "🔬 GF Explorer" button. Interactive sub-tool:

- **Multiplication table** (scrollable 256×256 grid, color-coded)
- **Single operation calculator**: input two GF(2⁸) elements → see add/multiply/divide/inverse
- **Polynomial view**: show each byte as a polynomial over GF(2)
- **Generator powers**: list powers of the generator element g
- Linked to the main sim: clicking a GF operation in the Math Inspector opens it here

---

## 6. Algorithms & Math Engine

### 6.1 Module: `gf256.ts` — Galois Field GF(2⁸)

```typescript
// Core operations (all in GF(2⁸) with configurable primitive polynomial)
gfAdd(a: number, b: number): number           // XOR
gfMul(a: number, b: number): number           // Log/antilog table multiplication
gfDiv(a: number, b: number): number           // a * inverse(b)
gfInverse(a: number): number                  // Via log table
gfPow(a: number, n: number): number           // Exponentiation
buildLogTables(primPoly: number): void         // Precompute log/exp tables
```

Precomputed tables for O(1) multiply/divide. Default primitive polynomial: `0x11D` ($x^8 + x^4 + x^3 + x^2 + 1$).

### 6.2 Module: `raid.ts` — RAID Striping & Parity

```typescript
interface StripeUnit {
  diskIndex: number
  offset: number
  pixels: Uint8Array
  role: 'data' | 'parity-p' | 'parity-q'
}

// RAID 5: left-symmetric parity rotation
computeRaid5Stripe(dataBlocks: Uint8Array[], stripeIndex: number): StripeUnit[]

// RAID 6: P = XOR, Q = GF weighted sum
computeRaid6Stripe(dataBlocks: Uint8Array[], stripeIndex: number): StripeUnit[]
```

### 6.3 Module: `reedsolomon.ts` — Reed-Solomon Erasure Coding

```typescript
// Encodes k data shards into n total shards (n-k parity shards)
encode(dataShards: Uint8Array[], parityCount: number): Uint8Array[]

// Reconstructs missing shards given at least k surviving shards
reconstruct(shards: (Uint8Array | null)[], parityCount: number): Uint8Array[]

// Builds the Vandermonde / Cauchy encoding matrix over GF(2⁸)
buildEncodingMatrix(dataCount: number, parityCount: number): number[][]

// Matrix inversion in GF(2⁸) for recovery
invertSubMatrix(matrix: number[][], rows: number[]): number[][]
```

### 6.4 Module: `checksum.ts`

```typescript
checksumXor8(data: Uint8Array): number
checksumCrc8(data: Uint8Array): number
checksumCrc32(data: Uint8Array): number
verifyBlock(data: Uint8Array, expected: number, algo: ChecksumAlgo): boolean
```

---

## 7. Interaction Flows

All computation flows follow one unified visual pattern: **pixels fly into the Calculation Engine, the math animates, result pixels fly out**. This applies to parity generation, recovery, and repair.

### 7.1 Drag Image to Volume (Parity Generation)

```
User drags image from Library → drops on Volume area
  │
  ├─ 1. Image pixel data extracted as Uint8Array
  ├─ 2. Data split into stripe units (blockSize pixels each)
  ├─ 3. For each stripe (animated, sequential per position):
  │     │
  │     ├─ PHASE 1 — Data Distribution:
  │     │   Data pixels fly from image → their target disk column slots
  │     │   (all data disk pixels for this stripe land simultaneously)
  │     │
  │     ├─ PHASE 2 — Calculation Input:
  │     │   For each byte position within the stripe:
  │     │     ├─ a. The N data pixels (one per data disk) at this position
  │     │     │      highlight and clone — clones fly to the Calc Engine input slots
  │     │     ├─ b. Each input slot fills in sequence with the pixel's color,
  │     │     │      hex value, and source disk label
  │     │     │
  │     │     ├─ PHASE 3 — Computation:
  │     │     │   ├─ The formula area animates line-by-line:
  │     │     │   │   Line 1: symbolic formula  (P = D₀ ⊕ D₁ ⊕ D₂)
  │     │     │   │   Line 2: hex substitution   (= 0xA3 ⊕ 0x7F ⊕ 0x12)
  │     │     │   │   Line 3: binary expansion    (= 10100011₂ ⊕ ...)
  │     │     │   │   Line 4: result              (= 0xCC)
  │     │     │   ├─ For RAID 6: P formula animates → P output appears,
  │     │     │   │   then Q formula animates → Q output appears
  │     │     │   └─ For Reed-Solomon: all k parity outputs computed sequentially
  │     │     │
  │     │     └─ PHASE 4 — Output Delivery:
  │     │         ├─ Output pixel(s) appear in the output slot(s) with a glow pulse
  │     │         ├─ RAID 5: 1 output pixel flies → parity disk slot
  │     │         ├─ RAID 6: 2 output pixels (P, Q) fly → their respective parity disk slots
  │     │         └─ Reed-Solomon: N output pixels fly → parity disk slots
  │     │
  │     └─ (repeat for next byte position, or batch-animate if speed > 2×)
  │
  ├─ 4. Volume enters "populated" state, disk actions enabled
  └─ 5. Volume Preview panel updates with original vs. on-disk image
```

**Animation timing (at 1× speed):**

| Phase | Duration | Notes |
|---|---|---|
| Data pixel fly to disk | 400ms | All data pixels for the stripe in parallel, cubic-bezier overshoot |
| Input pixels fly to Calc Engine | 300ms | Staggered 80ms per input, clones fly while originals stay on disk |
| Formula line animation | 200ms/line | Lines appear sequentially with typewriter-style reveal |
| Output glow + appear | 250ms | Pulse glow on output slot |
| Output pixel fly to disk | 350ms | Smooth ease-out to target parity slot |
| **Total per byte position** | **~1500ms** | Faster at higher speeds, skipped for batch mode |

### 7.2 Hover Over Pixel

```
User hovers over any pixel on any disk
  │
  ├─ 1. Pixel highlights (bright border + scale up 1.2×)
  ├─ 2. If DATA pixel:
  │     └─ Show which parity pixel(s) this contributes to
  │        Draw dashed lines to parity pixel(s)
  │        Calc Engine shows the formula it participates in (instant, no fly animation)
  ├─ 3. If PARITY pixel:
  │     └─ Highlight ALL source data pixels in this stripe
  │        Draw solid lines from source pixels → Calc Engine → this parity pixel
  │        Calc Engine input slots show source values, formula shows computation, output shows this pixel
  └─ 4. Tooltip shows: hex value, binary, pixel index, disk, stripe
```

**Key difference from generation/recovery:** hover inspection populates the Calc Engine *instantly* (no flying animation). The input/formula/output zones still fill in, but with a fast fade (150ms) rather than the full choreography.

### 7.3 Remove a Disk

```
User clicks 💀 on Disk 1
  │
  ├─ 1. Confirmation tooltip: "Remove Disk 1? Data will be lost."
  ├─ 2. Disk column plays "shatter" animation (pixels fragment and fade)
  ├─ 3. Disk status → 🔴 Failed (red overlay, ghosted pixels)
  ├─ 4. Remaining disks flash yellow briefly → 🟡 Degraded
  ├─ 5. Status bar: "Array degraded — 1 disk failed. Can tolerate 0 more."
  ├─ 6. Volume Preview updates: "On Disk" image shows black holes for lost pixels,
  │     "Reconstructed" shows parity-recovered version
  └─ 7. If too many disks lost → "ARRAY FAILED — Data unrecoverable" (red alert)
```

### 7.4 Rebuild a Disk (Recovery)

```
User clicks ➕ to re-add, then clicks 🔄 Rebuild
  │
  ├─ 1. New blank disk appears (⚪ Empty)
  ├─ 2. Disk status → 🔵 Rebuilding
  ├─ 3. For each stripe, for each byte position (animated through Calc Engine):
  │     │
  │     ├─ PHASE 1 — Gather Inputs:
  │     │   ├─ Surviving data pixels at this position highlight
  │     │   ├─ Parity pixel(s) at this position highlight
  │     │   ├─ Clones fly to Calc Engine input slots (with disk labels)
  │     │   └─ Missing disk's input slot shows: [?? D₁ missing] with red dashed border
  │     │
  │     ├─ PHASE 2 — Recovery Computation:
  │     │   ├─ Formula animates the inverse operation:
  │     │   │   "D₁ = P ⊕ D₀ ⊕ D₂" (RAID 5)
  │     │   │   or matrix solve (RAID 6 / RS)
  │     │   ├─ Intermediate values shown step-by-step
  │     │   └─ Result value computed
  │     │
  │     ├─ PHASE 3 — Output:
  │     │   ├─ Recovered pixel appears in output slot with blue glow
  │     │   └─ Pixel flies from Calc Engine → rebuilt disk's slot
  │     │
  │     └─ PHASE 4 — Progress:
  │         └─ Blue sweep on disk column advances, progress indicator updates
  │
  ├─ 4. Rebuild complete → disk status → 🟢 Healthy
  └─ 5. Volume Preview updates to show fully recovered image
```

### 7.5 Failed Rebuild (Insufficient Redundancy)

```
User tries to rebuild but too many disks are missing
  │
  ├─ 1. For each byte position in each stripe:
  │     │
  │     ├─ PHASE 1 — Gather Inputs:
  │     │   ├─ Available pixels fly to Calc Engine input slots
  │     │   └─ Each missing disk's slot shows: [?? D₁ missing] [?? D₂ missing]
  │     │       with red dashed borders and "?" placeholders
  │     │
  │     ├─ PHASE 2 — Computation Fails:
  │     │   ├─ Formula area shows:
  │     │   │   "✕ Cannot recover — 2 disks lost > 1 parity disk"
  │     │   │   "Need at least 3 known values, have only 2"
  │     │   └─ Formula text rendered in red
  │     │
  │     └─ PHASE 3 — Failed Output:
  │         ├─ Output slot shows large red "✕" (cross)
  │         ├─ No pixel is emitted to any disk
  │         └─ Disk slot on the target remains empty/ghost
  │
  ├─ 2. Rebuild aborts with error state
  └─ 3. Status bar: "UNRECOVERABLE — insufficient redundancy"
```

### 7.6 Cosmic Ray Bit-Flip

```
User clicks ☢️ on a disk
  │
  ├─ 1. "ZAP" animation (lightning bolt hits a random pixel)
  ├─ 2. 1–8 random bits flipped in the target pixel's byte
  ├─ 3. Pixel color changes to the corrupted value
  ├─ 4. If checksum enabled: checksum mismatch detected
  │     └─ Pixel gets 🟣 purple corruption marker
  │        Calc Engine shows: "Expected 0xA3, Got 0xE3 — bit 6 flipped"
  ├─ 5. Volume Preview updates: "Reconstructed" image shows mismatch
  └─ 6. User can try "Verify & Repair" (see §7.7)
```

### 7.7 Verify & Repair (Corruption Fix)

```
User clicks "Verify & Repair" on a corrupted disk
  │
  ├─ 1. For each corrupted pixel (detected via checksum):
  │     │
  │     ├─ PHASE 1 — Inputs to Calc Engine:
  │     │   ├─ Healthy data pixels from other disks fly → input slots
  │     │   ├─ Parity pixel flies → input slot
  │     │   └─ Corrupted pixel shown in input slot with purple "corrupted" badge
  │     │
  │     ├─ PHASE 2 — Recomputation:
  │     │   ├─ Formula: "Recompute D₁ = P ⊕ D₀ ⊕ D₂"
  │     │   ├─ "Expected: 0xA3, Found: 0xE3"
  │     │   └─ "Bit 6 flipped (00100000₂)"
  │     │
  │     └─ PHASE 3 — Output:
  │         ├─ Corrected pixel appears in output slot (green glow)
  │         └─ Pixel flies to disk, old corrupted pixel fades out, new one fades in
  │
  ├─ 2. Disk status → 🟢 Healthy (corruption markers removed)
  └─ 3. Volume Preview confirms image intact
```

---

## 8. Animation System

All animations use **GSAP** for timeline control and interruptibility. The central principle is: **every computation is visually routed through the Calculation Engine panel**.

### 8.1 Pixel Flight System

All pixel movements use "flying pixel" clones — absolutely-positioned elements that animate from source → target coordinates:

```typescript
interface PixelFlight {
  value: number              // 8-bit pixel value
  from: { x: number, y: number }  // source screen coords (disk slot or image)
  to: { x: number, y: number }    // target screen coords (Calc Engine slot or disk slot)
  duration: number           // ms, scaled by animation speed
  easing: string             // GSAP easing
  onArrive: () => void       // callback: fill target slot, update state
}
```

Flying pixels are rendered as colored squares with a subtle trailing glow. Multiple pixels can be in flight simultaneously (staggered).

### 8.2 Calculation Engine Animation Sequence

```
┌─ TIMELINE ─────────────────────────────────────────────────────────┐
│                                                                     │
│  t=0ms     Input pixels begin flying to Calc Engine                 │
│  t=300ms   All inputs landed → input slots filled                   │
│  t=400ms   Formula Line 1 types in (symbolic)                       │
│  t=600ms   Formula Line 2 types in (hex values)                     │
│  t=800ms   Formula Line 3 types in (binary expansion)               │
│  t=1000ms  Formula Line 4: result highlights with glow              │
│  t=1100ms  Output slot fills with result pixel + pulse              │
│  t=1200ms  Output pixel begins flying to target disk                │
│  t=1550ms  Output pixel lands → disk slot fills                     │
│  t=1600ms  Calc Engine clears, ready for next byte position         │
│                                                                     │
│  (At 2× speed: all durations halved)                                │
│  (At speed > 3×: batch mode — pixels land instantly, formula flash) │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.3 Animation Catalog

| Animation | Trigger | Duration (1×) | Visual Effect |
|---|---|---|---|
| Data pixel fly (image → disk) | Image drop | 400ms | Colored square translates with overshoot easing |
| Input pixel fly (disk → Calc Engine) | Parity/recovery calc | 300ms | Clone flies with trailing glow, staggered 80ms per input |
| Formula line reveal | Calc Engine active | 200ms/line | Typewriter left-to-right, monospace font |
| Result highlight | Computation complete | 250ms | Output slot glows (gold for parity, blue for recovery, green for repair) |
| Output pixel fly (Calc Engine → disk) | Result ready | 350ms | Pixel flies to target with ease-out |
| Failed output "✕" | Recovery impossible | 400ms | Red cross fades in with shake animation |
| Missing input "?" | Disk unavailable | 200ms | Red-tinted "?" placeholder fades in with dashed border |
| Connection lines | Hover inspect | 200ms | Dashed/solid animated SVG lines between related pixels |
| Disk shatter | Click 💀 Remove | 600ms | Pixels fragment outward and fade |
| Cosmic ray zap | Click ☢️ | 300ms | Lightning bolt + hue rotation flash |
| Blue rebuild sweep | During rebuild | Continuous | Blue gradient sweeps down disk column |
| Stripe highlight | Hover stripe row | 150ms | Background tint pulse |

### 8.4 Speed Modes

| Speed | Behavior |
|---|---|
| 0.25× – 0.5× | Full choreography, extra slow — ideal for teaching |
| 1× | Default timing as described above |
| 2× | All durations halved, still full choreography |
| 3× | Abbreviated — inputs appear instantly, formula flashes, output flies quickly |
| 4× | Batch mode — entire stripe processes in one burst, minimal animation |

---

## 9. Data Model (Pinia Store)

```typescript
// store/volume.ts
interface VolumeState {
  algorithm: 'raid5' | 'raid6' | 'reed-solomon'
  dataDisks: number
  parityDisks: number
  blockSize: number
  checksumAlgo: 'none' | 'xor8' | 'crc8' | 'crc32'
  primitivePolynomial: number
  animationSpeed: number
  autoAnimate: boolean
}

// store/disks.ts
interface DiskState {
  id: number
  status: 'healthy' | 'failed' | 'degraded' | 'rebuilding' | 'corrupted' | 'empty'
  role: 'data' | 'parity'          // per-stripe role varies in RAID 5
  pixels: Uint8Array                // raw pixel data on this disk
  checksums: Uint8Array             // per-block checksums
  corruptedPixels: Set<number>      // indices of known-corrupted pixels
}

// store/images.ts
interface ImageAsset {
  id: string
  name: string
  width: number
  height: number
  pixels: Uint8Array                // flat 8-bit color values
  thumbnail: string                 // data URL for preview
}

// store/calcEngine.ts  (was inspector.ts)
interface CalcEngineState {
  visible: boolean
  pinned: boolean
  mode: 'idle' | 'parity' | 'recovery' | 'failed-recovery' | 'repair' | 'hover'
  // Input slots
  inputs: CalcInput[]               // ordered list of input pixels
  // Formula
  formulaLines: FormulaLine[]       // lines to render sequentially
  currentLine: number               // which line is currently animating
  // Output slots
  outputs: CalcOutput[]             // result pixel(s) or failure markers
  // Metadata
  stripeIndex: number
  bytePosition: number
}

interface CalcInput {
  disk: number                      // source disk index (-1 if missing)
  value: number | null              // pixel value (null if missing → show "?")
  label: string                     // e.g. "D₀", "P", "Q"
  status: 'filled' | 'missing' | 'corrupted' | 'pending'
}

interface CalcOutput {
  value: number | null              // result value (null if failed → show "✕")
  label: string                     // e.g. "P", "Q", "D₁ recovered"
  targetDisk: number                // where the output flies to
  status: 'computed' | 'failed'
}

interface FormulaLine {
  text: string                      // LaTeX or monospace text
  type: 'symbolic' | 'hex' | 'binary' | 'result' | 'error'
  delay: number                     // ms delay before this line appears
}
```

---

## 10. Component Tree

```
App.vue
├── AppHeader.vue
├── MainLayout.vue
│   ├── ImageLibraryPanel.vue
│   │   ├── ImageCard.vue (×N, draggable)
│   │   └── ImageUploader.vue
│   ├── CenterPanel.vue
│   │   ├── VolumeConfigBar.vue
│   │   │   ├── AlgorithmSelector.vue
│   │   │   ├── DiskCountSlider.vue
│   │   │   ├── BlockSizeSelector.vue
│   │   │   └── AnimationControls.vue
│   │   ├── VolumePreview.vue            # Original / On-Disk / Reconstructed image comparison
│   │   ├── DiskArrayView.vue
│   │   │   └── DiskColumn.vue (×N)
│   │   │       ├── DiskHeader.vue
│   │   │       ├── PixelGrid.vue (canvas)
│   │   │       └── DiskActionBar.vue
│   │   ├── ConnectionLines.vue (SVG overlay)
│   │   └── FlyingPixelLayer.vue         # Absolutely-positioned flying pixel clones
│   └── CalcEnginePanel.vue              # The Calculation Engine (was MathInspectorPanel)
│       ├── InputSlots.vue               # Left: landing zone for input pixels
│       ├── FormulaDisplay.vue (KaTeX)   # Center: animated formula
│       ├── OutputSlots.vue              # Right: result pixel(s) or ✕
│       ├── StepByStepView.vue
│       └── BinaryHexView.vue
├── GaloisFieldExplorer.vue (modal)
│   ├── GFMultiplicationTable.vue
│   ├── GFCalculator.vue
│   └── GFPolynomialView.vue
└── StatusBar.vue
```

---

## 11. Color & 8-Bit Palette

The app uses a **fixed 256-color palette** (similar to the classic 8-bit RGB palette: 3 bits red, 3 bits green, 2 bits blue).

```
Pixel value 0x00–0xFF → maps to a specific RGB color
R = ((value >> 5) & 0x07) * 36     // 0–252
G = ((value >> 2) & 0x07) * 36     // 0–252
B = ((value)      & 0x03) * 85     // 0, 85, 170, 255
```

This means:
- Every byte value has a distinct, visible color
- Parity bytes naturally produce colors (so parity data is visually meaningful)
- XOR operations create visually interesting parity patterns
- Bit-flips cause visible color changes

---

## 12. Responsive & Accessibility

- **Min viewport**: 1280×720 (desktop-first; tablet landscape supported)
- **Keyboard navigation**: Tab through disks, Enter to select pixel, arrow keys to move
- **Screen reader**: ARIA labels on all interactive elements; Math Inspector has text-only mode
- **Color-blind safe**: Disk status uses both color AND icon; pixel values shown in hex on hover
- **Dark theme** default (easier on eyes for pixel art); optional light theme toggle

---

## 13. Project Structure

```
DeveDiskRecoverySimulator/
├── public/
│   └── images/               # Pre-loaded pixel art PNGs
├── src/
│   ├── assets/
│   │   └── palette.ts        # 8-bit color palette definition
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppHeader.vue
│   │   │   ├── MainLayout.vue
│   │   │   └── StatusBar.vue
│   │   ├── library/
│   │   │   ├── ImageLibraryPanel.vue
│   │   │   ├── ImageCard.vue
│   │   │   └── ImageUploader.vue
│   │   ├── volume/
│   │   │   ├── VolumeConfigBar.vue
│   │   │   ├── AlgorithmSelector.vue
│   │   │   ├── DiskCountSlider.vue
│   │   │   └── AnimationControls.vue
│   │   ├── disks/
│   │   │   ├── DiskArrayView.vue
│   │   │   ├── DiskColumn.vue
│   │   │   ├── DiskHeader.vue
│   │   │   ├── PixelGrid.vue
│   │   │   ├── DiskActionBar.vue
│   │   │   └── ConnectionLines.vue
│   │   ├── inspector/
│   │   │   ├── MathInspectorPanel.vue
│   │   │   ├── FormulaDisplay.vue
│   │   │   ├── StepByStepView.vue
│   │   │   └── BinaryHexView.vue
│   │   └── galois/
│   │       ├── GaloisFieldExplorer.vue
│   │       ├── GFMultiplicationTable.vue
│   │       ├── GFCalculator.vue
│   │       └── GFPolynomialView.vue
│   ├── engine/
│   │   ├── gf256.ts           # Galois Field GF(2⁸) arithmetic
│   │   ├── raid.ts            # RAID 5/6 stripe + parity logic
│   │   ├── reedsolomon.ts     # Reed-Solomon encoding/decoding
│   │   ├── checksum.ts        # CRC / XOR checksum implementations
│   │   └── types.ts           # Shared types for engine
│   ├── stores/
│   │   ├── volume.ts          # Volume configuration state
│   │   ├── disks.ts           # Disk array state
│   │   ├── images.ts          # Image library state
│   │   └── inspector.ts       # Math inspector state
│   ├── composables/
│   │   ├── usePixelDrag.ts    # Drag & drop image → volume
│   │   ├── useAnimation.ts    # GSAP animation orchestration
│   │   ├── usePixelFlight.ts  # Flying pixel clone system (source → Calc Engine → target)
│   │   ├── useCalcEngine.ts   # Drives the Calc Engine: input → formula → output sequence
│   │   ├── useHoverInspect.ts # Pixel hover → instant Calc Engine populate (no flight)
│   │   └── usePixelGrid.ts    # Canvas rendering for pixel grids
│   ├── utils/
│   │   ├── palette.ts         # 8-bit → RGB conversion
│   │   └── format.ts          # Hex/binary formatting helpers
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── DESIGN.md
```

---

## 14. Example Walkthrough: 8×8 Image on RAID 5 (3+1)

1. **Image**: 8×8 = 64 pixels, each 1 byte → 64 bytes total
2. **Config**: RAID 5, 3 data disks + 1 parity, block size = 32 pixels
3. **Stripe 0**: 
   - Pixels 0–31 split: D0 gets px[0–10], D1 gets px[11–21], D2 gets px[22–31] *(~10-11 each)*
   - *Actually with block_size = 32*: each stripe = 3 × 32 = 96 data pixels. Our 64-pixel image fits in 1 stripe (padded).
4. **Rebalanced for 8×8**: With block size = 8:
   - Each stripe = 3 data disks × 8 pixels = 24 data pixels per stripe
   - Stripe 0: D0=[px 0–7], D1=[px 8–15], D2=[px 16–23], P=[parity of those 24 bytes, 8 bytes XOR'd column-wise]
   - Stripe 1: D0=[px 24–31], D1=[px 32–39], P=[parity], D2=[px 40–47]  *(parity rotated)*
   - Stripe 2: D0=[px 48–55], P=[parity], D1=[px 56–63], D2=[padded zeros]  *(parity rotated again)*
5. **Visualization**: Each disk column shows its 8-pixel blocks stacked vertically. Parity blocks are rendered in their computed colors. Stripe boundaries have thin divider lines.

### Math for Stripe 0, Parity byte 3:

$$P_3 = D_{0,3} \oplus D_{1,3} \oplus D_{2,3}$$

If $D_{0,3} = \texttt{0xA3}$, $D_{1,3} = \texttt{0x7F}$, $D_{2,3} = \texttt{0x12}$:

$$P_3 = \texttt{10100011}_2 \oplus \texttt{01111111}_2 \oplus \texttt{00010010}_2 = \texttt{11001100}_2 = \texttt{0xCC}$$

---

## 15. Failure Scenarios Supported

| Scenario | Min Algorithm | Recovery Method |
|---|---|---|
| 1 disk lost | RAID 5 / RS(n,1) | XOR remaining data + parity |
| 2 disks lost | RAID 6 / RS(n,2) | Solve 2-equation system over GF(2⁸) |
| 3+ disks lost | RS(n,k) with k≥3 | Matrix inversion over GF(2⁸) |
| Silent corruption (1 disk) | Any + checksum | Checksum detects → parity corrects |
| Silent corruption (no checksum) | N/A | Undetectable — demonstrated as a lesson |
| Too many failures | Any | "UNRECOVERABLE" — red screen, data gone |

---

## 16. Future Enhancements (Out of Scope for v1)

- **RAID 0 / RAID 1** modes (for comparison)
- **Network simulation** (latency on disk reads)
- **Performance metrics** panel (rebuild time, throughput)
- **Tutorial / guided walkthrough** mode
- **Export/share** configuration as URL
- **Mobile support**

---

## 17. Acceptance Criteria

### Calculation Engine (Core)
- [ ] Calc Engine has three visible zones: Input Slots, Formula Area, Output Slots
- [ ] During parity generation, data pixels visually fly from disks into Calc Engine input slots
- [ ] Formula animates line-by-line (symbolic → hex → binary → result)
- [ ] Output pixel(s) appear in output slot(s) and fly to the target parity disk
- [ ] RAID 5: 3 input pixels → 1 output pixel (P)
- [ ] RAID 6: 3 input pixels → 2 output pixels (P, Q) computed sequentially
- [ ] Reed-Solomon: N input pixels → K output pixels
- [ ] During recovery, surviving pixels + parity fly to Calc Engine, recovered pixel flies out
- [ ] Missing inputs shown as `?` with red dashed border in their input slot
- [ ] Failed recovery shows `✕` (red cross) in output slot — no pixel emitted
- [ ] Hover inspection fills Calc Engine instantly (no flight animation)

### Image & Distribution
- [ ] User can drag a pixel-art image from the library onto the volume
- [ ] Data pixels animate to their assigned disk positions before parity calculation begins
- [ ] Parity pixels are correctly computed and displayed as colors
- [ ] RAID 5 parity rotation is visually apparent across stripes
- [ ] RAID 6 shows both P (XOR) and Q (GF weighted sum) parity
- [ ] Reed-Solomon mode allows configurable parity disk count

### Volume Preview
- [ ] Volume Preview shows Original, On-Disk, and Reconstructed image side by side
- [ ] On-Disk image shows black holes for pixels on failed disks
- [ ] Reconstructed image shows parity-recovered pixels where possible
- [ ] Diff stats update live on every state change

### Failure & Recovery
- [ ] Removing a disk triggers degraded mode visuals
- [ ] Rebuilding a disk routes each recovery through the Calc Engine with full animation
- [ ] Rebuilding with insufficient disks shows `?` inputs and `✕` output per byte
- [ ] Cosmic ray flips bits and the corruption is visually identifiable
- [ ] Verify & Repair routes correction through the Calc Engine
- [ ] Checksum correctly detects silent corruption

### General
- [ ] GF Explorer shows multiplication tables and polynomial representations
- [ ] All animations are smooth (60fps) and speed-adjustable
- [ ] Speed > 3× uses batch mode (abbreviated animation)
- [ ] Calc Engine renders KaTeX formulas for every operation
