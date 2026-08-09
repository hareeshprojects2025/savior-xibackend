CREATE DATABASE IF NOT EXISTS savior_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE savior_db;

CREATE TABLE emergencies (
  id            INT           NOT NULL AUTO_INCREMENT,
  caller_name   VARCHAR(255)  NOT NULL,
  caller_phone  VARCHAR(20)   DEFAULT NULL,
  victim_name   VARCHAR(255)  DEFAULT NULL,
  emergency_type VARCHAR(100) NOT NULL,
  severity      VARCHAR(50)   DEFAULT NULL,
  location      VARCHAR(500)  NOT NULL,
  landmark      VARCHAR(500)  DEFAULT NULL,
  victims       INT           DEFAULT NULL,
  description   TEXT          DEFAULT NULL,
  immediate_danger VARCHAR(255) DEFAULT NULL,
  summary       TEXT          DEFAULT NULL,
  latitude      FLOAT         DEFAULT NULL,
  longitude     FLOAT         DEFAULT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  full_transcript TEXT        DEFAULT NULL,
  bolna_call_id VARCHAR(255)  DEFAULT NULL,
  created_at    DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX ix_emergencies_bolna_call_id (bolna_call_id)
);

CREATE TABLE transcript_chunks (
  id            INT           NOT NULL AUTO_INCREMENT,
  emergency_id  INT           NOT NULL,
  chunk_text    TEXT          NOT NULL,
  is_final      TINYINT(1)    DEFAULT 0,
  created_at    DATETIME      DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX ix_transcript_chunks_emergency_id (emergency_id),
  CONSTRAINT fk_transcript_chunks_emergency
    FOREIGN KEY (emergency_id) REFERENCES emergencies(id) ON DELETE CASCADE
);