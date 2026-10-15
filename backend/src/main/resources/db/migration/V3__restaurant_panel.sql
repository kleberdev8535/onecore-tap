-- OneCore Tap - Fase 3: painel do restaurante (personalizacao, horarios, cardapio: categorias, produtos,
-- adicionais e variacoes)
--
-- Toda tabela do cardapio tem restaurant_id (@TenantId). As chaves estrangeiras entre elas sao compostas
-- (id, restaurant_id): o proprio banco impede que um produto aponte para a categoria de outro restaurante,
-- mesmo que uma regra da aplicacao falhe.

-- Personalizacao do cardapio publico e configuracoes operacionais do restaurante
ALTER TABLE restaurants
    ADD COLUMN description VARCHAR(300),
    ADD COLUMN cover_image_url VARCHAR(500),
    -- Pedidos do cardapio aguardam confirmacao do restaurante antes de ir para a cozinha (QR pode ser fotografado).
    ADD COLUMN require_order_confirmation BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE restaurant_opening_hours (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID     NOT NULL REFERENCES restaurants (id),
    weekday        SMALLINT NOT NULL,
    opens_at       TIME     NOT NULL,
    closes_at      TIME     NOT NULL,
    -- 1 = segunda ... 7 = domingo (ISO-8601). closes_at <= opens_at significa que fecha no dia seguinte.
    CONSTRAINT ck_opening_hours_weekday CHECK (weekday BETWEEN 1 AND 7),
    CONSTRAINT ck_opening_hours_range CHECK (opens_at <> closes_at)
);
CREATE INDEX ix_opening_hours_restaurant ON restaurant_opening_hours (restaurant_id, weekday, opens_at);

ALTER TABLE categories ADD COLUMN description VARCHAR(200);
ALTER TABLE categories ADD CONSTRAINT uq_categories_id_restaurant UNIQUE (id, restaurant_id);

CREATE TABLE products (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID         NOT NULL REFERENCES restaurants (id),
    category_id    UUID         NOT NULL,
    name           VARCHAR(120) NOT NULL,
    description    VARCHAR(500),
    price_cents    INTEGER      NOT NULL,
    image_url      VARCHAR(500),
    -- active = aparece no cardapio; available = false quando esgotado (aparece como indisponivel)
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    available      BOOLEAN      NOT NULL DEFAULT TRUE,
    featured       BOOLEAN      NOT NULL DEFAULT FALSE,
    position       INTEGER      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version        BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_products_id_restaurant UNIQUE (id, restaurant_id),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id, restaurant_id) REFERENCES categories (id, restaurant_id),
    CONSTRAINT ck_products_price CHECK (price_cents BETWEEN 0 AND 10000000)
);
CREATE UNIQUE INDEX uq_products_name ON products (category_id, lower(name));
CREATE INDEX ix_products_restaurant_category ON products (restaurant_id, category_id, position);

-- Grupos de adicionais e variacoes. Variacao (ex.: Tamanho) = grupo com escolha obrigatoria de 1 opcao
-- (min_choices = max_choices = 1); adicionais (ex.: Bacon, Queijo extra) = grupo opcional.
CREATE TABLE addon_groups (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID         NOT NULL REFERENCES restaurants (id),
    name           VARCHAR(80)  NOT NULL,
    min_choices    INTEGER      NOT NULL DEFAULT 0,
    max_choices    INTEGER      NOT NULL DEFAULT 1,
    position       INTEGER      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version        BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_addon_groups_id_restaurant UNIQUE (id, restaurant_id),
    CONSTRAINT ck_addon_groups_choices CHECK (min_choices >= 0 AND max_choices BETWEEN 1 AND 20 AND min_choices <= max_choices)
);
CREATE UNIQUE INDEX uq_addon_groups_name ON addon_groups (restaurant_id, lower(name));

CREATE TABLE addon_options (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  UUID         NOT NULL REFERENCES restaurants (id),
    group_id       UUID         NOT NULL,
    name           VARCHAR(80)  NOT NULL,
    price_cents    INTEGER      NOT NULL DEFAULT 0,
    available      BOOLEAN      NOT NULL DEFAULT TRUE,
    position       INTEGER      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    version        BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT fk_addon_options_group FOREIGN KEY (group_id, restaurant_id)
        REFERENCES addon_groups (id, restaurant_id) ON DELETE CASCADE,
    CONSTRAINT ck_addon_options_price CHECK (price_cents BETWEEN 0 AND 1000000)
);
CREATE UNIQUE INDEX uq_addon_options_name ON addon_options (group_id, lower(name));
CREATE INDEX ix_addon_options_group ON addon_options (group_id, position);

-- Quais grupos de adicionais aparecem em cada produto, e em que ordem.
CREATE TABLE product_addon_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID    NOT NULL REFERENCES restaurants (id),
    product_id      UUID    NOT NULL,
    addon_group_id  UUID    NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_product_addon_groups UNIQUE (product_id, addon_group_id),
    CONSTRAINT fk_pag_product FOREIGN KEY (product_id, restaurant_id)
        REFERENCES products (id, restaurant_id) ON DELETE CASCADE,
    CONSTRAINT fk_pag_group FOREIGN KEY (addon_group_id, restaurant_id)
        REFERENCES addon_groups (id, restaurant_id) ON DELETE CASCADE
);
CREATE INDEX ix_product_addon_groups_group ON product_addon_groups (addon_group_id);
