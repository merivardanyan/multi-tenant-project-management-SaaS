-- ProjectFlow MySQL Schema
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE users (
  id                  CHAR(36)           NOT NULL DEFAULT (UUID()),
  email               VARCHAR(255)       NOT NULL,
  password_hash       VARCHAR(255)       NOT NULL,
  name                VARCHAR(100)       NOT NULL,
  avatar_url          VARCHAR(500)           NULL DEFAULT NULL,
  plan                ENUM('free','pro') NOT NULL DEFAULT 'free',
  is_verified         TINYINT(1)         NOT NULL DEFAULT 0,
  verify_token        VARCHAR(100)           NULL DEFAULT NULL,
  verify_token_exp    DATETIME               NULL DEFAULT NULL,
  reset_token         VARCHAR(100)           NULL DEFAULT NULL,
  reset_token_exp     DATETIME               NULL DEFAULT NULL,
  stripe_customer_id  VARCHAR(100)           NULL DEFAULT NULL,
  created_at          DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email          (email),
  UNIQUE KEY uq_users_stripe         (stripe_customer_id),
         KEY idx_users_verify_token  (verify_token),
         KEY idx_users_reset_token   (reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)     NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  DATETIME     NOT NULL,
  revoked     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token (token_hash),
         KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspaces (
  id                  CHAR(36)           NOT NULL DEFAULT (UUID()),
  name                VARCHAR(100)       NOT NULL,
  slug                VARCHAR(100)       NOT NULL,
  owner_id            CHAR(36)           NOT NULL,
  plan                ENUM('free','pro') NOT NULL DEFAULT 'free',
  stripe_sub_id       VARCHAR(100)           NULL DEFAULT NULL,
  stripe_sub_status   VARCHAR(50)            NULL DEFAULT NULL,
  logo_url            VARCHAR(500)           NULL DEFAULT NULL,
  created_at          DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_workspace_slug       (slug),
  UNIQUE KEY uq_workspace_stripe_sub (stripe_sub_id),
         KEY idx_workspace_owner     (owner_id),
  CONSTRAINT fk_workspace_owner
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_members (
  id            CHAR(36)                       NOT NULL DEFAULT (UUID()),
  workspace_id  CHAR(36)                       NOT NULL,
  user_id       CHAR(36)                       NOT NULL,
  role          ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
  invited_by    CHAR(36)                           NULL DEFAULT NULL,
  joined_at     DATETIME                       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ws_member       (workspace_id, user_id),
         KEY idx_ws_member_user (user_id),
  CONSTRAINT fk_wsm_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
  CONSTRAINT fk_wsm_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_wsm_invited_by
    FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
