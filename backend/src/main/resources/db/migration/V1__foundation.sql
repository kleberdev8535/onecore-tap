-- OneCore Tap - Fase 1: fundacao (restaurantes, usuarios, autenticacao, auditoria, tenancy)

CREATE TABLE restaurants (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             VARCHAR(80)  NOT NULL,
    trade_name       VARCHAR(120) NOT NULL,
    legal_name       VARCHAR(160),
    cnpj             VARCHAR(14),
    email            VARCHAR(160),
    phone            VARCHAR(20),
    address_line     VARCHAR(200),
    city             VARCHAR(100),
    state            VARCHAR(2),
    postal_code      VARCHAR(8),
    logo_url         VARCHAR(500),
    primary_color    VARCHAR(7)   NOT NULL DEFAULT '#16A36B',
    accent_color     VARCHAR(7)   NOT NULL DEFAULT '#0B0F0E',
    status           VARCHAR(20)  NOT NULL DEFAULT 'ONBOARDING',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version          BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_restaurants_slug UNIQUE (slug),
    CONSTRAINT ck_restaurants_status CHECK (status IN ('ONBOARDING', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED')),
    CONSTRAINT ck_restaurants_cnpj CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
    CONSTRAINT ck_restaurants_colors CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$' AND accent_color ~ '^#[0-9A-Fa-f]{6}$')
);
CREATE UNIQUE INDEX uq_restaurants_cnpj ON restaurants (cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX ix_restaurants_status ON restaurants (status);

CREATE TABLE users (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id          UUID REFERENCES restaurants (id),
    name                   VARCHAR(120) NOT NULL,
    email                  VARCHAR(160) NOT NULL,
    password_hash          VARCHAR(255) NOT NULL,
    role                   VARCHAR(30)  NOT NULL,
    active                 BOOLEAN      NOT NULL DEFAULT TRUE,
    failed_login_attempts  INTEGER      NOT NULL DEFAULT 0,
    locked_until           TIMESTAMPTZ,
    last_login_at          TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version                BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_users_role CHECK (role IN ('SUPER_ADMIN', 'RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN')),
    -- Somente o Super Admin existe fora de um restaurante; todo funcionario pertence a exatamente um.
    CONSTRAINT ck_users_tenant CHECK ((role = 'SUPER_ADMIN') = (restaurant_id IS NULL))
);
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));
CREATE INDEX ix_users_restaurant ON users (restaurant_id);

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_password_reset_token UNIQUE (token_hash)
);
CREATE INDEX ix_password_reset_user ON password_reset_tokens (user_id);

CREATE TABLE audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID REFERENCES restaurants (id),
    actor_user_id  UUID REFERENCES users (id),
    actor_email    VARCHAR(160),
    action         VARCHAR(60)  NOT NULL,
    entity_type    VARCHAR(60),
    entity_id      VARCHAR(64),
    ip_address     VARCHAR(45),
    user_agent     VARCHAR(300),
    details        JSONB,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_restaurant_created ON audit_logs (restaurant_id, created_at DESC);
CREATE INDEX ix_audit_actor_created ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX ix_audit_action_created ON audit_logs (action, created_at DESC);

-- Primeiro recurso isolado por restaurante; serve de base para o cardapio (Fase 3).
CREATE TABLE categories (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID         NOT NULL REFERENCES restaurants (id),
    name           VARCHAR(80)  NOT NULL,
    position       INTEGER      NOT NULL DEFAULT 0,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version        BIGINT       NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_categories_name ON categories (restaurant_id, lower(name));
CREATE INDEX ix_categories_restaurant_position ON categories (restaurant_id, position);
