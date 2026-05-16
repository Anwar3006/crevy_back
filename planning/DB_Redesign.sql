-- ============================================================
-- CREVY PLATFORM — POSTGRES MIGRATION
-- ============================================================


-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================

-- PostGIS: Geography/Geometry types, ST_Contains, ST_Area, ST_Buffer, etc.
-- Required for farm_plot boundary storage and sensor point-in-polygon checks.
CREATE EXTENSION IF NOT EXISTS postgis;

-- btree_gist: Enables the partial unique index on project_plot that prevents
-- the same land from being enrolled in two concurrent carbon projects (double-counting).
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ============================================================
-- SECTION 2: ENUMS
-- ============================================================

-- RBAC
CREATE TYPE assignment_type_enum AS ENUM ('primary', 'secondary');

-- Partner
CREATE TYPE partner_type_enum AS ENUM ('dMRV_provider', 'auditing_body', 'registry', 'channel');
CREATE TYPE partner_status_enum AS ENUM ('pending', 'approved', 'suspended', 'rejected');

-- Farmer
CREATE TYPE farmer_verification_status_enum AS ENUM ('pending', 'verified', 'rejected');

-- Farm Plot
-- Records HOW the polygon boundary was captured.
-- Drives data quality scoring — 'walked_gps' is highest confidence,
-- 'buffered_centroid' blocks dMRV submission until a real boundary is captured.
CREATE TYPE boundary_collection_method_enum AS ENUM (
    'walked_gps',         -- Agent physically walked the perimeter (highest confidence)
    'drawn_mobile',       -- Agent tapped corners on satellite map in Crevy mobile app
    'drawn_web',          -- Admin drew boundary in dashboard over satellite imagery
    'satellite_derived',  -- Boundary extracted from satellite imagery analysis
    'buffered_centroid'   -- Circle approximation from centroid + area (lowest confidence, temporary)
);

-- Project
CREATE TYPE project_type_enum AS ENUM (
    'regenerative_agriculture', 'reforestation', 'renewable_energy',
    'biochar', 'blue_carbon', 'waste_management'
);
CREATE TYPE project_stage_enum AS ENUM ('registration', 'active', 'verification', 'completed');
CREATE TYPE project_status_enum AS ENUM ('draft', 'active', 'suspended', 'closed');
CREATE TYPE project_participation_status_enum AS ENUM ('active', 'suspended', 'withdrawn');
CREATE TYPE project_plot_status_enum AS ENUM ('enrolled', 'suspended', 'removed');
CREATE TYPE project_activity_status_enum AS ENUM ('planned', 'in_progress', 'completed', 'skipped', 'rejected');

-- Carbon Credits
CREATE TYPE credit_status_enum AS ENUM ('available', 'reserved', 'sold', 'retired', 'invalidated');

-- Credit Transactions
CREATE TYPE transaction_status_enum AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Verification
CREATE TYPE verification_status_enum AS ENUM ('success', 'flagged', 'failed');

-- MRV
CREATE TYPE mrv_ingestion_status_enum AS ENUM ('pending', 'processing', 'verified', 'flagged', 'failed');
-- CraftedClimate Worker 2 returns this as geo_fence_status
CREATE TYPE geo_fence_status_enum AS ENUM ('valid', 'invalid');

-- Financials
CREATE TYPE contract_type_enum AS ENUM ('offtake', 'spot', 'framework');
CREATE TYPE contract_status_enum AS ENUM ('draft', 'active', 'expired', 'terminated');
CREATE TYPE record_type_enum AS ENUM ('platform_fee', 'refund', 'contract_payment', 'commission', 'correction');
CREATE TYPE payout_method_enum AS ENUM ('mobile_money', 'bank_transfer', 'cash');
CREATE TYPE payout_status_enum AS ENUM ('pending', 'completed', 'failed');


-- ============================================================
-- SECTION 3: TABLES
-- ============================================================


-- ------------------------------------------------------------
-- 1. ROLE
-- Defines named roles on the platform (farmer, company, admin,
-- verifier, partner_agent). Decoupled from users so roles can
-- be added without schema changes.
-- Each role will have a corresponding table in the database. Below you will find the farmer table.
-- The farmer table is a child table of the user table. You can tell it's a child table because it has a foreign key to the user table.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 2. PERMISSION
-- Defines resource-action pairs that can be granted to roles.
-- e.g. resource='projects', action='approve'
-- We will define all the permissions around the actions for all the resources so think CRUD(Create, Read, Update, Delete) operations for all the resources
-- Example of resource is project or finance, this table defines all the actions one can perform on such a resource
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permission (
    id          SERIAL PRIMARY KEY,
    resource    VARCHAR(100) NOT NULL,
    action      VARCHAR(100) NOT NULL, 
    description VARCHAR(255), 
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (resource, action)
);


-- ------------------------------------------------------------
-- 3. ROLE_PERMISSION
-- Many-to-many: assigns permissions to roles. Changing what
-- a role can do is a data change, not a code deployment.
-- This table is the bridge between role and permission.
-- If we say farmer role, then what can the farmer do? can he create project? can he approve project?
-- We link multiple permissions to a role, and multiple roles can have the same permission.
-- We use the Composite Primary key of role and permission precisely to prevent duplications.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permission (
    role_id       INT  NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    permission_id INT  NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
    granted_by    TEXT REFERENCES user(id) ON DELETE SET NULL,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);


-- ------------------------------------------------------------
-- 4. USER_ROLE
-- Assigns roles to users. Supports multiple roles per user
-- and optional time-limited assignments (expires_at).
-- When a user creates an account, we assign them a role, this role comes with predefined permissions that were assigned in the role_permission table above
-- We dont need this table, we can have the role_id in the user table.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_role (
    id          SERIAL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    role_id     INT  NOT NULL REFERENCES role(id)   ON DELETE CASCADE,

    ---------------------------
    -- move this to user table
    assigned_by TEXT          REFERENCES user(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    ---------------------------


    UNIQUE (user_id, role_id)
);


-- ------------------------------------------------------------
-- 5. CURRENCY
-- ISO 4217 reference table. Every financial field that stores
-- a monetary amount links here to avoid magic currency strings.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS currency (
    id         SERIAL   PRIMARY KEY,
    code       CHAR(3)  NOT NULL UNIQUE, -- e.g. USD, GHS, EUR, KES
    name       VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 6. PARTNER
-- External organisations Crevy integrates with: the dMRV
-- provider (CraftedClimate), auditing bodies, and channel
-- partners who onboard farmers. CraftedClimate is seeded here
-- as the first partner record on initial migration.
-- An example is CraftedClimate, this is our dMRV provider
-- Since we will be dealing with a myriad of business across many dimension, this table allows us to track and manage them.
-- Partner is not a type of user because they do not have access to the platform but this is subject to change after we review this in accordance to the Business Requirements.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner (
    id                          SERIAL PRIMARY KEY,
    name                        VARCHAR(255) NOT NULL UNIQUE,
    code                        VARCHAR(50)  UNIQUE,
    partner_type                partner_type_enum   NOT NULL,
    contact_person              TEXT         NOT NULL,
    contact_email               TEXT         NOT NULL,
    contact_phone               VARCHAR(50),
    country                     VARCHAR(100),
    status                      partner_status_enum NOT NULL DEFAULT 'pending',
    default_currency_id         INT          REFERENCES currency(id) ON DELETE SET NULL,
    has_data_sharing_agreement  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 7. AUDIT_LOG
-- Immutable application-level change log. Every significant
-- create/update/delete action writes a row here. Required for
-- carbon market compliance and fraud investigation. This is
-- Crevy's own audit trail — distinct from CraftedClimate's
-- chain-of-custody which lives in Azure Blob Storage.
-- This table will grow very large, very fast because it records every mutation and we do not delete the records.
-- So if you ask: "Show me what happened on a certain day?", we query the audit_log table for that specific time range.
-- We can discuss this. Our options:
-- 1. Tiered Storage: Moving the data to a cold storage after a certain time period. Querying this requires moving the data back to hot storage or use serverless query engines (Athena, BigQuery).
-- 2. OLAP database: Using a dataware house to store the dead data. We can query it if we ever need some data from the past. 
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id   TEXT             REFERENCES user(id) ON DELETE SET NULL,
    action     VARCHAR(100)     NOT NULL,  -- e.g. 'credit.issued', 'project.approved'
    table_name VARCHAR(100)     NOT NULL,
    record_id  TEXT             NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 8. NOTIFICATION
-- The content record for a notification event. Decoupled from
-- delivery so one event can be sent to multiple users without
-- duplicating the message body.
-- Designing notifications at the application layer means we choose between 
-- 1. Webhooks, eg: Crafted Climate provides us a webhook for the data we need which we can use to send notifications to update our users.
-- 2. Event-Driven Architecture like Pub/Sub
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(255) NOT NULL,
    content    TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 9. USER_NOTIFICATION
-- Tracks per-user delivery and read status for notifications.
-- One notification row can fan out to many user_notification
-- rows (e.g. alerting all admins about a new project submission).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_notification (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID    NOT NULL REFERENCES notification(id) ON DELETE CASCADE,
    user_id         TEXT    NOT NULL REFERENCES "user"(id)       ON DELETE CASCADE,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ NULL,
    UNIQUE (notification_id, user_id)
);


-- ------------------------------------------------------------
-- 10. FARMER
-- Extended profile for users whose role is project owner /
-- farmer. Keeps user table lean. Stores KYC status and payment
-- channel details needed for payout disbursement.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmer (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT        NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    code                VARCHAR(50) NOT NULL UNIQUE,  -- e.g. FRM-GH-000001
    verification_status farmer_verification_status_enum NOT NULL DEFAULT 'pending',
    onboarded_by        TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
    onboarded_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bank_name           VARCHAR(100),
    bank_account_number VARCHAR(50),
    mobile_money_number VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 11. FARM_PLOT
-- A physically distinct parcel of land owned or managed by a
-- farmer. Stores both a centroid point (required at registration,
-- easy to capture via phone GPS) and a full boundary polygon
-- (nullable at registration, required before dMRV submission).
--
-- GEOGRAPHY vs GEOMETRY: GEOGRAPHY(4326) uses spherical math
-- (WGS84 ellipsoid) so ST_Area() returns accurate square metres
-- globally without unit conversion. Correct for a platform
-- spanning multiple African countries and beyond.
--
-- Centroid + Boundary dual approach:
--   - centroid: captured on Day 1 by agent via Google Maps / phone GPS.
--   - boundary: captured later via walked GPS, drawn on mobile/web map,
--     or satellite digitisation. boundary_collection_method records
--     how it was captured for data quality scoring.
--   - 'buffered_centroid' method flag means the boundary is a rough
--     circle approximation — application layer must block dMRV submission
--     until a real boundary is provided.
--
-- Sensor reconciliation: CraftedClimate sends lat/lng with every
-- telemetry packet. We validate that point falls inside the registered
-- plot polygon via ST_Contains (the geo_fence_status check). See the
-- find_plot_for_sensor_reading() function in Section 5.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farm_plot (
    id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id                   UUID    NOT NULL REFERENCES farmer(id) ON DELETE CASCADE,
    country                     VARCHAR(100) NOT NULL,
    region                      VARCHAR(100) NOT NULL,
    village                     VARCHAR(100),
    centroid                    GEOGRAPHY(Point, 4326)   NOT NULL,
    boundary                    GEOGRAPHY(Polygon, 4326) NULL,
    boundary_collection_method  boundary_collection_method_enum NULL,
    area_hectares               DECIMAL(10, 2) NOT NULL,
    -- Set TRUE by admin after cross-checking boundary against satellite imagery.
    -- Required before dMRV submission.
    boundary_verified           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 12. FARMER_ASSIGNMENT
-- Links a farmer to a Crevy field agent and optionally to a
-- partner organisation. assignment_type = 'primary' means this
-- agent is the main point of contact and accountable for that
-- farmer's data quality, KYC, and plot registration. Only one
-- primary assignment per farmer at a time (enforced at app layer).
-- is_b2c_assignment = TRUE means Crevy onboarded this farmer
-- directly; FALSE means a partner brought them in, which may
-- trigger partner commission on credit sales.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmer_assignment (
    id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id          UUID    NOT NULL REFERENCES farmer(id)  ON DELETE CASCADE,
    agent_id           TEXT    NOT NULL REFERENCES user(id)  ON DELETE CASCADE,
    assigned_by        TEXT    NOT NULL REFERENCES user(id)  ON DELETE RESTRICT,
    partner_id         INT              REFERENCES partner(id) ON DELETE SET NULL,
    assignment_type    assignment_type_enum NOT NULL,
    -- TRUE = Crevy onboarded directly (partner_id will be NULL).
    -- FALSE = partner-mediated onboarding (partner_id must be set).
    is_b2c_assignment  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (farmer_id, agent_id, assignment_type)
);


-- ------------------------------------------------------------
-- 13. PROJECT
-- The core entity of the platform. A carbon sequestration or
-- emissions-reduction project that farmers register and companies
-- invest in. project_code maps to CraftedClimate's CC-PROJECT-ID
-- namespace — it is the join key between the two systems.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(100) NOT NULL UNIQUE,  -- e.g. PRJ-GH-2026-001; maps to CC-PROJECT-ID
    name           VARCHAR(255) NOT NULL,
    project_type   project_type_enum   NOT NULL,
    project_stage  project_stage_enum  NOT NULL DEFAULT 'registration',
    project_status project_status_enum NOT NULL DEFAULT 'draft',
    region         VARCHAR(100) NOT NULL,
    country        VARCHAR(100) NOT NULL,
    start_date     DATE         NOT NULL,
    end_date       DATE,
    currency_id    INT          NOT NULL REFERENCES currency(id) ON DELETE RESTRICT,
    created_by     TEXT         NOT NULL REFERENCES "user"(id)   ON DELETE RESTRICT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 14. PROJECT_FARMER
-- Records farmer-level enrollment in a project. Answers: "Is
-- Farmer X participating in Project Y and what is their status?"
-- Land area contribution is derived from project_plot — not
-- stored here — to maintain a single source of truth.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_farmer (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    farmer_id            UUID NOT NULL REFERENCES farmer(id)  ON DELETE CASCADE,
    joined_date          DATE NOT NULL,
    participation_status project_participation_status_enum NOT NULL DEFAULT 'active',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, farmer_id)
);


-- ------------------------------------------------------------
-- 15. PROJECT_PLOT
-- Records which specific farm plots are enrolled in a project
-- and the portion of each plot contributing to carbon accounting.
-- Fills the normalization gap between project and farm_plot:
--   - project_farmer answers: which farmers?
--   - project_plot answers:   which specific land parcels?
-- One farmer can contribute multiple plots to one project, which
-- is why plot enrollment cannot live on project_farmer.
-- enrolled_area_hectares may be less than farm_plot.area_hectares
-- (a farmer may only enroll part of a plot eligible under the
-- methodology). The carbon calculation uses this figure, not
-- the full registered plot area.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_plot (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID    NOT NULL REFERENCES project(id)   ON DELETE CASCADE,
    plot_id                 UUID    NOT NULL REFERENCES farm_plot(id) ON DELETE RESTRICT,
    -- The portion of this plot contributing to carbon accounting.
    -- Must be > 0 and ≤ farm_plot.area_hectares (enforced at app layer).
    enrolled_area_hectares  DECIMAL(10, 2) NOT NULL,
    status                  project_plot_status_enum NOT NULL DEFAULT 'enrolled',
    enrolled_date           DATE    NOT NULL,
    removed_date            DATE,   -- set when status → 'removed'
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, plot_id)
);


-- ------------------------------------------------------------
-- 16. PROJECT_ACTIVITY
-- Time-stamped operational milestones for a project: sensor
-- installation, soil sampling, tree planting, auditor site
-- visit, etc. Feeds the "Track Verification" dashboard feature
-- and provides buyers visibility into on-ground progress.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_activity (
    id                  SERIAL      PRIMARY KEY,
    project_id          UUID        NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    activity_date       DATE        NOT NULL,
    activity_description TEXT,
    activity_status     project_activity_status_enum NOT NULL DEFAULT 'planned',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 17. MRV_INGESTION_EVENT
-- Tracks each measurement batch submitted to CraftedClimate's
-- dMRV system. This is Crevy's tracking record for every dMRV
-- submission and maps CraftedClimate's project_id namespace
-- back to Crevy's internal project_id and plot_id. Without
-- this table, there is no way to correlate a sensor reading
-- back to a specific farm plot or trigger a dashboard update
-- when CraftedClimate's webhook fires.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrv_ingestion_event (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ingestion_id from CraftedClimate's API response (msg-ingest-uuid-XXXXX).
    -- Stored separately so it can be used in polling: GET /v1/mrv/status/{ingestion_id}
    cc_ingestion_id      VARCHAR(100) NOT NULL UNIQUE,
    project_id           UUID        NOT NULL REFERENCES project(id)   ON DELETE CASCADE,
    plot_id              UUID        NOT NULL REFERENCES farm_plot(id) ON DELETE CASCADE,
    farmer_id            UUID        NOT NULL REFERENCES farmer(id)    ON DELETE CASCADE,
    partner_id           INT         NOT NULL REFERENCES partner(id)   ON DELETE RESTRICT,
    -- Sensor node identifier from CraftedClimate's device_metadata (e.g. cs-node-gh-region-001).
    -- Links the physical hardware to this plot.
    device_id            VARCHAR(100),
    submission_timestamp TIMESTAMPTZ,
    ingestion_status     mrv_ingestion_status_enum NOT NULL DEFAULT 'pending',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 18. MRV_VERIFICATION_RESULT
-- Stores the webhook payload from CraftedClimate's Worker 2.
-- This is the definitive scientific verdict that authorises
-- credit issuance. net_credits_issued is the only figure used
-- for credit issuance — never gross_removals_tco2e.
-- Conservatism Principle (from CraftedClimate docs): always
-- display net_credits_issued, which already accounts for
-- leakage deduction and buffer pool contribution.
-- If verification_status = 'flagged', carbon_accounting fields
-- will be null — credits cannot be issued for that batch.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrv_verification_result (
    id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    ingestion_id           UUID    NOT NULL REFERENCES mrv_ingestion_event(id) ON DELETE CASCADE,
    project_id             UUID    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    -- CraftedClimate's unique identifier for this verification event (v-verify-uuid-XXXXX).
    verification_event_id  VARCHAR(200) NOT NULL UNIQUE,
    methodology_applied    VARCHAR(100),  -- e.g. 'Verra VM0042 v2.2 - Sectoral Scope 14'
    verification_status    verification_status_enum NOT NULL,
    -- AI model details from Worker 2
    ai_model_id            VARCHAR(100),  -- e.g. CC_ML_VERIFIER_V4_CORE
    ai_confidence_score    DECIMAL(5, 4), -- 0.0000 – 1.0000, e.g. 0.9982
    is_anomalous           BOOLEAN NOT NULL DEFAULT FALSE,
    prediction_class       VARCHAR(100),  -- e.g. 'baseline_consistent'
    -- Spatial and hardware integrity checks
    geo_fence_status       geo_fence_status_enum NOT NULL,
    hardware_integrity     VARCHAR(50) NOT NULL, -- 'secure' | 'compromised'
    -- Carbon accounting (null when verification_status = 'flagged')
    -- gross_removals_tco2e: raw sequestration before deductions. Display-only — never use for issuance.
    gross_removals_tco2e   DECIMAL(12, 6),
    -- leakage_deduction: estimated emissions from adjacent land-use change, subtracted from gross.
    leakage_deduction      DECIMAL(12, 6),
    -- buffer_contribution: portion withheld to a risk buffer pool to cover potential reversals.
    buffer_contribution    DECIMAL(12, 6),
    -- net_credits_issued: the authoritative figure. Credits are issued 1:1 against this number.
    net_credits_issued     DECIMAL(12, 6),
    received_at            TIMESTAMPTZ -- when Crevy's webhook handler received this payload
);


-- ------------------------------------------------------------
-- 19. MRV_BLOCKCHAIN_ANCHOR
-- Stores the webhook payload from CraftedClimate's Worker 3.
-- Records the Polygon PoS transaction that anchors this batch
-- of credits on-chain, making them tamper-proof and publicly
-- verifiable. transaction_hash and audit_uri are the two
-- pieces of evidence a corporate auditor needs to independently
-- verify a credit without trusting Crevy at all.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mrv_blockchain_anchor (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id        UUID    NOT NULL UNIQUE REFERENCES mrv_verification_result(id) ON DELETE CASCADE,
    project_id       UUID    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    network          VARCHAR(100) NOT NULL,   -- e.g. 'Polygon_PoS_Mainnet'
    contract_address VARCHAR(100) NOT NULL,
    -- The Polygon transaction hash. Immutable public proof of this batch's existence.
    transaction_hash VARCHAR(255) NOT NULL UNIQUE,
    block_height     BIGINT,
    -- batch_id from CraftedClimate (e.g. BATCH-ID-01-2026-03-26). Used to group
    -- all carbon_credit rows issued from this anchor into one identifiable batch.
    batch_id         VARCHAR(100) NOT NULL UNIQUE,
    vintage          SMALLINT NOT NULL, -- the year the carbon was sequestered, e.g. 2026
    merkle_root      VARCHAR(255) NOT NULL,
    -- IPFS CID: permanent, content-addressed public audit record. Share with auditors.
    audit_uri        VARCHAR(500) NOT NULL,
    anchored_at      TIMESTAMPTZ
);


-- ------------------------------------------------------------
-- 20. CARBON_CREDIT
-- One row = one tCO₂e. Each credit is individually serialised
-- so its full chain of custody — from issuance to retirement —
-- is traceable. Credits are issued automatically when Crevy's
-- webhook handler receives a SUCCESS blockchain anchor payload
-- from CraftedClimate. The quantity issued = net_credits_issued
-- from the corresponding mrv_verification_result.
--
-- Date fields form a strict chronological sequence:
--   generation_date   → when the carbon was physically removed
--                        from the atmosphere (end of sensor
--                        measurement period). Drives credit_vintage.
--   verification_date → when CraftedClimate confirmed the reading
--                        as valid (Worker 2 SUCCESS).
--   issuance_date     → when the credit was formally minted as a
--                        tradeable instrument on Crevy's platform.
--                        Credits cannot be sold before this date.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carbon_credit (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID        NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    -- Crevy's internal unique serial for this credit. Human-readable, e.g. CRV-GH-2026-000001.
    credit_serial_number VARCHAR(100) NOT NULL UNIQUE,
    -- credit_amount is typically 1.00 (one tCO₂e per credit row) but stored for
    -- methodologies that issue fractional credits.
    credit_amount       DECIMAL(12, 6) NOT NULL DEFAULT 1.0,
    -- The year the carbon was physically sequestered. Buyers often require a specific vintage.
    credit_vintage      SMALLINT    NOT NULL,
    credit_status       credit_status_enum NOT NULL DEFAULT 'available',
    -- Link back to the blockchain anchor that authorised issuance of this credit.
    -- mrv_blockchain_anchor.batch_id groups all credits issued from the same dMRV batch.
    mrv_batch_id        VARCHAR(100) NOT NULL REFERENCES mrv_blockchain_anchor(batch_id) ON DELETE RESTRICT,
    -- The Polygon transaction hash stored directly for fast auditor lookups
    -- without requiring a join to mrv_blockchain_anchor.
    blockchain_tx_hash  VARCHAR(255) NOT NULL,
    -- current_owner_id: tracks who holds this credit right now. Changes on every sale.
    -- On issuance this is set to the project owner (farmer's user_id).
    current_owner_id    TEXT         NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
    -- Registry where this credit is formally registered (e.g. 'Verra', 'Gold Standard', 'Crevy').
    registry            VARCHAR(100),
    generation_date     DATE,
    verification_date   DATE,
    issuance_date       DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 21. CREDIT_TRANSACTION
-- Crevy's immutable sales ledger. Records every purchase,
-- transfer, or retirement of carbon credits. One transaction
-- covers a batch of credits (e.g. a company buying 500 tCO₂e
-- in a single purchase). The individual carbon_credit rows
-- included in this transaction reference back here via
-- carbon_credit.transaction_id (set when sold, null when available).
--
-- quantity:      the number of tCO₂e units (credit rows) in this sale.
-- price_per_credit: the agreed price for one tCO₂e unit at transaction time.
-- total_amount:  stored as price_per_credit × quantity, denormalised to
--               lock in the exact agreed value — not recomputed from live data.
-- is_internal_sale: FALSE = real marketplace sale (triggers farmer payout +
--               platform fee). TRUE = administrative transfer between Crevy
--               accounts with no external money movement (e.g. buffer pool
--               allocation, credit retirement on behalf of a contract buyer).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_transaction (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Human-readable reference for support and reconciliation, e.g. TXN-2026-000001.
    transaction_ref  VARCHAR(100) NOT NULL UNIQUE,
    buyer_id         TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    seller_id        TEXT        NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    is_internal_sale BOOLEAN     NOT NULL DEFAULT FALSE,
    quantity         DECIMAL(12, 2) NOT NULL,
    price_per_credit DECIMAL(10, 2) NOT NULL,
    total_amount     DECIMAL(15, 2) NOT NULL, -- = quantity × price_per_credit, locked at transaction time
    currency_id      INT         NOT NULL REFERENCES currency(id) ON DELETE RESTRICT,
    transaction_status transaction_status_enum NOT NULL DEFAULT 'pending',
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add transaction_id back onto carbon_credit to complete the relationship.
-- This is nullable: NULL = credit is available, UUID = credit was sold in this transaction.
-- Using ALTER TABLE here to avoid a forward-reference at table creation time.
ALTER TABLE carbon_credit
    ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES credit_transaction(id) ON DELETE SET NULL;


-- ------------------------------------------------------------
-- 22. VERIFICATION
-- Crevy's business-layer record of each formal verification
-- outcome. References CraftedClimate as the verifying partner
-- and stores their verification_event_id so every record can
-- be correlated back to CraftedClimate's audit trail. A project
-- accumulates multiple verifications over its lifetime (one per
-- annual dMRV audit cycle).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification (
    id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID    NOT NULL REFERENCES project(id)  ON DELETE CASCADE,
    verifier_partner_id   INT     NOT NULL REFERENCES partner(id)  ON DELETE RESTRICT,
    -- CraftedClimate's verification event ID (v-verify-uuid-XXXXX).
    -- Used to correlate this record back to mrv_verification_result and CraftedClimate's own logs.
    verification_event_id VARCHAR(200) NOT NULL UNIQUE,
    methodology_applied   VARCHAR(100),
    verification_date     DATE    NOT NULL,
    verification_status   verification_status_enum NOT NULL,
    verification_notes    TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 23. PAYOUT
-- Tracks payment disbursements to farmers following a credit
-- sale. Triggered when credit_transaction.status → 'completed'
-- for a non-internal sale. Stores the payment channel details
-- used at disbursement time (bank or mobile money).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payout (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_ref    VARCHAR(100) NOT NULL UNIQUE,  -- e.g. PAY-2026-000001
    farmer_id      UUID        NOT NULL REFERENCES farmer(id)             ON DELETE RESTRICT,
    project_id     UUID        NOT NULL REFERENCES project(id)            ON DELETE RESTRICT,
    transaction_id UUID        NOT NULL REFERENCES credit_transaction(id) ON DELETE RESTRICT,
    payout_amount  DECIMAL(12, 2) NOT NULL,
    currency_id    INT         NOT NULL REFERENCES currency(id) ON DELETE RESTRICT,
    payout_date    DATE        NOT NULL,
    payout_method  payout_method_enum  NOT NULL,
    payout_status  payout_status_enum  NOT NULL DEFAULT 'pending',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 24. FINANCIAL_RECORD
-- General-purpose platform ledger for all financial events
-- beyond direct farmer payouts: platform fees, partner
-- commissions, refunds, contract escrow entries, and
-- corrective accounting adjustments. Together with
-- farmer_payout and credit_transaction, this gives Crevy
-- a complete financial audit trail.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_record (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id        UUID    NOT NULL REFERENCES project(id) ON DELETE RESTRICT,
    record_type       record_type_enum NOT NULL,
    amount            DECIMAL(12, 2) NOT NULL,
    currency_id       INT     NOT NULL REFERENCES currency(id) ON DELETE RESTRICT,
    transaction_date  DATE    NOT NULL,
    description       TEXT,
    -- Optional link to the farmer payout this fee/commission was deducted from.
    related_payout_id UUID    REFERENCES farmer_payout(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ------------------------------------------------------------
-- 25. CONTRACT
-- Formalises long-term purchase commitments (offtake agreements)
-- between a partner/buyer and a project. Locks in quantities,
-- prices, and terms ahead of verification, giving project owners
-- revenue predictability and companies forward-carbon positions.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contract (
    id                         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id                 INT     NOT NULL REFERENCES partner(id)   ON DELETE RESTRICT,
    project_id                 UUID    NOT NULL REFERENCES project(id)   ON DELETE RESTRICT,
    farmer_id                  UUID    NOT NULL REFERENCES farmer(id)    ON DELETE RESTRICT,
    plot_id                    UUID    NOT NULL REFERENCES farm_plot(id) ON DELETE RESTRICT,
    contract_ref               VARCHAR(100) NOT NULL UNIQUE, -- e.g. CTR-2026-001
    contract_type              contract_type_enum    NOT NULL,
    contract_terms             TEXT,
    start_date                 DATE    NOT NULL,
    end_date                   DATE,
    status                     contract_status_enum  NOT NULL DEFAULT 'draft',
    committed_credits          DECIMAL(12, 2),  -- Total tCO₂e committed over the contract term
    carbon_estimated           DECIMAL(12, 2),  -- Estimated carbon at the time of signing
    methodology                VARCHAR(100),
    payment_terms              JSONB,
    has_data_sharing_agreement BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- SECTION 4: CONSTRAINTS
-- ============================================================

-- Prevent the same farm plot from being actively enrolled in two
-- concurrent carbon projects simultaneously. This is the land-use
-- equivalent of double-counting credits. Only 'enrolled' rows
-- compete — 'suspended' and 'removed' plots are excluded so a plot
-- can be re-enrolled in a new project after a previous one ends.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_plot_no_double_enrollment
    ON project_plot (plot_id)
    WHERE status = 'enrolled';


-- ============================================================
-- SECTION 5: INDEXES
-- ============================================================

-- user_role: look up all roles for a user; look up all users in a role
CREATE INDEX IF NOT EXISTS idx_user_role_user   ON user_role (user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_role   ON user_role (role_id);

-- user_notification: primary read pattern — "get all unread notifications for user X"
CREATE INDEX IF NOT EXISTS idx_user_notification_unread ON user_notification (user_id, is_read);

-- farmer: look up farmer by their linked user account
CREATE INDEX IF NOT EXISTS idx_farmer_user_id ON farmer (user_id);

-- farm_plot: spatial indexes for boundary containment (ST_Contains) and proximity queries (ST_DWithin)
CREATE INDEX IF NOT EXISTS idx_farm_plot_boundary ON farm_plot USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_farm_plot_centroid  ON farm_plot USING GIST (centroid);
-- Look up all plots owned by a farmer
CREATE INDEX IF NOT EXISTS idx_farm_plot_farmer_id ON farm_plot (farmer_id);

-- farmer_assignment: look up assignments by farmer (who manages this farmer?) and by agent (who does this agent manage?)
CREATE INDEX IF NOT EXISTS idx_farmer_assignment_farmer_id ON farmer_assignment (farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_assignment_agent_id  ON farmer_assignment (agent_id);

-- project: filter projects by type and status — the two most common marketplace query dimensions
CREATE INDEX IF NOT EXISTS idx_project_type   ON project (project_type);
CREATE INDEX IF NOT EXISTS idx_project_status ON project (project_status);
CREATE INDEX IF NOT EXISTS idx_project_code   ON project (code);

-- project_farmer: join in both directions
CREATE INDEX IF NOT EXISTS idx_project_farmer_project ON project_farmer (project_id);
CREATE INDEX IF NOT EXISTS idx_project_farmer_farmer  ON project_farmer (farmer_id);

-- project_plot: join in both directions; filter by enrollment status
CREATE INDEX IF NOT EXISTS idx_project_plot_project ON project_plot (project_id);
CREATE INDEX IF NOT EXISTS idx_project_plot_plot    ON project_plot (plot_id);
CREATE INDEX IF NOT EXISTS idx_project_plot_status  ON project_plot (status);

-- project_activity: look up all activities for a project (dashboard timeline)
CREATE INDEX IF NOT EXISTS idx_project_activity_project ON project_activity (project_id);

-- mrv_ingestion_event: look up submissions by project, plot, and device
CREATE INDEX IF NOT EXISTS idx_mrv_ingestion_project ON mrv_ingestion_event (project_id);
CREATE INDEX IF NOT EXISTS idx_mrv_ingestion_plot    ON mrv_ingestion_event (plot_id);
CREATE INDEX IF NOT EXISTS idx_mrv_ingestion_device  ON mrv_ingestion_event (device_id);
-- Filter by status to find batches still waiting on CraftedClimate's pipeline
CREATE INDEX IF NOT EXISTS idx_mrv_ingestion_status  ON mrv_ingestion_event (ingestion_status);

-- mrv_verification_result: join back to ingestion and project; filter by outcome
CREATE INDEX IF NOT EXISTS idx_mrv_result_ingestion ON mrv_verification_result (ingestion_id);
CREATE INDEX IF NOT EXISTS idx_mrv_result_project   ON mrv_verification_result (project_id);
CREATE INDEX IF NOT EXISTS idx_mrv_result_status    ON mrv_verification_result (verification_status);

-- mrv_blockchain_anchor: look up by project; transaction_hash is already UNIQUE (implicitly indexed)
CREATE INDEX IF NOT EXISTS idx_mrv_anchor_project ON mrv_blockchain_anchor (project_id);

-- carbon_credit: most frequent read patterns on the marketplace
CREATE INDEX IF NOT EXISTS idx_carbon_credit_project       ON carbon_credit (project_id);
CREATE INDEX IF NOT EXISTS idx_carbon_credit_status        ON carbon_credit (credit_status);
CREATE INDEX IF NOT EXISTS idx_carbon_credit_owner         ON carbon_credit (current_owner_id);
CREATE INDEX IF NOT EXISTS idx_carbon_credit_vintage       ON carbon_credit (credit_vintage);
CREATE INDEX IF NOT EXISTS idx_carbon_credit_transaction   ON carbon_credit (transaction_id);
-- batch lookup: "give me all credits from CraftedClimate batch X"
CREATE INDEX IF NOT EXISTS idx_carbon_credit_batch         ON carbon_credit (mrv_batch_id);

-- credit_transaction: look up transactions by buyer or seller; filter by status and date
CREATE INDEX IF NOT EXISTS idx_credit_txn_buyer  ON credit_transaction (buyer_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_seller ON credit_transaction (seller_id);
CREATE INDEX IF NOT EXISTS idx_credit_txn_status ON credit_transaction (transaction_status);
CREATE INDEX IF NOT EXISTS idx_credit_txn_date   ON credit_transaction (transaction_date DESC);

-- verification: look up verifications by project
CREATE INDEX IF NOT EXISTS idx_verification_project ON verification (project_id);

-- farmer_payout: look up payouts by farmer and by project; filter by status
CREATE INDEX IF NOT EXISTS idx_payout_farmer  ON farmer_payout (farmer_id);
CREATE INDEX IF NOT EXISTS idx_payout_project ON farmer_payout (project_id);
CREATE INDEX IF NOT EXISTS idx_payout_status  ON farmer_payout (payout_status);

-- financial_record: look up all financial events for a project; filter by type
CREATE INDEX IF NOT EXISTS idx_financial_record_project ON financial_record (project_id);
CREATE INDEX IF NOT EXISTS idx_financial_record_type    ON financial_record (record_type);

-- contract: look up contracts by project, farmer, and status
CREATE INDEX IF NOT EXISTS idx_contract_project ON contract (project_id);
CREATE INDEX IF NOT EXISTS idx_contract_farmer  ON contract (farmer_id);
CREATE INDEX IF NOT EXISTS idx_contract_status  ON contract (status);

-- audit_log: forensic lookups — "what happened to record X?" and "what did user Y do?"
CREATE INDEX IF NOT EXISTS idx_audit_log_actor           ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record    ON audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at      ON audit_log (created_at DESC);


-- ============================================================
-- SECTION 6: VIEWS
-- ============================================================

-- Derives the total land area a farmer contributes to a project.
-- Replaces the manually maintained project_land_size_hectares field
-- that previously lived on project_farmer (and could diverge from reality).
-- Usage: SELECT * FROM farmer_project_land_summary WHERE project_id = '...' AND farmer_id = '...';
CREATE OR REPLACE VIEW farmer_project_land_summary AS
    SELECT
        pp.project_id,
        fp.farmer_id,
        COUNT(pp.id)                  AS enrolled_plot_count,
        SUM(pp.enrolled_area_hectares) AS total_enrolled_hectares,
        SUM(fp.area_hectares)          AS total_registered_hectares
    FROM project_plot pp
    JOIN farm_plot fp ON fp.id = pp.plot_id
    WHERE pp.status = 'enrolled'
    GROUP BY pp.project_id, fp.farmer_id;


-- ============================================================
-- SECTION 7: FUNCTIONS
-- ============================================================

-- Answers: "which farm_plot does this sensor reading belong to?"
-- Called by the MRV webhook handler when a CraftedClimate ingestion event arrives.
-- The sensor's lat/lng from device_metadata is matched against verified plot boundaries
-- using a point-in-polygon check — this is CraftedClimate's geo_fence_status check
-- performed on Crevy's side to map the reading to an internal plot record.
CREATE OR REPLACE FUNCTION find_plot_for_sensor_reading(
    sensor_lat DOUBLE PRECISION,
    sensor_lng DOUBLE PRECISION
)
RETURNS UUID AS $$
    SELECT id
    FROM farm_plot
    WHERE ST_Contains(
        boundary::geometry,
        ST_SetSRID(ST_Point(sensor_lng, sensor_lat), 4326)
    )
    AND boundary IS NOT NULL
    AND boundary_verified = TRUE
    LIMIT 1;
$$ LANGUAGE SQL STABLE;


-- Generates a temporary circular polygon from a centroid + area estimate.
-- Used when a field agent registers a plot with only a GPS point on Day 1.
-- boundary_collection_method must be set to 'buffered_centroid' to flag this
-- as low-confidence. The application layer must block dMRV submission for plots
-- with this method until a proper boundary is captured.
-- radius_metres = sqrt(area_m² / π)  →  area_m² = area_ha × 10,000
CREATE OR REPLACE FUNCTION generate_buffered_boundary(
    plot_centroid     GEOGRAPHY(Point, 4326),
    plot_area_hectares DECIMAL
)
RETURNS GEOGRAPHY AS $$
    SELECT ST_Buffer(
        plot_centroid::geometry,
        SQRT(plot_area_hectares * 10000.0 / PI())
    )::geography;
$$ LANGUAGE SQL IMMUTABLE;


-- Returns the PostGIS-calculated area of a plot's boundary in hectares.
-- Compare against farm_plot.area_hectares to catch data entry errors.
-- A discrepancy > 10% should trigger an admin review flag before dMRV submission.
CREATE OR REPLACE FUNCTION calculated_area_hectares(plot_id UUID)
RETURNS DECIMAL AS $$
    SELECT ROUND((ST_Area(boundary) / 10000.0)::DECIMAL, 4)
    FROM farm_plot
    WHERE id = plot_id AND boundary IS NOT NULL;
$$ LANGUAGE SQL STABLE;



-- NOTES:
-- 1. remove action, project_create from permission table.
-- 2. Maintain UUID for all PK.
-- 3. int for tabels (except UUID).
-- 4. Move data to archive , Users who are inactive for sometime should have their accounts wiped or delete.
