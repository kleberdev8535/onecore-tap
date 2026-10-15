-- OneCore Tap - Fase 5: comercial.
-- Pagamentos dos pedidos (registro operacional do restaurante), assinaturas e cobranças da OneCore Business,
-- venda de plaquinhas e funcionalidades por plano. Somente adições: nenhum dado existente é apagado.

-- ============================================================ Pagamentos dos pedidos (restaurante)

-- Um registro cobre um pedido ou todos os pedidos em aberto da mesa e pode ser dividido entre métodos.
-- É um registro operacional (o caixa confirma que recebeu): não é liquidação online. Nenhum dado de cartão é gravado.
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id       UUID         NOT NULL REFERENCES restaurants (id),
    scope               VARCHAR(10)  NOT NULL,
    table_id            UUID         REFERENCES restaurant_tables (id),
    table_label         VARCHAR(20),
    total_cents         INTEGER      NOT NULL,
    registered_by_id    UUID         REFERENCES users (id),
    registered_by_name  VARCHAR(120) NOT NULL,
    notes               VARCHAR(300),
    voided_at           TIMESTAMPTZ,
    voided_by_name      VARCHAR(120),
    void_reason         VARCHAR(300),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_payments_id_restaurant UNIQUE (id, restaurant_id),
    CONSTRAINT ck_payments_scope CHECK (scope IN ('ORDER', 'TABLE')),
    CONSTRAINT ck_payments_total CHECK (total_cents > 0),
    CONSTRAINT ck_payments_void CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);
CREATE INDEX ix_payments_restaurant_created ON payments (restaurant_id, created_at DESC);

CREATE TABLE payment_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID        NOT NULL REFERENCES restaurants (id),
    payment_id      UUID        NOT NULL,
    method          VARCHAR(10) NOT NULL,
    amount_cents    INTEGER     NOT NULL,
    -- Somente dinheiro: valor entregue pelo cliente, para registrar o troco.
    received_cents  INTEGER,
    CONSTRAINT fk_payment_entries_payment FOREIGN KEY (payment_id, restaurant_id) REFERENCES payments (id, restaurant_id) ON DELETE CASCADE,
    CONSTRAINT ck_payment_entries_method CHECK (method IN ('PIX', 'CASH', 'CARD')),
    CONSTRAINT ck_payment_entries_amount CHECK (amount_cents > 0),
    CONSTRAINT ck_payment_entries_received CHECK (received_cents IS NULL OR (method = 'CASH' AND received_cents >= amount_cents))
);
CREATE INDEX ix_payment_entries_payment ON payment_entries (payment_id);

ALTER TABLE orders
    ADD COLUMN payment_id UUID,
    ADD COLUMN paid_at TIMESTAMPTZ,
    ADD CONSTRAINT fk_orders_payment FOREIGN KEY (payment_id, restaurant_id) REFERENCES payments (id, restaurant_id),
    -- Coerência: pedido pago sempre aponta para o registro; pendente nunca aponta.
    ADD CONSTRAINT ck_orders_payment_link CHECK ((payment_status = 'PAID') = (payment_id IS NOT NULL AND paid_at IS NOT NULL));
CREATE INDEX ix_orders_payment ON orders (payment_id);
CREATE INDEX ix_orders_restaurant_payment ON orders (restaurant_id, payment_status);

-- ============================================================ Funcionalidades por plano

-- Módulos liberados pelo plano (códigos separados por vírgula). Planos existentes recebem todos os módulos.
ALTER TABLE plans ADD COLUMN modules VARCHAR(200) NOT NULL DEFAULT 'KITCHEN,FINANCE,REPORTS';

-- ============================================================ Assinaturas (OneCore Business)

CREATE TABLE subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id         UUID         NOT NULL REFERENCES restaurants (id),
    plan_id               UUID         NOT NULL REFERENCES plans (id),
    status                VARCHAR(20)  NOT NULL,
    -- Valor mensal congelado: mudar o preço do plano não altera assinaturas existentes.
    price_cents           INTEGER      NOT NULL,
    trial_ends_at         TIMESTAMPTZ,
    current_period_start  DATE,
    current_period_end    DATE,
    cancelled_at          TIMESTAMPTZ,
    cancel_reason         VARCHAR(300),
    -- Integração futura (ex.: Mercado Pago). Enquanto nula, cobranças são registradas manualmente.
    provider              VARCHAR(30),
    provider_reference    VARCHAR(120),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version               BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_subscriptions_restaurant UNIQUE (restaurant_id),
    CONSTRAINT ck_subscriptions_status CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED')),
    CONSTRAINT ck_subscriptions_price CHECK (price_cents >= 0),
    CONSTRAINT ck_subscriptions_period CHECK (current_period_end IS NULL OR current_period_end > current_period_start)
);
CREATE INDEX ix_subscriptions_status ON subscriptions (status);

CREATE TABLE subscription_invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID         NOT NULL REFERENCES subscriptions (id),
    restaurant_id     UUID         NOT NULL REFERENCES restaurants (id),
    plan_name         VARCHAR(80)  NOT NULL,
    period_start      DATE         NOT NULL,
    period_end        DATE         NOT NULL,
    amount_cents      INTEGER      NOT NULL,
    due_date          DATE         NOT NULL,
    status            VARCHAR(10)  NOT NULL DEFAULT 'OPEN',
    paid_at           TIMESTAMPTZ,
    payment_method    VARCHAR(20),
    registered_by     VARCHAR(160),
    notes             VARCHAR(300),
    provider_payment_id VARCHAR(120),
    voided_at         TIMESTAMPTZ,
    void_reason       VARCHAR(300),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version           BIGINT       NOT NULL DEFAULT 0,
    -- Rotina idempotente: uma cobrança por período.
    CONSTRAINT uq_invoices_period UNIQUE (subscription_id, period_start),
    CONSTRAINT ck_invoices_status CHECK (status IN ('OPEN', 'PAID', 'VOID')),
    CONSTRAINT ck_invoices_amount CHECK (amount_cents >= 0),
    CONSTRAINT ck_invoices_paid CHECK ((status = 'PAID') = (paid_at IS NOT NULL AND payment_method IS NOT NULL)),
    CONSTRAINT ck_invoices_method CHECK (payment_method IS NULL OR payment_method IN ('PIX', 'BOLETO', 'CARD', 'TRANSFER', 'CASH', 'OTHER'))
);
CREATE INDEX ix_invoices_status_due ON subscription_invoices (status, due_date);
CREATE INDEX ix_invoices_restaurant ON subscription_invoices (restaurant_id, period_start DESC);

-- Suspensão aplicada pela rotina de cobrança: só esta é desfeita automaticamente quando a dívida é quitada.
ALTER TABLE restaurants ADD COLUMN suspended_by_billing BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================ Venda de plaquinhas

CREATE TABLE plate_sales (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id     UUID         NOT NULL REFERENCES restaurants (id),
    quantity          INTEGER      NOT NULL,
    -- Preço congelado no momento da venda (platform_settings pode mudar depois).
    unit_price_cents  INTEGER      NOT NULL,
    total_cents       INTEGER      NOT NULL,
    status            VARCHAR(10)  NOT NULL DEFAULT 'OPEN',
    paid_at           TIMESTAMPTZ,
    payment_method    VARCHAR(20),
    notes             VARCHAR(300),
    registered_by     VARCHAR(160) NOT NULL,
    voided_at         TIMESTAMPTZ,
    void_reason       VARCHAR(300),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version           BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_plate_sales_quantity CHECK (quantity BETWEEN 1 AND 1000),
    CONSTRAINT ck_plate_sales_total CHECK (unit_price_cents >= 0 AND total_cents = unit_price_cents * quantity),
    CONSTRAINT ck_plate_sales_status CHECK (status IN ('OPEN', 'PAID', 'VOID')),
    CONSTRAINT ck_plate_sales_paid CHECK ((status = 'PAID') = (paid_at IS NOT NULL AND payment_method IS NOT NULL))
);
CREATE INDEX ix_plate_sales_restaurant ON plate_sales (restaurant_id, created_at DESC);

-- Carência (dias após o vencimento) antes da suspensão automática.
INSERT INTO platform_settings (key, value) VALUES ('billing_grace_days', '10') ON CONFLICT (key) DO NOTHING;

-- ============================================================ Backfill

-- Restaurantes já em operação com plano passam a ter assinatura. O período começa hoje; a primeira
-- cobrança é emitida pela rotina diária (nada é marcado como pago).
INSERT INTO subscriptions (restaurant_id, plan_id, status, price_cents, trial_ends_at, current_period_start, current_period_end)
SELECT r.id, r.plan_id,
       CASE WHEN r.status = 'TRIAL' THEN 'TRIALING' WHEN r.status = 'SUSPENDED' THEN 'SUSPENDED' ELSE 'ACTIVE' END,
       p.monthly_price_cents,
       r.trial_ends_at,
       CASE WHEN r.status = 'TRIAL' THEN NULL ELSE CURRENT_DATE END,
       CASE WHEN r.status = 'TRIAL' THEN NULL ELSE (CURRENT_DATE + INTERVAL '1 month')::date END
FROM restaurants r
JOIN plans p ON p.id = r.plan_id
WHERE r.status IN ('ACTIVE', 'TRIAL', 'SUSPENDED');
