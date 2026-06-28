-- ============================================================
-- MIGRACIÓN: Módulo Agente IA
-- Segura de ejecutar en bases de datos existentes (idempotente)
-- ============================================================

DROP PROCEDURE IF EXISTS sp_migrate_agent_module;

DELIMITER //
CREATE PROCEDURE sp_migrate_agent_module()
BEGIN

    -- -------------------------------------------------------
    -- 1. agent_actions — registro de herramientas ejecutadas
    --    Cada vez que el agente crea una reserva, registra un
    --    lead o ejecuta cualquier tool_call se guarda aquí.
    -- -------------------------------------------------------
    CREATE TABLE IF NOT EXISTS agent_actions (
        id          VARCHAR(36)  PRIMARY KEY,
        tenant_id   VARCHAR(36)  NOT NULL,
        session_id  VARCHAR(36)  NULL    COMMENT 'chatbot_sessions.id',
        channel     ENUM('chat','whatsapp','voice','web') NOT NULL DEFAULT 'chat',
        tool_name   VARCHAR(100) NOT NULL,
        tool_input  JSON         NULL    COMMENT 'Argumentos que el modelo envió',
        tool_output JSON         NULL    COMMENT 'Resultado devuelto por la herramienta',
        success     TINYINT(1)   NOT NULL DEFAULT 1,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        INDEX idx_agent_actions_tenant   (tenant_id),
        INDEX idx_agent_actions_session  (session_id),
        INDEX idx_agent_actions_tool     (tenant_id, tool_name),
        INDEX idx_agent_actions_created  (tenant_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT 'Acciones ejecutadas por el agente IA (function calls)';

    -- -------------------------------------------------------
    -- 2. chatbot_config: columnas del agente
    --    agent_tools  → herramientas habilitadas por el tenant
    --    working_hours → horario en que responde el agente
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'chatbot_config'
          AND COLUMN_NAME  = 'agent_tools'
    ) THEN
        ALTER TABLE chatbot_config
            ADD COLUMN agent_tools    JSON NULL
                COMMENT 'Herramientas habilitadas: ["crear_reserva","registrar_interes_cliente"]',
            ADD COLUMN working_hours  JSON NULL
                COMMENT '{"start":"08:00","end":"22:00","days":[1,2,3,4,5]} — NULL = siempre activo';
    END IF;

    -- -------------------------------------------------------
    -- 3. chatbot_sessions: customer_phone (retrocompatibilidad)
    --    Ya está en el schema v3+. Se agrega solo si falta.
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'chatbot_sessions'
          AND COLUMN_NAME  = 'customer_phone'
    ) THEN
        ALTER TABLE chatbot_sessions
            ADD COLUMN customer_phone VARCHAR(50) NULL
                COMMENT 'Teléfono capturado por el agente al registrar un lead'
            AFTER customer_name;
    END IF;

END //
DELIMITER ;

CALL sp_migrate_agent_module();
DROP PROCEDURE IF EXISTS sp_migrate_agent_module;
