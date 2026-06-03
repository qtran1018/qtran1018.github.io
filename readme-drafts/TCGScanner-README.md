# TCG Card Scanner

A mobile app that identifies trading cards by pointing a camera at them and instantly retrieves pricing and recent sales data. Supports both English and Japanese Pokémon cards across all eras.

> **Demo videos:** [Multi-scan](https://www.youtube.com/embed/mVWX6n-BG2c) (photograph up to 20 cards at once) · [Live scan](https://www.youtube.com/embed/uBOjM4HuF94) (continuous 1-by-1 identification in real time)

The app runs a multi-model AI pipeline: YOLO detects individual card boundaries in the frame, ML Kit reads the card text on-device, and a fine-tuned CLIP model matches the card visually — all three fused together to produce the most accurate identification. Prices, recent sales, and trend graphs are scraped live from PriceCharting and cached in Redis. Language is detected automatically per card in a mixed scan; no user toggle required for multi-card scans.

The project grew iteratively across 31 versions — from a single-card OCR scanner to a multi-model streaming pipeline with custom-trained object detection, a fine-tuned visual embedding model, and a live continuous scanning mode. Each version was a direct response to a concrete failure in the previous one.

> **By the numbers:** 31 iterations · 47,442 cards indexed (20,187 EN + 27,255 JP) · YOLO11n mAP50-95 0.964 · CLIP ViT-B/32 fine-tuned (512-dim embeddings) · ~700–900 ms live-scan cycle

---

## Inspiration

Two existing apps defined the target experience and directly influenced architectural decisions:

- **Skanit** — A card scanning app that identifies Pokémon cards from photos and shows pricing data. Skanit's core concept (point a camera, get prices instantly) is the direct inspiration for this project. The goal was to understand how that pipeline works end-to-end and build it from scratch, making different tradeoffs: prioritising Japanese card support, open model training, and a custom fine-tuned CLIP model rather than relying on third-party recognition APIs.
- **DeckTradr** — A deck-building and trading tool with a live continuous scanning mode. DeckTradr's live scan architecture (the camera runs in a loop, each frame sent to the server for identification without a stability gate or manual trigger) directly inspired the v30 live scan rewrite. The key insight adopted is the *single-roundtrip design*: one snapshot, one backend call that handles both detection and recognition, result back in under a second. Previous live scan versions used a two-step loop (detect position → capture photo → recognise), which was slower and less reliable.

---

## Scan-to-Price Flow

Two scanning modes are available, both ending at the same price screens.

### Multi-card batch scan

1. User opens the Multi Scan tab and captures a photo of a spread of cards.
2. **On device:** image resized to 2400px JPEG → YOLO TFLite model detects card bounding boxes (NNAPI on Android, CoreML on iOS) → ML Kit OCR runs on the full image with Japanese script recognition.
3. **Spatial filter:** OCR text blocks are filtered to each card's bounding box without re-running OCR per crop — name region (top 18%), number region (bottom 8% corners), and full crop text extracted from the single full-image OCR pass.
4. **Language detection:** a kana regex on each crop's name-region text classifies each card as English or Japanese independently.
5. **Backend call:** full image base64 + bounding boxes + OCR hints → `POST /api/v1/scan`. Backend slices crops from the image server-side, batches all CLIP embeddings in one forward pass, runs pgvector nearest-neighbour searches and OCR text searches in parallel via `asyncio.gather`.
6. **Streaming results:** backend emits one NDJSON line per card as it resolves. Mobile parses the stream over XHR — first card appears in the UI while the last crop is still being processed.
7. **Results screen:** each card shows its name, set, image, and match source (OCR / Image AI / Both). User can swap to an alternate candidate, select cards for batch pricing, or save to a collection.
8. **Price screen:** ungraded, PSA 7/8/9/10 prices, recent sales with eBay/TCGPlayer links, and a trend chart — all scraped from PriceCharting and cached 24h in Redis. USD/JPY currency toggle converts all values instantly.

### Live continuous scan

1. User opens the Live Scan tab, sets the language toggle (EN or JP), and taps Start.
2. The scan loop begins: `takeSnapshot({ quality: 80 })` → resize to 640px JPEG → `POST /api/v1/scan` with the image and no boxes field.
3. **Backend auto-detect path:** YOLO finds the largest card in the frame, crops tightly to it, runs CLIP on the crop. Single result returned. Falls back to full image if YOLO finds nothing.
4. **Confirmation gate:** a card must be the top match on two consecutive scans before being added to the session list — prevents transient phantom cards during physical card transitions (motion blur, overlapping cards mid-swap).
5. **Deduplication:** each card ID is suppressed for 30 seconds after being added — the camera can stay still on one card without flooding the session list.
6. Cards appear in the session list in real time with a background price fetch. The running total of all session card prices is shown at the bottom.
7. User taps Done → session cards deduplicated by card ID → batch price screen shows all scanned cards' prices simultaneously.

Cycle time: ~700–900ms per scan (backend recognition is the natural rate limiter; next snapshot starts immediately when the previous result arrives).

### Manual card lookup

1. User opens the Search tab, types a card name (partial names work).
2. Debounced query (400ms, min 2 chars) → `GET /api/v1/cards/search` → fuzzy trigram search via PostgreSQL `pg_trgm`.
3. Results ranked by name similarity with a first-word penalty (prevents "mew vstar" from surfacing Mewtwo above Mew) and a set-hint bonus (set name tokens boost matching-set cards).
4. Tapping a result opens the same price screen as a scan.

---

## Key Features

- **📷 Multi-card batch scanning** — Capture an entire spread of cards in one photo. YOLO detects each card's bounding box, OCR and CLIP run per crop, then results stream back to the UI card-by-card as they complete — no waiting for the whole batch. Latency benchmark: 3.12s for the first card in a 12-card scan on a Samsung S22+.
- **🎥 Live continuous scanning** — Hold the camera over individual cards and they are identified automatically as they come into frame. No shutter tap, no stability hold — cards appear in a growing session list in real time. Inspired by DeckTradr's single-roundtrip architecture. A consecutive-frame confirmation gate filters transient phantom cards during physical card transitions.
- **🤖 Three-mode recognition engine** — OCR mode reads card text (name, number, set total) and searches the database. Image AI mode converts the card art into a 512-dimensional visual embedding and finds the nearest match across 47,442 stored card vectors (20,187 EN + 27,255 JP). Combined mode runs both in parallel and merges ranked results using Reciprocal Rank Fusion — OCR weighted 2× over image signal, with weak image results gated out when OCR already found a confident answer.
- **🇯🇵 Japanese card support — auto detected** — All OCR runs with ML Kit's Japanese script, which returns both Latin and kana in one pass. A kana regex on each crop's text determines its language independently — a single photo of mixed EN and JP cards is handled correctly without any user toggle. Japanese card names are translated via a 1,028-entry kana-to-English dictionary, then searched against 27,255 JP cards stored as independent first-class database records scraped from TCGCollector.com (all eras, 1996–present). The live scan mode has a manual EN/JP toggle for the language-locked CLIP search, since OCR is not run in live mode.
- **🃏 Trainer, Supporter, Item, and Tool card support** — Non-Pokémon cards are identified by locating the standalone type keyword on the card (e.g. "Supporter"), then extracting the card name from the lines above it. Parenthetical subtitles are stripped ("Professor's Research (Professor Magnolia)" → "Professor's Research"). The mobile confidence scorer fast-passes any crop with a recognisable type keyword before the HP/keyword scoring path runs.
- **💰 Live pricing from PriceCharting** — Ungraded, PSA 7, PSA 8, PSA 9, and PSA 10 prices scraped per card, cached in Redis for 24 hours. Recent sales rows include direct links to the original eBay or TCGPlayer listings. Price trends rendered as a chart from PriceCharting's embedded JavaScript data. Card variants (1st Edition, Shadowless, Poké Ball, Master Ball) have separate price pages.
- **🗂️ Batch price lookup** — After scanning, select multiple cards and fetch market prices for all of them at once. Prices stream in via NDJSON — Redis cache hits arrive first (~10ms), uncached cards follow as they scrape (~1s each). Mixed EN and JP batches are priced correctly — each card uses its own language to build the PriceCharting URL.
- **💱 USD / JPY currency toggle** — A pill toggle on both the individual card and batch price screens converts all displayed values — market price, graded tiers, recent sales, and the trend chart — between USD and JPY instantly. The exchange rate is fetched from the Frankfurter API, cached in Redis for 24 hours, and shown inline as `1 USD = ¥X`. Designed for use at Japanese card shops.
- **🔖 Save to collections** — Any identified card can be saved to a named collection. An Instagram-style bottom sheet opens on the bookmark icon — cards are automatically added to the game's default collection (Pokémon or One Piece) and can optionally be added to multiple custom named lists simultaneously. Collections support list view and grid view, inline rename, and deletion. Saved card data persists locally via AsyncStorage.
- **🔍 Manual card search** — Fuzzy name search from the Search tab. Supports partial names, set hints (e.g. "pikachu prismatic"), card number filters, and exclusion terms (e.g. "pikachu -detective" drops Detective Pikachu set results). EN and JP tabs search independently — the JP tab checks both the English name and the Japanese kana name. Results show thumbnail, set, and card number.
- **⚡ Unified streaming backend** — A single `POST /scan` endpoint batches all CLIP embeddings in one forward pass, runs all pgvector and OCR searches in parallel via `asyncio.gather`, and streams results as NDJSON. The mobile client parses the stream incrementally over XHR, updating the UI as each card resolves.
- **🔎 Fuzzy name matching and set disambiguation** — OCR misreads like "Lotacl" or "Sulcune" are recovered by a PostgreSQL trigram similarity fallback (`pg_trgm`) when exact name search returns nothing. Set disambiguation uses a printed-total lookup across 172 sets to distinguish cards that share a name and number across different releases — e.g. Gastly #36 appears in both Fossil and Base Set 2.

---

## Architecture Evolution

Each version replaced something that demonstrably failed, not something that was merely inconvenient. The five biggest pivots:

### Card detection: OCR clustering → OpenCV → YOLO11n

The first multi-card approach grouped OCR text blocks by spatial proximity to infer where cards were. It failed completely when cards had no visible text (holofoil, face-down, or rotated) and produced garbage bounding boxes when cards touched or overlapped.

OpenCV adaptive-threshold contour detection was added as the first real detector. It worked on plain card-on-desk photos but collapsed on reflective holofoil surfaces — the specular highlights broke contour connectivity — and on colorful desk mats where the card edges couldn't be isolated.

YOLO11n replaced OpenCV entirely. Fine-tuned on a dataset assembled from three sources (own photos, two Roboflow community datasets, 1,688 images total after format conversion and merging), the model learns the physical card appearance regardless of surface finish. The OCR fallback remains in code if the model file is absent, but has not been needed since deployment.

### YOLO retraining with synthetic data (v2)

After the first YOLO model, real training data was cleaned — 27 set-symbol images mislabeled as cards, 103 orphaned label files, and all PSA slab photos were removed. A synthetic generation pipeline was built to produce composite images: card art downloaded from the database is pasted onto background photos (desk textures, glass display cases) at randomised positions, scales, and rotations, with bounding boxes recorded automatically. This requires no manual labeling.

Glass display case scenes were included at a 13% rate with a per-card blue-green tint to simulate glass colour cast. Card sampling was stratified — 45% EN Pokémon, 40% JP, 15% EN Trainer/Item — to match realistic scan conditions. The v2 model was fine-tuned from v1 weights to preserve real-photo learning and avoid catastrophic forgetting.

- **Dataset:** 1,225 real (cleaned) + 1,700 synthetic train images · 304 real + 300 synthetic val
- **Training:** 30 epochs · RTX 3080 · ~1.5 hours

| Metric | v1 (CPU, 50 epochs) | v2 (GPU, 30 epochs) |
|--------|--------------------|--------------------|
| mAP50 | 0.992 | 0.993 |
| mAP50-95 | 0.904 | **0.964 (+6.6%)** |
| Precision | 0.977 | 0.977 |
| Recall | 0.985 | 0.980 |

mAP50-95 measures bounding box quality at strict IoU thresholds (50–95%), not just whether the card was found. The +6.6% improvement means tighter, more precise crops — directly improving the quality of the card art region fed into CLIP downstream.

### Image embedding: EfficientNet → CLIP base → CLIP fine-tuned

The first image-based identification attempt used EfficientNet-B0 with PCA dimensionality reduction to 256 dimensions. Similarity scores ranged 0.45–0.58 — practically a random ranking. EfficientNet was designed for image classification, not cross-domain similarity between phone photos and card art.

Switching to CLIP ViT-B/32 raised scores to 0.78–0.86 for visually distinctive cards. CLIP is trained contrastively on image-text pairs, giving it a much stronger sense of visual similarity. However, it was trained on general internet images — it understands visual categories ("small round blue creature") but not specific card identity, reliably confusing visually similar Pokémon like Lotad and Seedot.

The root cause is a domain gap: CLIP has never seen a phone photo of a physical card next to a clean digital scan of the same card. Fine-tuning closed this gap by training on synthetic pairs — each pair consists of a clean official card art crop and an augmented simulation of what that card looks like photographed on a desk (perspective warp, colour jitter, Gaussian blur, JPEG compression artefacts, random background texture). Only the visual encoder was fine-tuned; the text encoder was frozen.

### Japanese card support: number-mapping overlay → first-class DB records

The initial JP implementation had no independent JP card records. When a JP card was identified, the system tried to look up its image by mapping the JP card number to a TCGCollector entry via the EN card's set and name. This was fundamentally broken: EN and JP numbering systems are completely independent. EN sets combine and alphabetically reorder cards from multiple JP sets — EN "BREAKthrough" Doduo #115 and JP "Collection Y" Doduo #46 are the same card, but there is no mathematical relationship between those numbers.

The result was that all JP swap candidates for a given Pokémon name returned the same wrong image — whichever JP card happened to be newest in the scrape order for that name.

The fix was architectural: 27,255 JP cards scraped from TCGCollector.com were loaded as independent `language='ja'` rows in the cards table. Each record carries its own image URL, card number (from TCGCollector, not derived from EN), and set name. JP OCR search and pgvector image search both filter by language — EN and JP pipelines are fully independent and never share card IDs.

### Backend API: three-call sequential pipeline → unified streaming endpoint

The original multi-card flow made three sequential network calls: `POST /detect` (YOLO bounding boxes) → `POST /search/batch` (OCR text search for all crops) → `POST /match-image` (CLIP embedding search for all crops). Each call waited for the previous one to finish, and the UI only updated after all three completed.

The unified `POST /scan` endpoint collapses all three into a single call. CLIP embeddings for all crops are computed in one batched forward pass. pgvector searches and OCR text searches for all crops run concurrently via `asyncio.gather`. Results are emitted as NDJSON — one JSON object per crop — as soon as each crop resolves. The mobile client parses the stream incrementally over XHR, so the first card appears in the UI while the last crop is still being processed.

### Live scan: stability-gated two-step loop → single-roundtrip DeckTradr-style

The first live scan implementation used a two-step loop: detect card position via backend `/detect` (~200–400ms), then capture a full photo and send it to `/scan` with the bounding box (~700ms). A 500ms stability hold was required before triggering. Total latency per card: 2–3 seconds, and on-device YOLO had JSI handle invalidation issues in the loop context, meaning every detection cycle hit the backend twice.

The rewrite adopted DeckTradr's single-roundtrip approach: one `takeSnapshot` with no stability gate, resize to 640px, `POST /scan` with only the image (no boxes). The backend handles detection and recognition in one pass — YOLO finds the largest card, crops it, runs CLIP, returns the result. On-device YOLO is not involved in live scan at all. Cycle time dropped to ~700–900ms with the backend as the natural rate limiter.

---

## AI Models & Training

### YOLO11n — Card Detection (fine-tuned, v2)

Fine-tuned from COCO pretrained weights on a mixed real-and-synthetic dataset. Detects card boundaries in phone photos regardless of surface finish, overlap, or background complexity. Deployed in two forms: full PyTorch weights on the backend server, and a float16 TFLite export on the mobile device (5.1MB; uses NNAPI on Android, CoreML on iOS, CPU fallback).

- **v1 dataset:** 1,688 images from three sources (own photos, TCG Detector Roboflow dataset, Aaron's Raw Photos dataset) — converted from mixed COCO/OBB/polygon formats to single-class YOLO bbox format via custom merge scripts.
- **v2 dataset:** v1 dataset cleaned (set-symbol images, PSA slab photos, and orphaned label files removed) and augmented with 2,000 synthetically generated composite images.
- **v1 training:** 50 epochs · imgsz 640 · batch 16 · AMD Ryzen 5 5600X (CPU only) · 3.68 hours
- **v2 training:** 30 epochs · fine-tuned from v1 weights · RTX 3080 · ~1.5 hours

| Metric | v1 | v2 | Target |
|--------|----|----|--------|
| mAP50 | 0.992 | 0.993 | > 0.85 |
| mAP50-95 | 0.904 | **0.964** | > 0.70 |
| Precision | 0.977 | 0.977 | — |
| Recall | 0.985 | 0.980 | — |
| Inference (CPU) | 33.9ms/img | — | — |

### CLIP ViT-B/32 — Visual Embedding (fine-tuned)

Converts a card crop into a 512-dimensional L2-normalised vector. pgvector finds the nearest match across all 47,442 embedded cards (20,187 EN + 27,255 JP) using an IVFFlat index (lists=100, probes=20). An art-region crop (y=12%–52% of the card height) focuses the embedding on the Pokémon illustration rather than the card border, text, or HP bar.

Fine-tuned on synthetic (clean card art, simulated phone photo) pairs using InfoNCE contrastive loss. Augmentation pipeline: paste card onto random background texture → perspective warp → colour jitter → Gaussian blur → JPEG compression → art-region crop. Only the visual encoder was fine-tuned (87.8M parameters); the text encoder was frozen.

**Training config:** 10 epochs · 82,964 pairs/epoch (20,741 cards × 4 augmentations) · AdamW lr=1e-5 · cosine LR schedule · temperature=0.07 · RTX 3080 · ~13 hours total

| Epoch | Loss | LR | Duration |
|-------|------|----|----------|
| 1 | 0.0255 | 9.76e-06 | 78 min |
| 2 | 0.0098 | 9.05e-06 | 77 min |
| 3 | 0.0099 | 7.96e-06 | 78 min |
| 4 | 0.0095 | 6.58e-06 | 78 min |
| 5 | 0.0088 | 5.05e-06 | 76 min |
| 6 | 0.0080 | 3.52e-06 | 77 min |
| 7 ★ best | 0.0077 | 2.14e-06 | 77 min |
| 8 | 0.0081 | 1.05e-06 | 77 min |
| 9 | 0.0083 | 3.42e-07 | 79 min |
| 10 | 0.0081 | 1.00e-07 | 82 min |

Best checkpoint saved at epoch 7 (loss 0.0077). All 47,442 cards re-embedded with fine-tuned weights; IVFFlat index rebuilt. 50 EN cards unembeddable due to broken CDN URLs (McDonald's Collection promos — images replaced by scraping TCGCollector directly).

### Google ML Kit OCR — On-Device Text Recognition

On-device text recognition running entirely on the phone — no network call, no added latency. Configured with Japanese script recognition, which returns both Latin and kana characters in a single pass. A kana regex on each crop's OCR output determines per-crop language automatically, allowing a single photo of mixed EN and JP cards to be scanned without any user input.

A spatial filter approach extracts relevant text per card from a single full-image OCR pass — no per-crop ML Kit calls. Name region (top 18%), card number region (bottom 8%, left and right corners), and full card text are all derived by spatially filtering the block list from one call. A dedicated bottom-strip OCR pass (ML Kit LATIN mode) runs in parallel for card number extraction, which the full-image pass misses at small sizes.

Japanese card names go through a 1,028-entry kana-to-English dictionary before hitting the database. Owner-prefix cards ("Misty's Gyarados", "Sabrina's Gengar") have the owner stripped before search then re-matched by substring. Fuzzy trigram fallback via `pg_trgm` recovers common OCR misreads (similarity threshold 0.35).

### react-native-fast-tflite — On-Device YOLO Inference

The YOLO model is exported to float16 TFLite for on-device inference in the multi-card scan path. Export chain: PyTorch → ONNX → TensorFlow SavedModel (via onnx2tf) → float16 TFLite. The ultralytics direct TFLite export was not used — it segfaults on this model architecture. The mobile library `react-native-fast-tflite` (v2) runs with NNAPI delegate on Android (routes to Hexagon DSP / NPU / GPU depending on device), CoreML on iOS, and CPU as fallback.

On-device inference allows the multi-card scan to detect all card boundaries before making any network call, so the single backend request already knows exactly where to crop — no separate detect roundtrip. YOLO is not used in the live scan path, where detection is handled server-side in the same roundtrip as recognition.

---

## Known Limitations

- **GPU required for acceptable backend latency** — CLIP ViT-B/32 inference (the visual embedding step) is the primary latency bottleneck. On an RTX 3080, a batch of 12 card crops takes ~200ms. On CPU only, the same batch takes ~3–5 seconds — pushing total multi-scan latency from ~3s to ~8–12s and live scan cycle time from ~800ms to ~5–8s. A CPU-only deployment is technically possible for demo/portfolio purposes by setting `device = "cpu"` in the embedder and removing the fp16 cast, at the cost of impractical live-scan latency.
- **Holofoil and reflective cards are unreliable in image AI mode** — Reflective surfaces produce wildly different visual appearances depending on angle and lighting. Synthetic training data cannot replicate specular reflections, so the CLIP embedding of a holofoil card under a lamp looks nothing like its training pair. OCR or Combined mode is recommended for these cards.
- **Older Japanese sets (pre-2003) have incorrect PriceCharting URLs** — PriceCharting uses the Pokédex number as the card identifier for pre-EX era JP sets, while the app uses the card's set position. Prices for these older sets return 404. Fixing this would require a Pokédex-number lookup table or scrape-based URL discovery per card.
- **Sleeved cards reduce YOLO detection reliability** — The YOLO training data contains no sleeved cards. Penny/deck sleeves add a clear or matte border that changes the learned appearance. Detection still works in many cases but false negatives increase, particularly with opaque sleeves.
- **NNAPI handle invalidation on Android (first scan after app state change)** — On Android, the NNAPI native model handle for on-device YOLO can go stale after a fast refresh, app backgrounding, or GC. The first `model.run()` after invalidation throws a native exception; the recovery path (reset model cache → retry NNAPI → force CPU delegate) reliably recovers on the second attempt. Does not affect the live scan path.
- **Kana-heavy cards with minimal OCR text are unreliable** — Some JP cards (e.g. Abra) have very short kana names and no strong OCR anchor. When OCR confidence and CLIP similarity are both below threshold, zero candidates are returned. These cards require Combined mode and good lighting.
- **Trainer/Item cards with digits in their name are not OCR-identified** — The OCR name extraction rejects candidate names containing digits (to avoid picking up damage numbers, HP, card numbers). Cards like "Pokégear 3.0" and "Timer Ball" fall into this exclusion; they can still be found via image AI or manual search.

---

## Future Improvements

- **One Piece TCG expansion** — The schema, OCR pipeline, and price UI are already game-agnostic (`cards` table has a `game` column). Before shipping, pgvector search needs a `Card.game == game` filter, and CLIP would need retraining on combined Pokémon + One Piece pairs to avoid catastrophic forgetting. The game selector already exists in the scan store.
- **Batch save from multi-scan results** — A "Save Selected" action to batch-save all checked cards (same selection set driving "Get Prices") in one tap.
- **Collection value — per-list and overall totals** — A "Get Value" button per collection triggering a streaming price fetch with a running total (reusing the existing `api.streamPrices` NDJSON path), plus an overall portfolio valuation across collections.
- **Collection list reordering and card sorting** — Drag-to-reorder saved lists; in-list sort by date saved, name, set, or card number via `useMemo` local state.
- **Per-game separation of history and lists** — Filter history/saved views by a game tab. The backend history endpoint already accepts `?game=`, and collections are already tagged with a `game` field.
- **CLIP fine-tuning on real card photos** — Training on actual photos of physical cards would close the remaining domain gap, particularly for holofoil/foil variants synthetic augmentation cannot replicate. Reuses the existing InfoNCE pipeline.
- **YOLO retraining with sleeved cards** — Adding sleeved examples (real or synthetic sleeve overlays) would improve detection for the majority of collectors who use sleeves. The synthetic generation pipeline already supports custom overlays.
- **PSA graded card recognition** — Read the PSA grade from the label, identify the card name, then query the PSA population report to narrow cert candidates. Target scenario: Japanese card shops that cover cert numbers with price stickers.
- **CPU-only backend for free deployment** — For portfolio/demo purposes, CLIP and YOLO can run on CPU (set `device = "cpu"`, remove the fp16 cast). Free tiers (Railway, Render, Neon, Upstash) would cover the full stack, at the cost of slower scan latency.

---

## Tech Stack

**Mobile (Frontend)**
- TypeScript · React Native · Expo (SDK 54)
- Expo Router — file-based navigation
- Zustand — global scan state, saved cards, collections (persisted via AsyncStorage)
- Google ML Kit (`@react-native-ml-kit/text-recognition`) — on-device OCR, Japanese + Latin scripts
- react-native-fast-tflite (v2) — on-device YOLO11n TFLite inference (NNAPI / CoreML / CPU)
- react-native-vision-camera (v4) — camera viewfinder and snapshot for live scan
- expo-image-manipulator — JPEG resize and crop
- react-native-chart-kit — price trend graphs
- react-native-reanimated + react-native-gesture-handler — bottom sheet animations
- axios — REST API calls; raw XMLHttpRequest for NDJSON stream parsing

**Backend**
- Python · FastAPI · SQLAlchemy (async) · Pydantic v2
- open-clip-torch — CLIP ViT-B/32 inference (fp16 CUDA) and fine-tuning
- Ultralytics — YOLO11n training and server-side inference
- Playwright — TCGCollector.com scraper (JP card metadata and images)
- httpx + BeautifulSoup + brotlicffi — PriceCharting scraper (0.5s rate limit)
- asyncio — parallel crop processing, concurrent pgvector + OCR searches per batch

**Database & Caching**
- PostgreSQL with pgvector — 47,442 card records (20,187 EN + 27,255 JP) and 512-dim CLIP embeddings; IVFFlat index (lists=100)
- pg_trgm — fuzzy trigram name search with GIN index
- Redis — price cache (24h TTL), search result cache (1h TTL), exchange rate cache (24h TTL)

**Infrastructure**
- Docker / Docker Compose — local dev environment (backend, postgres, redis, worker)
- pokemontcg.io API — EN card metadata and hi-res images
- TCGCollector.com — JP card data (27,255 cards, all eras 1996–present)
- PriceCharting — pricing, sales history, trend data (scraped, cached 24h)
- Frankfurter API — USD/JPY exchange rate (cached 24h)

---

## Attributions & Third-Party Notices

### Training Datasets

The YOLO11n card-detection model was fine-tuned on a combined dataset of own photos plus the following community contributions. Both datasets were converted from their original formats (COCO / YOLO polygon / YOLO OBB) to single-class YOLO bounding-box format via custom merge scripts. No modifications were made to the underlying image content.

- **TCG Detector** — Roboflow Universe. License: CC BY 4.0. Source: <https://universe.roboflow.com/tcg-detector/pokemon-card-detection-7aaz7-mxbhx>
- **Aaron's Raw Photos** — Roboflow Universe. License: CC BY 4.0. Source: <https://universe.roboflow.com/aaron-qwuzu/pokemon-cards-63wlp/dataset/5>

### Models

- **YOLO11n (Ultralytics)** — License: AGPL-3.0. Source: <https://github.com/ultralytics/ultralytics>. The fine-tuned weights (`card_detector.pt`) are derivative of YOLO11n and subject to AGPL-3.0.
- **CLIP ViT-B/32 (OpenAI, via open-clip-torch)** — License: MIT. Source: <https://github.com/mlfoundations/open_clip>. The visual encoder was fine-tuned on a synthetic pair dataset; fine-tuned weights (`clip_finetuned.pt`) remain under MIT.

### Data Sources

- **pokemontcg.io** — EN card metadata and official artwork, retrieved via API and cached locally. Used under the pokemontcg.io Terms of Service.
- **PriceCharting.com** — trading-card prices, sales history, and trend graphs scraped on demand and cached 24 hours. Used for personal/research purposes. All price data remains property of PriceCharting.
- **TCGCollector.com** — Japanese card metadata, set lists, card numbers, and artwork. Used for personal/research purposes. All card metadata remains property of TCGCollector and the original card publishers.

### Notable Open-Source Dependencies

| Package | License |
|---------|---------|
| FastAPI | MIT |
| SQLAlchemy | MIT |
| asyncpg | Apache-2.0 |
| pgvector | PostgreSQL |
| Pydantic | MIT |
| Playwright | Apache-2.0 |
| open-clip-torch | MIT |
| PyTorch | BSD-3-Clause |
| Pillow | MIT-CMU |
| ultralytics | AGPL-3.0 |
| React Native | MIT |
| Expo | MIT |
| Zustand | MIT |
| react-native-fast-tflite | MIT |
| @react-native-ml-kit/text-recognition | MIT |
| react-native-chart-kit | MIT |

### Trademarks

Pokémon, Pokémon character names, and all related properties are trademarks of Nintendo, Game Freak, and Creatures Inc. One Piece and related properties are trademarks of Shueisha and Bandai. This project is an independent personal project and is not affiliated with, endorsed by, or sponsored by any of the above rights holders.
