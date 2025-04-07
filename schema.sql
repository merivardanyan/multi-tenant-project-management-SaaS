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

SET FOREIGN_KEY_CHECKS = 1;
