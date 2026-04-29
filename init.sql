CREATE DATABASE IF NOT EXISTS internationalweek;
USE internationalweek;

CREATE TABLE IF NOT EXISTS BANKS (
    id          VARCHAR(8)   NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255) DEFAULT NULL,
    url         VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS PO_IN (
    id           INT          NOT NULL AUTO_INCREMENT,
    po_id        VARCHAR(100) NOT NULL UNIQUE,
    po_amount    DECIMAL(10,2) NOT NULL,
    po_message   VARCHAR(255) DEFAULT NULL,
    po_datetime  DATETIME     DEFAULT NULL,
    ob_id        VARCHAR(8)   DEFAULT NULL,
    oa_id        VARCHAR(34)  DEFAULT NULL,
    ob_code      VARCHAR(10)  DEFAULT NULL,
    ob_datetime  DATETIME     DEFAULT NULL,
    cb_code      VARCHAR(10)  DEFAULT NULL,
    cb_datetime  DATETIME     DEFAULT NULL,
    bb_id        VARCHAR(8)   DEFAULT NULL,
    ba_id        VARCHAR(34)  DEFAULT NULL,
    bb_code      VARCHAR(10)  DEFAULT NULL,
    bb_datetime  DATETIME     DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS PO_OUT (
    id           INT          NOT NULL AUTO_INCREMENT,
    po_id        VARCHAR(100) NOT NULL,
    po_amount    DECIMAL(10,2) NOT NULL,
    po_message   VARCHAR(255) DEFAULT NULL,
    po_datetime  DATETIME     DEFAULT NULL,
    ob_id        VARCHAR(8)   DEFAULT NULL,
    oa_id        VARCHAR(34)  DEFAULT NULL,
    ob_code      VARCHAR(10)  DEFAULT NULL,
    ob_datetime  DATETIME     DEFAULT NULL,
    cb_code      VARCHAR(10)  DEFAULT NULL,
    cb_datetime  DATETIME     DEFAULT NULL,
    bb_id        VARCHAR(8)   DEFAULT NULL,
    ba_id        VARCHAR(34)  DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ACK_IN (
    id           INT          NOT NULL AUTO_INCREMENT,
    po_id        VARCHAR(100) NOT NULL,
    po_amount    DECIMAL(10,2) DEFAULT NULL,
    po_message   VARCHAR(255) DEFAULT NULL,
    po_datetime  DATETIME     DEFAULT NULL,
    ob_id        VARCHAR(8)   DEFAULT NULL,
    oa_id        VARCHAR(34)  DEFAULT NULL,
    ob_code      VARCHAR(10)  DEFAULT NULL,
    ob_datetime  DATETIME     DEFAULT NULL,
    cb_code      VARCHAR(10)  DEFAULT NULL,
    cb_datetime  DATETIME     DEFAULT NULL,
    bb_id        VARCHAR(8)   DEFAULT NULL,
    ba_id        VARCHAR(34)  DEFAULT NULL,
    bb_code      VARCHAR(10)  DEFAULT NULL,
    bb_datetime  DATETIME     DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS ACK_OUT (
    id           INT          NOT NULL AUTO_INCREMENT,
    po_id        VARCHAR(100) NOT NULL,
    po_amount    DECIMAL(10,2) DEFAULT NULL,
    po_message   VARCHAR(255) DEFAULT NULL,
    po_datetime  DATETIME     DEFAULT NULL,
    ob_id        VARCHAR(8)   DEFAULT NULL,
    oa_id        VARCHAR(34)  DEFAULT NULL,
    ob_code      VARCHAR(10)  DEFAULT NULL,
    ob_datetime  DATETIME     DEFAULT NULL,
    cb_code      VARCHAR(10)  DEFAULT NULL,
    cb_datetime  DATETIME     DEFAULT NULL,
    bb_id        VARCHAR(8)   DEFAULT NULL,
    ba_id        VARCHAR(34)  DEFAULT NULL,
    bb_code      VARCHAR(10)  DEFAULT NULL,
    bb_datetime  DATETIME     DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS LOG (
    id          INT          NOT NULL AUTO_INCREMENT,
    message     VARCHAR(255) DEFAULT NULL,
    type        VARCHAR(50)  DEFAULT NULL,
    po_id       VARCHAR(100) DEFAULT NULL,
    po_amount   DECIMAL(10,2) DEFAULT NULL,
    po_message  VARCHAR(255) DEFAULT NULL,
    ob_id       VARCHAR(8)   DEFAULT NULL,
    bb_id       VARCHAR(8)   DEFAULT NULL,
    cb_code     VARCHAR(10)  DEFAULT NULL,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS USERS (
    id          INT          NOT NULL AUTO_INCREMENT,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  DEFAULT 'user',
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

INSERT INTO BANKS VALUES ('AXABBE22', 'PingFin Clearing Bank Team 2', 'Emirhan, Rania, Arda, Denzl', NULL);

INSERT INTO USERS (username, password, role) VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

