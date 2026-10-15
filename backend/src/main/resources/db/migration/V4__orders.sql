-- OneCore Tap - Fase 4: atendimento das mesas, pedidos, histórico e solicitações (garçom e conta)

-- Atendimento de uma mesa: abre no primeiro pedido e fecha quando a equipe encerra o atendimento.
-- A ocupação da mesa vem deste fluxo, nunca da simples leitura do QR Code.
CREATE TABLE table_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID        NOT NULL REFERENCES restaurants (id),
    table_id       UUID        NOT NULL REFERENCES restaurant_tables (id),
    opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at      TIMESTAMPTZ,
    closed_by      VARCHAR(160),
    CONSTRAINT uq_table_sessions_id_restaurant UNIQUE (id, restaurant_id)
);
-- No máximo um atendimento aberto por mesa (protege contra pedidos simultâneos).
CREATE UNIQUE INDEX uq_table_sessions_open ON table_sessions (table_id) WHERE closed_at IS NULL;
CREATE INDEX ix_table_sessions_restaurant ON table_sessions (restaurant_id, opened_at DESC);

-- Numeração sequencial de pedidos por restaurante (#0001, #0002...), incrementada de forma atômica.
CREATE TABLE restaurant_order_counters (
    restaurant_id  UUID    PRIMARY KEY REFERENCES restaurants (id),
    last_number    INTEGER NOT NULL
);

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id       UUID         NOT NULL REFERENCES restaurants (id),
    number              INTEGER      NOT NULL,
    table_id            UUID         NOT NULL REFERENCES restaurant_tables (id),
    table_label         VARCHAR(20)  NOT NULL,
    session_id          UUID         NOT NULL,
    -- Token aleatório para o cliente acompanhar o pedido sem login; não expõe o ID interno.
    tracking_token      VARCHAR(32)  NOT NULL,
    -- Identificador anônimo do aparelho do cliente (lista "meus pedidos" na mesa). Não é dado pessoal.
    client_token        VARCHAR(64)  NOT NULL,
    customer_name       VARCHAR(60),
    notes               VARCHAR(300),
    status              VARCHAR(30)  NOT NULL,
    payment_status      VARCHAR(20)  NOT NULL DEFAULT 'UNPAID',
    subtotal_cents      INTEGER      NOT NULL,
    total_cents         INTEGER      NOT NULL,
    -- Pedido de teste feito pela equipe ou pela OneCore Business durante a implantação.
    is_test             BOOLEAN      NOT NULL DEFAULT FALSE,
    confirmed_at        TIMESTAMPTZ,
    preparing_at        TIMESTAMPTZ,
    ready_at            TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       VARCHAR(300),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version             BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_orders_id_restaurant UNIQUE (id, restaurant_id),
    CONSTRAINT uq_orders_number UNIQUE (restaurant_id, number),
    CONSTRAINT uq_orders_tracking UNIQUE (tracking_token),
    CONSTRAINT fk_orders_session FOREIGN KEY (session_id, restaurant_id) REFERENCES table_sessions (id, restaurant_id),
    CONSTRAINT ck_orders_status CHECK (status IN ('AWAITING_CONFIRMATION', 'NEW', 'IN_PREPARATION', 'READY',
        'DELIVERED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_orders_payment CHECK (payment_status IN ('UNPAID', 'PAID')),
    CONSTRAINT ck_orders_totals CHECK (subtotal_cents >= 0 AND total_cents >= 0),
    -- Cancelamento sempre com motivo.
    CONSTRAINT ck_orders_cancel CHECK (status <> 'CANCELLED' OR cancel_reason IS NOT NULL)
);
CREATE INDEX ix_orders_restaurant_status ON orders (restaurant_id, status);
CREATE INDEX ix_orders_restaurant_created ON orders (restaurant_id, created_at DESC);
CREATE INDEX ix_orders_session ON orders (session_id);
CREATE INDEX ix_orders_client ON orders (client_token);

-- Itens gravam nome e preço praticados no momento da compra: o histórico não muda se o cardápio mudar.
CREATE TABLE order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id     UUID         NOT NULL REFERENCES restaurants (id),
    order_id          UUID         NOT NULL,
    product_id        UUID         REFERENCES products (id) ON DELETE SET NULL,
    product_name      VARCHAR(120) NOT NULL,
    unit_price_cents  INTEGER      NOT NULL,
    quantity          INTEGER      NOT NULL,
    total_cents       INTEGER      NOT NULL,
    notes             VARCHAR(200),
    position          INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id, restaurant_id) REFERENCES orders (id, restaurant_id) ON DELETE CASCADE,
    CONSTRAINT ck_order_items_quantity CHECK (quantity BETWEEN 1 AND 50),
    CONSTRAINT ck_order_items_prices CHECK (unit_price_cents >= 0 AND total_cents = unit_price_cents * quantity)
);
CREATE INDEX ix_order_items_order ON order_items (order_id, position);
CREATE INDEX ix_order_items_product ON order_items (restaurant_id, product_id);

CREATE TABLE order_item_options (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID        NOT NULL REFERENCES restaurants (id),
    order_item_id  UUID        NOT NULL REFERENCES order_items (id) ON DELETE CASCADE,
    group_name     VARCHAR(80) NOT NULL,
    option_id      UUID        REFERENCES addon_options (id) ON DELETE SET NULL,
    option_name    VARCHAR(80) NOT NULL,
    price_cents    INTEGER     NOT NULL,
    CONSTRAINT ck_order_item_options_price CHECK (price_cents >= 0)
);
CREATE INDEX ix_order_item_options_item ON order_item_options (order_item_id);

-- Histórico de movimentações de cada pedido (quem, quando, de onde para onde, motivo).
CREATE TABLE order_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq            BIGSERIAL    NOT NULL,
    restaurant_id  UUID         NOT NULL REFERENCES restaurants (id),
    order_id       UUID         NOT NULL,
    from_status    VARCHAR(30),
    to_status      VARCHAR(30)  NOT NULL,
    actor_user_id  UUID REFERENCES users (id),
    actor_name     VARCHAR(120),
    reason         VARCHAR(300),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_order_events_order FOREIGN KEY (order_id, restaurant_id) REFERENCES orders (id, restaurant_id) ON DELETE CASCADE
);
CREATE INDEX ix_order_events_order ON order_events (order_id, seq);

-- Chamar garçom e pedir a conta. Pedir a conta não marca nenhum pedido como pago.
CREATE TABLE service_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID         NOT NULL REFERENCES restaurants (id),
    table_id       UUID         NOT NULL REFERENCES restaurant_tables (id),
    table_label    VARCHAR(20)  NOT NULL,
    type           VARCHAR(20)  NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ,
    resolved_by    VARCHAR(120),
    CONSTRAINT ck_service_requests_type CHECK (type IN ('CALL_WAITER', 'REQUEST_BILL')),
    CONSTRAINT ck_service_requests_status CHECK (status IN ('OPEN', 'RESOLVED'))
);
-- Um chamado aberto por tipo e mesa: tocar o botão de novo não duplica.
CREATE UNIQUE INDEX uq_service_requests_open ON service_requests (table_id, type) WHERE status = 'OPEN';
CREATE INDEX ix_service_requests_restaurant ON service_requests (restaurant_id, status, created_at DESC);
