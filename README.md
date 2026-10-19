# PrimeFeed — Personalized Marketplace Feed

**PrimeMarket.lk | Full Stack Developer Intern technical assessment**

A minimal full-stack MERN application that remembers two fictional users' marketplace interactions and produces **explainable, user-specific recommendations** for properties and vehicles. Includes optional private Amazon S3 storage for five small fictional listing illustrations. No authentication, checkout, ML, or paid hosting is needed.

## Assessment checklist

- [x] Two switchable test users; selection persists in browser localStorage (a convenience only)
- [x] Real persistent interactions in MongoDB, scoped to the selected user
- [x] 24 fictional listings (12 property + 12 vehicle), with category-specific fields
- [x] Three interaction types: `view`, `save`, `contact`
- [x] Backend `/api/feed` that ranks unseen listings and explains why
- [x] First-time discovery feed, user isolation, and repeat-click handling
- [x] Private S3 integration through backend, five images under 1 MB
- [x] Local image mock option for development (submission use requires recruiter approval)
- [x] Six automated backend recommendation tests
- [ ] **Candidate action:** Demonstrate real S3 access OR obtain explicit mock approval
- [ ] **Candidate action:** Run end-to-end with MongoDB, capture proof, push public GitHub repository

## Local prerequisites

- Node.js **20+**, npm, and **MongoDB** (local Community Edition or a no-cost, already-approved connection). Do not enable paid services.
- For **real** S3, an AWS account with verified no-cost eligibility or recruiter-provided access. The assessment explicitly prohibits spending.

## Quick start (two terminals)

**Backend terminal:**

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your real MONGODB_URI. Local Mongo example is already provided.
npm run seed
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env` instead of `cp` if needed. MongoDB must already be running when you seed and start the server. Rerunning seed will update sample listings and **preserve activity history**.

**Frontend terminal:**

```bash
cd client
npm install
npm run dev
```

Open <http://localhost:5173>. The backend starts at <http://localhost:4000>. For a different server URL, create `client/.env` from `client/.env.example` and change `VITE_API_URL`.

### Simple demonstration

1. Select **Asha Fernando**. Save `Lakeview Apartment` and View one more Colombo apartment. Her refreshed feed now prefers **similar property listings**.
2. Switch to **Nimal Perera**. Contact `Toyota Aqua 2018` and Save another Toyota vehicle. His refreshed feed now prefers **vehicles**, especially Toyota and Kandy.
3. Refresh the page, close/reopen the browser, and switch between users. The relevant feed remains personalized because the interactions live in **MongoDB**. LocalStorage stores only the *selected test user ID*, not the activity.
4. Each listing shows a brief `why` explanation. Saved/contacted/viewed listings are shown **after** unseen items, not omitted, so you can still see their status.

To return both users to a true cold start, intentionally clear **only the Interaction collection** (`db.interactions.deleteMany({})`) through MongoDB Shell/Compass. The seed command intentionally does not erase it.

## Architecture

```text
React/Vite (port 5173)
  ├── GET /api/users ──────────────────────── Express/Node (port 4000)
  ├── GET /api/feed?userId=... ──────────────> MongoDB listings + interactions
  ├── POST /api/interactions ────────────────> MongoDB idempotent upsert
  └── GET /api/listings/:id/image ───────────> private Amazon S3 GetObject
                                               (or local mock for development)
```

### HTTP endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Lightweight health check, image mode |
| GET | `/api/users` | Return two predefined users |
| GET | `/api/feed?userId=user-asha` | Personalized 24-listing ranking |
| POST | `/api/interactions` | Record `{ "userId":"user-asha", "listingId":"p01", "type":"save" }` |
| GET | `/api/listings/p01/image` | Retrieve a sample image via server (S3 or approved mock) |

Payload values and user IDs are checked on the backend. `contact` represents **contact intent only**, not a real message to a seller, as there is no seller messaging requirement.

### Persistent data model

**Listing** (`server/src/models/Listing.js`): `id` (unique), `title`, `category`, `location`, `price`, `propertyType`/`bedrooms`/`bathrooms` for property, `make`/`model`/`year` for vehicle, optional `imageKey` and `featuredScore`.

**Interaction** (`server/src/models/Interaction.js`): `userId`, `listingId`, `type`, timestamps. Has a **unique compound index** on `(userId, listingId, type)` so the same action is stored once per listing/user. Repeated requests use an atomic upsert. Different actions on the same listing still count individually, with a finite maximum of `1+4+6=11` action-weight units.

## Ranking logic (explainable rules, not ML)

`server/src/services/recommend.js` is a pure function with no database dependency, making it easy to test and interview-discuss.

For each **unique** View/Save/Contact event, build similarity scores for all **other** listings:

| Signal | Points per action weight | Reason |
|---|---:|---|
| Same category (property / vehicle) | `3.0 × w` | Category is a strong indicator |
| Same city/location | `1.6 × w` | Nearby inventory matters |
| Same property type or vehicle make | `1.5 × w` | More specific interests |
| Similar price (same category; less than ~35% proportional gap) | `0.5 × w` | Soft budget similarity |

Interaction weights: **View = 1, Save = 4, Contact = 6**. A `Contact` expresses stronger interest than casual viewing. Scores are the sum of relevant match contributions; ties break by deterministic sample `featuredScore`, then listing ID. The response includes `score` and two strongest human-readable `reasons` so the user can understand why top items rank first. Price similarity is based on `abs(log(candidate.price / source.price)) < 0.30`, not raw LKR difference, and applies only to the same category.

**Cold start:** A user with no recorded actions gets a stable, mixed default ranking using seed `featuredScore` and listing ID; no fake user profile is invented.

**Repeat protection:** MongoDB's unique index and atomic upsert deduplicate clicks; the ranking function **also** deduplicates the events defensively. Clicking View 100 times is worth the same as once. Because different action types are finite, one listing cannot dominate from repeated clicks.

**Already-interacted listings:** Instead of excluding them entirely, **demote them below all un-interacted listings**. This prevents repetitive recommendations while retaining access to Viewed/Saved/Contacted items in the single feed. Within each unseen/seen group, similarity ranking still applies.

**User isolation:** Feed queries request interactions for one selected `userId`. The pure recommendation function filters again, defending against mixed-user input in unit tests.

**Trade-offs:** This small dataset uses linear in-memory ranking of 24 listings. For larger production datasets, add aggregated per-user interests, indexing, pagination and candidate retrieval before ranking. There is no security-grade authentication: users are predefined test identities by design. `featuredScore` is fictional seed metadata, not real popularity. No time decay or collaborative filtering is required.

## Private AWS S3 setup — IMPORTANT cost rule

**Do not create or use paid resources.** AWS *free usage is account-dependent and never guaranteed*. First verify the relevant AWS billing/free allowance for your specific account and avoid activities that could incur charges. If you cannot guarantee no cost, **contact PrimeMarket.lk for their approved alternative BEFORE using AWS**. `S3_MODE=mock` is suitable for local development but is **not automatically an acceptable final submission**.

If you have confirmed zero-cost access or temporary access explicitly provided by the company:

1. Create/use **one private S3 bucket** in your permitted region. Leave **Block all public access enabled**. Do **not** configure static website hosting, public ACLs, paid hosting or other AWS services.
2. Set IAM identity permissions no broader than `s3:GetObject` and `s3:PutObject` for `arn:aws:s3:::YOUR-BUCKET/listing-*` (and only what your account/setup genuinely needs). Prefer the standard AWS local profile/role credentials chain; never commit credentials.
3. Edit `server/.env`: set `S3_MODE=aws`, `AWS_REGION=...`, `S3_BUCKET=...`. SDK obtains credentials **on the backend only** using its standard environment/profile/role credential sources.
4. Run `cd server && npm run upload:images` to put **five** sample JPGs into that bucket. Each is less than 1 MB.
5. Run backend/frontend and visit listings `p01`, `p02`, `p03`, `v01`, `v02`. Their images are retrieved via backend `GetObject`, not publicly exposed S3 URLs. The response has no bucket URL, access key, or secret.
6. Verify S3 Block Public Access settings and that direct unsigned public object URLs are inaccessible. Include a screenshot of the private S3 object list or read proof in your demo (without credentials/account identifiers).

For locally approved mock: keep `S3_MODE=mock`, which reads the same five filenames from `server/assets`. **Disclose this honestly** in your README/email and keep the recruiter's explicit approval. No AWS resources were provisioned by the project files alone.

The sample JPGs are original simple fictional illustrations, not property or car photographs. The repository includes all five for reproducibility. The app displays generic gradients for listings without an image, which is permitted (up to five sample S3 images, not all 24).

## Automated tests

```bash
cd server
npm test
```

Six tests run using Node's built-in test runner (no network, AWS, or MongoDB dependency):

1. Cold-start feed stable, with both categories.
2. Two users' different interests produce different feeds; no cross-user activity leakage.
3. 100 duplicate View interactions produce exactly the same rankings/scores as one.
4. Contact > Save > View influence.
5. Already-interacted listings appear below unseen listings.
6. One user's activity does not prevent the other user receiving a cold-start feed.

These test the backend ranking function in isolation. **Manual integration testing with a running MongoDB and private S3** is still required to validate the entire stack before submission.

## Submission evidence — under 3 minutes

**Suggested 2-minute video outline:**

- **0:00–0:20** Show two user choices and a cold-start default feed; identify the current user.
- **0:20–0:50** Asha: Save a Colombo apartment, View another; show recommendation reasons.
- **0:50–1:20** Nimal: Contact a Kandy Toyota, Save another vehicle; show his different top results.
- **1:20–1:40** Refresh or reopen browser and switch back to Asha: her property ranking persists; return to Nimal to confirm isolation.
- **1:40–2:00** Show six passing tests and private S3 sample images / approved alternative proof.
- **2:00–2:20** Explain weights (1/4/6), one-time click cap and demotion of already-interacted items.

Capture screenshots if a short video is inconvenient. Explain actual implementation state (e.g. don't claim S3 if only a mock was used).

## What to improve if time remains

A few things can be discussed as trade-offs in an interview: better loading states, API integration tests, finer category filters, an explicit Saved view, signal decay over time, stronger request schema validation, and better candidate selection for many listings. Avoid spending assignment time on authentication, ML, deployment or unnecessary visual polish.

## Before committing

- Confirm your `.env` is excluded (`git status --ignored`), and no credentials or tokens appear in tracked files.
- `npm test` and `npm run build` pass. Make sure you actually complete end-to-end actions against MongoDB.
- Ensure the correct S3/approved mock status is documented. No AWS charge should be incurred.
- Put screenshots or a recording in the repository (`evidence/`) or link it from README; do not put confidential credentials or personal account screenshots there.
