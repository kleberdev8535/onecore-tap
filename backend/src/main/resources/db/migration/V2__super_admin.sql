-- OneCore Tap - Fase 2: planos, mesas, plaquinhas (estoque, vinculacao, historico), configuracoes da plataforma

CREATE TABLE plans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 VARCHAR(40)  NOT NULL,
    name                 VARCHAR(80)  NOT NULL,
    description          VARCHAR(300),
    monthly_price_cents  INTEGER      NOT NULL,
    max_tables           INTEGER,
    max_users            INTEGER,
    trial_days           INTEGER      NOT NULL DEFAULT 0,
    features             TEXT         NOT NULL DEFAULT '',
    active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version              BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_plans_code UNIQUE (code),
    CONSTRAINT ck_plans_price CHECK (monthly_price_cents >= 0),
    CONSTRAINT ck_plans_limits CHECK ((max_tables IS NULL OR max_tables > 0) AND (max_users IS NULL OR max_users > 0)),
    CONSTRAINT ck_plans_trial CHECK (trial_days BETWEEN 0 AND 90)
);

ALTER TABLE restaurants
    ADD COLUMN plan_id UUID REFERENCES plans (id),
    ADD COLUMN branding_configured_at TIMESTAMPTZ,
    ADD COLUMN trial_ends_at TIMESTAMPTZ,
    ADD COLUMN activated_at TIMESTAMPTZ,
    ADD COLUMN status_reason VARCHAR(300);
CREATE INDEX ix_restaurants_plan ON restaurants (plan_id);

CREATE TABLE restaurant_tables (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID         NOT NULL REFERENCES restaurants (id),
    label          VARCHAR(20)  NOT NULL,
    capacity       INTEGER,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version        BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_tables_capacity CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX uq_tables_label ON restaurant_tables (restaurant_id, lower(label));

CREATE TABLE plate_batches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(40)  NOT NULL,
    manufactured_on   DATE,
    quantity          INTEGER      NOT NULL,
    notes             VARCHAR(300),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_plate_batches_code UNIQUE (code),
    CONSTRAINT ck_plate_batches_quantity CHECK (quantity BETWEEN 1 AND 1000)
);

CREATE SEQUENCE plate_serial_seq START 1;

-- Inventario global (nao pertence a um restaurante): sem @TenantId, acesso somente pelo Super Admin.
CREATE TABLE plates (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial         VARCHAR(16)  NOT NULL,
    public_token   VARCHAR(16)  NOT NULL,
    batch_id       UUID         NOT NULL REFERENCES plate_batches (id),
    status         VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE',
    restaurant_id  UUID REFERENCES restaurants (id),
    table_id       UUID REFERENCES restaurant_tables (id),
    activated_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version        BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_plates_serial UNIQUE (serial),
    CONSTRAINT uq_plates_token UNIQUE (public_token),
    CONSTRAINT ck_plates_status CHECK (status IN ('AVAILABLE', 'RESERVED', 'ACTIVE', 'SUSPENDED', 'DAMAGED', 'DEACTIVATED')),
    -- Coerencia entre status e vinculo
    CONSTRAINT ck_plates_binding CHECK (
        (status IN ('AVAILABLE', 'DAMAGED', 'DEACTIVATED') AND restaurant_id IS NULL AND table_id IS NULL)
        OR (status = 'RESERVED' AND restaurant_id IS NOT NULL AND table_id IS NULL)
        OR (status IN ('ACTIVE', 'SUSPENDED') AND restaurant_id IS NOT NULL AND table_id IS NOT NULL))
);
CREATE INDEX ix_plates_status ON plates (status);
CREATE INDEX ix_plates_restaurant ON plates (restaurant_id);
CREATE INDEX ix_plates_batch ON plates (batch_id);
-- Uma mesa tem no maximo uma plaquinha em uso.
CREATE UNIQUE INDEX uq_plates_table_in_use ON plates (table_id) WHERE status IN ('ACTIVE', 'SUSPENDED');

CREATE TABLE plate_assignments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq            BIGSERIAL    NOT NULL,
    plate_id       UUID         NOT NULL REFERENCES plates (id),
    event          VARCHAR(30)  NOT NULL,
    from_status    VARCHAR(20),
    to_status      VARCHAR(20)  NOT NULL,
    restaurant_id  UUID REFERENCES restaurants (id),
    table_id       UUID REFERENCES restaurant_tables (id),
    actor_email    VARCHAR(160),
    reason         VARCHAR(300),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_plate_assignments_plate ON plate_assignments (plate_id, seq DESC);

CREATE TABLE platform_settings (
    key         VARCHAR(60) PRIMARY KEY,
    value       VARCHAR(300) NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (key, value) VALUES ('plate_price_cents', '3500');

-- Convites de acesso reutilizam a tabela de tokens com uma finalidade
ALTER TABLE password_reset_tokens ADD COLUMN purpose VARCHAR(20) NOT NULL DEFAULT 'RESET';
ALTER TABLE password_reset_tokens ADD CONSTRAINT ck_password_tokens_purpose CHECK (purpose IN ('RESET', 'INVITE'));

CREATE INDEX ix_audit_created ON audit_logs (created_at DESC);
