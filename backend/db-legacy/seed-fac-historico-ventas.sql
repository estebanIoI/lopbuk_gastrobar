-- ============================================
-- SEED: Historico de Ventas 01/01/2026 - 26/03/2026
-- Tenant: tenant-demo-001
-- Negocio: Perfumeria Larry White
-- Genera ~15-20 ventas diarias (perfumes, ropa, salud)
-- ============================================

USE stockpro_db;

-- ============================================
-- FIX: Garantizar que exista la secuencia de facturas
-- (Evita el error "invoice_number cannot be null")
-- ============================================
INSERT IGNORE INTO invoice_sequence (tenant_id, current_number)
VALUES ('tenant-demo-001', 0);

-- ============================================
-- CATEGORIAS DE DEMO
-- ============================================
INSERT IGNORE INTO categories (id, tenant_id, name, description) VALUES
('perfumes', 'tenant-demo-001', 'Perfumes',  'Perfumes terminados por referencia'),
('ropa',     'tenant-demo-001', 'Ropa',       'Prendas de vestir'),
('salud',    'tenant-demo-001', 'Salud',      'Productos de salud e higiene'),
('insumos',  'tenant-demo-001', 'Insumos',    'Materia prima para produccion');

-- ============================================
-- PRODUCTOS DE DEMO: ROPA Y SALUD
-- (INSERT IGNORE = idempotente, no falla si ya existen)
-- Precio base = precio publico / 1.19 (sin IVA 19%)
-- ============================================
INSERT IGNORE INTO products
    (id, tenant_id, name, category, product_type, sku,
     stock, reorder_point, purchase_price, sale_price, entry_date, description)
VALUES
-- Ropa
('ROPA-CAM-001-ID', 'tenant-demo-001', 'Camiseta Basica',      'ropa',  'ropa',     'ROPA-CAM-001', 600, 20, 15000, 21008.40, CURDATE(), 'Camiseta basica unisex — $25.000 con IVA'),
('ROPA-PAN-001-ID', 'tenant-demo-001', 'Pantalon Casual',      'ropa',  'ropa',     'ROPA-PAN-001', 400, 15, 35000, 42016.81, CURDATE(), 'Pantalon casual unisex — $50.000 con IVA'),
('ROPA-SUD-001-ID', 'tenant-demo-001', 'Sudadera Clasica',     'ropa',  'ropa',     'ROPA-SUD-001', 400, 15, 25000, 33613.45, CURDATE(), 'Sudadera unisex — $40.000 con IVA'),
-- Salud
('SAL-SHA-001-ID',  'tenant-demo-001', 'Shampoo Hidratante',   'salud', 'farmacia', 'SAL-SHA-001',  500, 20, 12000, 16806.72, CURDATE(), 'Shampoo hidratante 400ml — $20.000 con IVA'),
('SAL-CRE-001-ID',  'tenant-demo-001', 'Crema Hidratante',     'salud', 'cosmetica','SAL-CRE-001',  500, 20, 18000, 25210.08, CURDATE(), 'Crema corporal 200ml — $30.000 con IVA'),
('SAL-JAB-001-ID',  'tenant-demo-001', 'Jabon Antibacterial',  'salud', 'farmacia', 'SAL-JAB-001',  800, 30,  5000,  8403.36, CURDATE(), 'Jabon antibacterial 120g — $10.000 con IVA');

-- ============================================
-- CLIENTES DE DEMO
-- (Requeridos por FK en sales.customer_id)
-- ============================================
INSERT IGNORE INTO customers (id, tenant_id, cedula, name, phone, credit_limit) VALUES
('cust-001', 'tenant-demo-001', '11111111', 'Carlos Mendez',  '3001000001', 500000),
('cust-002', 'tenant-demo-001', '22222222', 'Roberto Garcia', '3001000002', 300000),
('cust-003', 'tenant-demo-001', '33333333', 'Juan Perez',     '3001000003', 200000);

-- ============================================
-- STOCK INICIAL PARA CUBRIR EL HISTORICO
-- 85 dias x ~17 ventas/dia x ~1.5 items x ~1.4 uds = ~3000 movimientos aprox
-- ============================================

-- Insumos para perfumes (extractos + envases + cajas)
UPDATE products SET stock = stock + 20000 WHERE tenant_id = 'tenant-demo-001' AND id = 'MAT-EXT-LW-ID';
UPDATE products SET stock = stock + 1200  WHERE tenant_id = 'tenant-demo-001' AND id IN ('MAT-ENV-100-ID', 'MAT-ENV-050-ID', 'MAT-ENV-030-ID');
UPDATE products SET stock = stock + 1200  WHERE tenant_id = 'tenant-demo-001' AND id IN ('MAT-BOX-100-ID', 'MAT-BOX-050-ID', 'MAT-BOX-030-ID');

-- Perfumes terminados
UPDATE products SET stock = 1200 WHERE tenant_id = 'tenant-demo-001' AND id IN ('PERF-LW-100-ID', 'PERF-LW-050-ID', 'PERF-LW-030-ID');

-- Ropa y salud (ya insertados arriba con stock suficiente)
-- Si los productos ya existian, asegurar stock adecuado:
UPDATE products SET stock = GREATEST(stock, 600) WHERE tenant_id = 'tenant-demo-001' AND id IN ('ROPA-CAM-001-ID', 'ROPA-PAN-001-ID', 'ROPA-SUD-001-ID');
UPDATE products SET stock = GREATEST(stock, 500) WHERE tenant_id = 'tenant-demo-001' AND id IN ('SAL-SHA-001-ID', 'SAL-CRE-001-ID', 'SAL-JAB-001-ID');

-- ============================================
-- PROCEDIMIENTO PRINCIPAL
-- ============================================
DELIMITER //

CREATE PROCEDURE sp_seed_sales_history()
BEGIN
    DECLARE v_current_date    DATE        DEFAULT '2026-01-01';
    DECLARE v_end_date        DATE        DEFAULT '2026-03-26';
    DECLARE v_invoice_num     INT         DEFAULT 0;
    DECLARE v_day_of_week     INT;
    DECLARE v_sales_today     INT;
    DECLARE v_sale_counter    INT;
    DECLARE v_sale_id         VARCHAR(36);
    DECLARE v_invoice         VARCHAR(20);
    DECLARE v_product_idx     INT;
    DECLARE v_product_id      VARCHAR(36);
    DECLARE v_product_name    VARCHAR(255);
    DECLARE v_product_sku     VARCHAR(50);
    DECLARE v_unit_price      DECIMAL(12,2);
    DECLARE v_quantity        INT;
    DECLARE v_item_subtotal   DECIMAL(12,2);
    DECLARE v_sale_subtotal   DECIMAL(12,2);
    DECLARE v_sale_tax        DECIMAL(12,2);
    DECLARE v_sale_discount   DECIMAL(12,2);
    DECLARE v_sale_total      DECIMAL(12,2);
    DECLARE v_payment_method  VARCHAR(20);
    DECLARE v_payment_rand    INT;
    DECLARE v_seller_id       VARCHAR(36);
    DECLARE v_seller_name     VARCHAR(255);
    DECLARE v_customer_id     VARCHAR(36);
    DECLARE v_customer_name   VARCHAR(255);
    DECLARE v_customer_rand   INT;
    DECLARE v_num_items       INT;
    DECLARE v_item_counter    INT;
    DECLARE v_hour            INT;
    DECLARE v_minute          INT;
    DECLARE v_sale_datetime   DATETIME;
    DECLARE v_amount_paid     DECIMAL(12,2);
    DECLARE v_change_amount   DECIMAL(12,2);
    DECLARE v_total_sales     INT         DEFAULT 0;
    DECLARE v_credit_status   VARCHAR(20);
    DECLARE v_due_date        DATE;
    DECLARE v_item_id         VARCHAR(36);
    DECLARE v_used_product_1  INT         DEFAULT -1;
    DECLARE v_used_product_2  INT         DEFAULT -1;

    -- ============================================
    -- FIX NULL: inicializar con 0, luego leer secuencia
    -- ============================================
    SET v_invoice_num = 0;
    SELECT COALESCE(current_number, 0) INTO v_invoice_num
    FROM invoice_sequence
    WHERE tenant_id = 'tenant-demo-001'
    LIMIT 1;
    SET v_invoice_num = COALESCE(v_invoice_num, 0);

    -- ============================================
    -- LOOP POR CADA DIA
    -- ============================================
    WHILE v_current_date <= v_end_date DO
        SET v_day_of_week = DAYOFWEEK(v_current_date); -- 1=Dom, 7=Sab

        -- Ventas base segun dia: 15-20 transacciones
        IF v_day_of_week = 1 THEN         -- Domingo (mas tranquilo)
            SET v_sales_today = FLOOR(10 + RAND() * 6);  -- 10-15
        ELSEIF v_day_of_week = 7 THEN     -- Sabado (dia fuerte)
            SET v_sales_today = FLOOR(18 + RAND() * 5);  -- 18-22
        ELSEIF v_day_of_week IN (2, 6) THEN -- Lunes y Viernes
            SET v_sales_today = FLOOR(15 + RAND() * 5);  -- 15-19
        ELSE                               -- Martes a Jueves
            SET v_sales_today = FLOOR(14 + RAND() * 5);  -- 14-18
        END IF;

        -- Boost en quincenas (dias 15 y fin de mes)
        IF DAY(v_current_date) IN (15, 30, 31) OR
           (MONTH(v_current_date) = 2 AND DAY(v_current_date) = 28) THEN
            SET v_sales_today = v_sales_today + FLOOR(3 + RAND() * 4); -- +3 a +6
        END IF;

        SET v_sale_counter = 0;

        -- ============================================
        -- LOOP POR CADA VENTA DEL DIA
        -- ============================================
        WHILE v_sale_counter < v_sales_today DO
            SET v_invoice_num = v_invoice_num + 1;
            SET v_sale_id     = UUID();
            SET v_invoice     = CONCAT('FAC-', LPAD(v_invoice_num, 5, '0'));

            -- Hora aleatoria entre 9:00 y 19:59
            SET v_hour          = FLOOR(9 + RAND() * 11);
            SET v_minute        = FLOOR(RAND() * 60);
            SET v_sale_datetime = CONCAT(v_current_date, ' ',
                                    LPAD(v_hour, 2, '0'), ':',
                                    LPAD(v_minute, 2, '0'), ':00');

            -- Vendedor (60% vendedor, 40% comerciante)
            IF RAND() < 0.6 THEN
                SET v_seller_id   = 'usr-vendedor-001';
                SET v_seller_name = 'Vendedor Demo';
            ELSE
                SET v_seller_id   = 'usr-comerciante-001';
                SET v_seller_name = 'Comerciante Demo';
            END IF;

            -- Cliente (35% general, 25% Carlos, 20% Roberto, 20% Juan)
            SET v_customer_rand = FLOOR(RAND() * 100);
            IF v_customer_rand < 35 THEN
                SET v_customer_id   = NULL;
                SET v_customer_name = 'Cliente General';
            ELSEIF v_customer_rand < 60 THEN
                SET v_customer_id   = 'cust-001';
                SET v_customer_name = 'Carlos Mendez';
            ELSEIF v_customer_rand < 80 THEN
                SET v_customer_id   = 'cust-002';
                SET v_customer_name = 'Roberto Garcia';
            ELSE
                SET v_customer_id   = 'cust-003';
                SET v_customer_name = 'Juan Perez';
            END IF;

            -- Metodo de pago (45% efectivo, 30% tarjeta, 15% transferencia, 10% fiado)
            SET v_payment_rand = FLOOR(RAND() * 100);
            IF v_payment_rand < 45 THEN
                SET v_payment_method = 'efectivo';
            ELSEIF v_payment_rand < 75 THEN
                SET v_payment_method = 'tarjeta';
            ELSEIF v_payment_rand < 90 THEN
                SET v_payment_method = 'transferencia';
            ELSE
                IF v_customer_id IS NOT NULL THEN
                    SET v_payment_method = 'fiado';
                ELSE
                    SET v_payment_method = 'efectivo';
                END IF;
            END IF;

            -- Numero de items (55% = 1, 35% = 2, 10% = 3)
            SET v_payment_rand = FLOOR(RAND() * 100);
            IF v_payment_rand < 55 THEN
                SET v_num_items = 1;
            ELSEIF v_payment_rand < 90 THEN
                SET v_num_items = 2;
            ELSE
                SET v_num_items = 3;
            END IF;

            -- Credit status para fiado
            SET v_credit_status = NULL;
            SET v_due_date      = NULL;
            IF v_payment_method = 'fiado' THEN
                SET v_credit_status = 'pendiente';
                SET v_due_date      = DATE_ADD(v_current_date, INTERVAL 30 DAY);
            END IF;

            -- Insertar venta con totales en 0 (se actualizan al final)
            INSERT INTO sales
                (id, tenant_id, invoice_number, customer_id, customer_name,
                 subtotal, tax, discount, total,
                 payment_method, amount_paid, change_amount,
                 seller_id, seller_name, status,
                 credit_status, due_date, created_at)
            VALUES
                (v_sale_id, 'tenant-demo-001', v_invoice,
                 v_customer_id, v_customer_name,
                 0, 0, 0, 0,
                 v_payment_method, 0, 0,
                 v_seller_id, v_seller_name, 'completada',
                 v_credit_status, v_due_date, v_sale_datetime);

            SET v_sale_subtotal  = 0;
            SET v_item_counter   = 0;
            SET v_used_product_1 = -1;
            SET v_used_product_2 = -1;

            -- ============================================
            -- LOOP POR CADA ITEM DE LA VENTA
            -- Productos 1-3: Perfumeria  (~40% del total de items)
            -- Productos 4-6: Ropa        (~35%)
            -- Productos 7-9: Salud       (~25%)
            -- ============================================
            WHILE v_item_counter < v_num_items DO

                -- Seleccionar producto evitando repetidos en la misma venta
                product_loop: LOOP
                    SET v_payment_rand = FLOOR(RAND() * 100);
                    IF v_payment_rand < 14 THEN
                        SET v_product_idx = 1; -- Perfume 100ML
                    ELSEIF v_payment_rand < 28 THEN
                        SET v_product_idx = 2; -- Perfume 50ML
                    ELSEIF v_payment_rand < 40 THEN
                        SET v_product_idx = 3; -- Perfume 30ML
                    ELSEIF v_payment_rand < 55 THEN
                        SET v_product_idx = 4; -- Camiseta
                    ELSEIF v_payment_rand < 68 THEN
                        SET v_product_idx = 5; -- Pantalon
                    ELSEIF v_payment_rand < 78 THEN
                        SET v_product_idx = 6; -- Sudadera
                    ELSEIF v_payment_rand < 86 THEN
                        SET v_product_idx = 7; -- Shampoo
                    ELSEIF v_payment_rand < 93 THEN
                        SET v_product_idx = 8; -- Crema
                    ELSE
                        SET v_product_idx = 9; -- Jabon
                    END IF;

                    IF v_product_idx != v_used_product_1 AND
                       v_product_idx != v_used_product_2 THEN
                        LEAVE product_loop;
                    END IF;
                END LOOP;

                IF v_item_counter = 0 THEN
                    SET v_used_product_1 = v_product_idx;
                ELSEIF v_item_counter = 1 THEN
                    SET v_used_product_2 = v_product_idx;
                END IF;

                CASE v_product_idx
                    WHEN 1 THEN
                        SET v_product_id   = 'PERF-LW-100-ID';
                        SET v_product_name = 'Perfume Larry White 100ML';
                        SET v_product_sku  = 'PERF-LW-100';
                        SET v_unit_price   = 63025.21; -- $75.000 con IVA 19%
                    WHEN 2 THEN
                        SET v_product_id   = 'PERF-LW-050-ID';
                        SET v_product_name = 'Perfume Larry White 50ML';
                        SET v_product_sku  = 'PERF-LW-050';
                        SET v_unit_price   = 31932.77; -- $38.000 con IVA 19%
                    WHEN 3 THEN
                        SET v_product_id   = 'PERF-LW-030-ID';
                        SET v_product_name = 'Perfume Larry White 30ML';
                        SET v_product_sku  = 'PERF-LW-030';
                        SET v_unit_price   = 18487.39; -- $22.000 con IVA 19%
                    WHEN 4 THEN
                        SET v_product_id   = 'ROPA-CAM-001-ID';
                        SET v_product_name = 'Camiseta Basica';
                        SET v_product_sku  = 'ROPA-CAM-001';
                        SET v_unit_price   = 21008.40; -- $25.000 con IVA 19%
                    WHEN 5 THEN
                        SET v_product_id   = 'ROPA-PAN-001-ID';
                        SET v_product_name = 'Pantalon Casual';
                        SET v_product_sku  = 'ROPA-PAN-001';
                        SET v_unit_price   = 42016.81; -- $50.000 con IVA 19%
                    WHEN 6 THEN
                        SET v_product_id   = 'ROPA-SUD-001-ID';
                        SET v_product_name = 'Sudadera Clasica';
                        SET v_product_sku  = 'ROPA-SUD-001';
                        SET v_unit_price   = 33613.45; -- $40.000 con IVA 19%
                    WHEN 7 THEN
                        SET v_product_id   = 'SAL-SHA-001-ID';
                        SET v_product_name = 'Shampoo Hidratante';
                        SET v_product_sku  = 'SAL-SHA-001';
                        SET v_unit_price   = 16806.72; -- $20.000 con IVA 19%
                    WHEN 8 THEN
                        SET v_product_id   = 'SAL-CRE-001-ID';
                        SET v_product_name = 'Crema Hidratante';
                        SET v_product_sku  = 'SAL-CRE-001';
                        SET v_unit_price   = 25210.08; -- $30.000 con IVA 19%
                    WHEN 9 THEN
                        SET v_product_id   = 'SAL-JAB-001-ID';
                        SET v_product_name = 'Jabon Antibacterial';
                        SET v_product_sku  = 'SAL-JAB-001';
                        SET v_unit_price   = 8403.36;  -- $10.000 con IVA 19%
                END CASE;

                -- Cantidad: 70% = 1, 25% = 2, 5% = 3
                SET v_payment_rand = FLOOR(RAND() * 100);
                IF v_payment_rand < 70 THEN
                    SET v_quantity = 1;
                ELSEIF v_payment_rand < 95 THEN
                    SET v_quantity = 2;
                ELSE
                    SET v_quantity = 3;
                END IF;

                SET v_item_subtotal = v_unit_price * v_quantity;
                SET v_sale_subtotal = v_sale_subtotal + v_item_subtotal;
                SET v_item_id       = UUID();

                -- Insertar item de venta
                INSERT INTO sale_items
                    (id, tenant_id, sale_id, product_id, product_name, product_sku,
                     quantity, unit_price, discount, subtotal, created_at)
                VALUES
                    (v_item_id, 'tenant-demo-001', v_sale_id,
                     v_product_id, v_product_name, v_product_sku,
                     v_quantity, v_unit_price, 0, v_item_subtotal, v_sale_datetime);

                -- Movimiento de stock
                INSERT INTO stock_movements
                    (id, tenant_id, product_id, type, quantity,
                     previous_stock, new_stock,
                     reason, reference_id, user_id, created_at)
                SELECT UUID(), 'tenant-demo-001', v_product_id,
                       'venta', v_quantity,
                       p.stock, p.stock - v_quantity,
                       CONCAT('Venta ', v_invoice), v_sale_id, v_seller_id,
                       v_sale_datetime
                FROM products p
                WHERE p.id = v_product_id AND p.tenant_id = 'tenant-demo-001';

                -- Descontar stock del producto
                UPDATE products
                SET stock = stock - v_quantity
                WHERE id = v_product_id AND tenant_id = 'tenant-demo-001';

                SET v_item_counter = v_item_counter + 1;
            END WHILE;

            -- Calcular totales reales
            SET v_sale_tax = ROUND(v_sale_subtotal * 0.19, 2);

            -- Descuento: 15% de probabilidad, 5% o 10%
            IF RAND() < 0.15 THEN
                IF RAND() < 0.7 THEN
                    SET v_sale_discount = ROUND(v_sale_subtotal * 0.05, 2);
                ELSE
                    SET v_sale_discount = ROUND(v_sale_subtotal * 0.10, 2);
                END IF;
            ELSE
                SET v_sale_discount = 0;
            END IF;

            SET v_sale_total = v_sale_subtotal + v_sale_tax - v_sale_discount;

            -- Calcular pago y cambio
            IF v_payment_method = 'efectivo' THEN
                SET v_amount_paid = CEIL(v_sale_total / 1000) * 1000;
                IF RAND() < 0.3 AND v_sale_total < 100000 THEN
                    SET v_amount_paid = CEIL(v_sale_total / 50000) * 50000;
                END IF;
                SET v_change_amount = v_amount_paid - v_sale_total;
            ELSE
                SET v_amount_paid   = v_sale_total;
                SET v_change_amount = 0;
            END IF;

            -- Actualizar venta con totales reales
            UPDATE sales
            SET subtotal      = v_sale_subtotal,
                tax           = v_sale_tax,
                discount      = v_sale_discount,
                total         = v_sale_total,
                amount_paid   = v_amount_paid,
                change_amount = v_change_amount
            WHERE id = v_sale_id;

            SET v_total_sales   = v_total_sales + 1;
            SET v_sale_counter  = v_sale_counter + 1;
        END WHILE;

        SET v_current_date = DATE_ADD(v_current_date, INTERVAL 1 DAY);
    END WHILE;

    -- Actualizar secuencia de facturas
    UPDATE invoice_sequence
    SET current_number = v_invoice_num
    WHERE tenant_id = 'tenant-demo-001';

    -- Resultado final
    SELECT
        v_total_sales AS ventas_generadas,
        v_invoice_num AS ultimo_numero_factura,
        (SELECT COUNT(*)
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.tenant_id = 'tenant-demo-001'
           AND s.created_at >= '2026-01-01') AS total_items_generados,
        (SELECT SUM(total)
         FROM sales
         WHERE tenant_id = 'tenant-demo-001'
           AND created_at >= '2026-01-01'
           AND status = 'completada') AS total_facturado;
END //

DELIMITER ;

-- ============================================
-- EJECUTAR EL SEED
-- ============================================
CALL sp_seed_sales_history();

-- Limpiar procedimiento temporal
DROP PROCEDURE IF EXISTS sp_seed_sales_history;

-- ============================================
-- VERIFICACION: Resumen de ventas generadas
-- ============================================
SELECT '--- RESUMEN POR MES ---' AS info;

SELECT
    DATE_FORMAT(created_at, '%Y-%m') AS mes,
    COUNT(*)                          AS num_ventas,
    SUM(total)                        AS total_facturado,
    AVG(total)                        AS promedio_venta,
    MIN(total)                        AS venta_minima,
    MAX(total)                        AS venta_maxima
FROM sales
WHERE tenant_id = 'tenant-demo-001'
  AND created_at >= '2026-01-01'
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY mes;

SELECT '--- VENTAS POR METODO DE PAGO ---' AS info;

SELECT
    payment_method,
    COUNT(*)   AS num_ventas,
    SUM(total) AS total
FROM sales
WHERE tenant_id = 'tenant-demo-001'
  AND created_at >= '2026-01-01'
GROUP BY payment_method
ORDER BY num_ventas DESC;

SELECT '--- VENTAS POR DIA DE LA SEMANA ---' AS info;

SELECT
    DAYNAME(created_at)   AS dia,
    COUNT(*)              AS num_ventas,
    SUM(total)            AS total
FROM sales
WHERE tenant_id = 'tenant-demo-001'
  AND created_at >= '2026-01-01'
GROUP BY DAYNAME(created_at), DAYOFWEEK(created_at)
ORDER BY DAYOFWEEK(created_at);

SELECT '--- PRODUCTOS MAS VENDIDOS ---' AS info;

SELECT
    si.product_name,
    si.product_sku,
    SUM(si.quantity) AS unidades_vendidas,
    SUM(si.subtotal) AS total_revenue
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE s.tenant_id = 'tenant-demo-001'
  AND s.created_at >= '2026-01-01'
GROUP BY si.product_id, si.product_name, si.product_sku
ORDER BY unidades_vendidas DESC;

SELECT '--- VENTAS POR CATEGORIA ---' AS info;

SELECT
    CASE
        WHEN si.product_sku LIKE 'PERF-%' THEN 'Perfumeria'
        WHEN si.product_sku LIKE 'ROPA-%' THEN 'Ropa'
        WHEN si.product_sku LIKE 'SAL-%'  THEN 'Salud'
        ELSE 'Otro'
    END AS categoria,
    COUNT(DISTINCT s.id)  AS num_ventas,
    SUM(si.quantity)      AS unidades_vendidas,
    SUM(si.subtotal)      AS total_revenue
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE s.tenant_id = 'tenant-demo-001'
  AND s.created_at >= '2026-01-01'
GROUP BY categoria
ORDER BY total_revenue DESC;

SELECT '--- STOCK DE PERFUMES ---' AS info;

SELECT name, sku, stock,
    CASE WHEN stock <= 10 THEN 'REORDEN' ELSE 'OK' END AS estado
FROM products
WHERE tenant_id = 'tenant-demo-001'
  AND sku LIKE 'PERF-%'
ORDER BY sku;

SELECT '--- STOCK DE ROPA ---' AS info;

SELECT name, sku, stock,
    CASE WHEN stock <= reorder_point THEN 'REORDEN' ELSE 'OK' END AS estado
FROM products
WHERE tenant_id = 'tenant-demo-001'
  AND sku LIKE 'ROPA-%'
ORDER BY sku;

SELECT '--- STOCK DE SALUD ---' AS info;

SELECT name, sku, stock,
    CASE WHEN stock <= reorder_point THEN 'REORDEN' ELSE 'OK' END AS estado
FROM products
WHERE tenant_id = 'tenant-demo-001'
  AND sku LIKE 'SAL-%'
ORDER BY sku;

SELECT '--- STOCK DE INSUMOS ---' AS info;

SELECT name, sku, stock, reorder_point,
    CASE
        WHEN stock = 0              THEN 'AGOTADO'
        WHEN stock <= reorder_point THEN 'BAJO'
        ELSE 'OK'
    END AS estado
FROM products
WHERE tenant_id = 'tenant-demo-001'
  AND sku LIKE 'MAT-%'
ORDER BY sku;
