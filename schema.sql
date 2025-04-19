-- =============================================================
--  SaaS Project Management App — MySQL Schema DDL
--  Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -------------------------------------------------------------
-- 1. USERS
-- -------------------------------------------------------------
CREATE TABLE users (
  id                  CHAR(36)        NOT NULL DEFAULT (UUID()),
  email               VARCHAR(255)    NOT NULL,
  password_hash       VARCHAR(255)    NOT NULL,
  name                VARCHAR(100)    NOT NULL,
  avatar_url          VARCHAR(500)        NULL DEFAULT NULL,
  plan                ENUM('free','pro') NOT NULL DEFAULT 'free',
  is_verified         TINYINT(1)      NOT NULL DEFAULT 0,
  verify_token        VARCHAR(100)        NULL DEFAULT NULL,
  verify_token_exp    DATETIME            NULL DEFAULT NULL,
  reset_token         VARCHAR(100)        NULL DEFAULT NULL,
  reset_token_exp     DATETIME            NULL DEFAULT NULL,
  stripe_customer_id  VARCHAR(100)        NULL DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_users_email           (email),
  UNIQUE  KEY uq_users_stripe          (stripe_customer_id),
          KEY idx_users_verify_token   (verify_token),
          KEY idx_users_reset_token    (reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 2. REFRESH TOKENS
-- -------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id     CHAR(36)    NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  DATETIME    NOT NULL,
  revoked     TINYINT(1)  NOT NULL DEFAULT 0,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_refresh_token        (token_hash),
          KEY idx_refresh_user        (user_id),
  CONSTRAINT fk_refresh_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 3. WORKSPACES
-- -------------------------------------------------------------
CREATE TABLE workspaces (
  id                  CHAR(36)        NOT NULL DEFAULT (UUID()),
  name                VARCHAR(100)    NOT NULL,
  slug                VARCHAR(100)    NOT NULL,
  owner_id            CHAR(36)        NOT NULL,
  plan                ENUM('free','pro') NOT NULL DEFAULT 'free',
  stripe_sub_id       VARCHAR(100)        NULL DEFAULT NULL,
  stripe_sub_status   VARCHAR(50)         NULL DEFAULT NULL,
  logo_url            VARCHAR(500)        NULL DEFAULT NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_workspace_slug       (slug),
  UNIQUE  KEY uq_workspace_stripe_sub (stripe_sub_id),
          KEY idx_workspace_owner     (owner_id),
  CONSTRAINT fk_workspace_owner
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 4. WORKSPACE MEMBERS
-- -------------------------------------------------------------
CREATE TABLE workspace_members (
  id            CHAR(36)                        NOT NULL DEFAULT (UUID()),
  workspace_id  CHAR(36)                        NOT NULL,
  user_id       CHAR(36)                        NOT NULL,
  role          ENUM('owner','admin','member')  NOT NULL DEFAULT 'member',
  invited_by    CHAR(36)                            NULL DEFAULT NULL,
  joined_at     DATETIME                        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_ws_member            (workspace_id, user_id),
          KEY idx_ws_member_user      (user_id),
  CONSTRAINT fk_wsm_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
  CONSTRAINT fk_wsm_user
    FOREIGN KEY (user_id)      REFERENCES users (id)      ON DELETE CASCADE,
  CONSTRAINT fk_wsm_invited_by
    FOREIGN KEY (invited_by)   REFERENCES users (id)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 5. WORKSPACE INVITATIONS
-- -------------------------------------------------------------
CREATE TABLE workspace_invitations (
  id            CHAR(36)                        NOT NULL DEFAULT (UUID()),
  workspace_id  CHAR(36)                        NOT NULL,
  invited_by    CHAR(36)                        NOT NULL,
  email         VARCHAR(255)                    NOT NULL,
  role          ENUM('admin','member')          NOT NULL DEFAULT 'member',
  token         VARCHAR(100)                    NOT NULL,
  expires_at    DATETIME                        NOT NULL,
  accepted_at   DATETIME                            NULL DEFAULT NULL,
  created_at    DATETIME                        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_invite_token         (token),
          KEY idx_invite_workspace    (workspace_id),
          KEY idx_invite_email        (email),
  CONSTRAINT fk_invite_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
  CONSTRAINT fk_invite_by
    FOREIGN KEY (invited_by)   REFERENCES users (id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 6. PROJECTS
-- -------------------------------------------------------------
CREATE TABLE projects (
  id            CHAR(36)        NOT NULL DEFAULT (UUID()),
  workspace_id  CHAR(36)        NOT NULL,
  name          VARCHAR(100)    NOT NULL,
  description   TEXT                NULL DEFAULT NULL,
  color         CHAR(7)         NOT NULL DEFAULT '#6366f1',
  is_archived   TINYINT(1)      NOT NULL DEFAULT 0,
  created_by    CHAR(36)        NOT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
          KEY idx_project_workspace   (workspace_id),
          KEY idx_project_created_by  (created_by),
          KEY idx_project_archived    (workspace_id, is_archived),
  CONSTRAINT fk_project_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_created_by
    FOREIGN KEY (created_by)   REFERENCES users (id)      ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 7. COLUMNS
-- -------------------------------------------------------------
CREATE TABLE columns (
  id          CHAR(36)        NOT NULL DEFAULT (UUID()),
  project_id  CHAR(36)        NOT NULL,
  title       VARCHAR(80)     NOT NULL,
  color       CHAR(7)             NULL DEFAULT NULL,
  position    FLOAT           NOT NULL DEFAULT 0,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
          KEY idx_column_project      (project_id),
          KEY idx_column_position     (project_id, position),
  CONSTRAINT fk_column_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 8. TASKS
-- -------------------------------------------------------------
CREATE TABLE tasks (
  id            CHAR(36)                                NOT NULL DEFAULT (UUID()),
  column_id     CHAR(36)                                NOT NULL,
  project_id    CHAR(36)                                NOT NULL,
  title         VARCHAR(255)                            NOT NULL,
  description   TEXT                                        NULL DEFAULT NULL,
  assignee_id   CHAR(36)                                    NULL DEFAULT NULL,
  created_by    CHAR(36)                                NOT NULL,
  priority      ENUM('none','low','medium','high','urgent') NOT NULL DEFAULT 'none',
  due_date      DATE                                        NULL DEFAULT NULL,
  position      FLOAT                                   NOT NULL DEFAULT 0,
  created_at    DATETIME                                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME                                NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
          KEY idx_task_column         (column_id),
          KEY idx_task_project        (project_id),
          KEY idx_task_assignee       (assignee_id),
          KEY idx_task_position       (column_id, position),
          KEY idx_task_due            (due_date),
  CONSTRAINT fk_task_column
    FOREIGN KEY (column_id)   REFERENCES columns  (id)   ON DELETE CASCADE,
  CONSTRAINT fk_task_project
    FOREIGN KEY (project_id)  REFERENCES projects (id)   ON DELETE CASCADE,
  CONSTRAINT fk_task_assignee
    FOREIGN KEY (assignee_id) REFERENCES users    (id)   ON DELETE SET NULL,
  CONSTRAINT fk_task_created_by
    FOREIGN KEY (created_by)  REFERENCES users    (id)   ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- 9. TASK LABELS
-- -------------------------------------------------------------
CREATE TABLE labels (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()),
  project_id  CHAR(36)    NOT NULL,
  name        VARCHAR(50) NOT NULL,
  color       CHAR(7)     NOT NULL DEFAULT '#64748b',
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
          KEY idx_label_project   (project_id),
  CONSTRAINT fk_label_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_labels (
  task_id   CHAR(36) NOT NULL,
  label_id  CHAR(36) NOT NULL,

  PRIMARY KEY (task_id, label_id),
  CONSTRAINT fk_tl_task
    FOREIGN KEY (task_id)  REFERENCES tasks  (id) ON DELETE CASCADE,
  CONSTRAINT fk_tl_label
    FOREIGN KEY (label_id) REFERENCES labels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
