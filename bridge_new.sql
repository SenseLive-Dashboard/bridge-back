CREATE TABLE bridge.bridge_brokers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
);


CREATE TABLE bridge.broker_mappings (
    id SERIAL PRIMARY KEY,
    source_broker_id INTEGER NOT NULL REFERENCES bridge.bridge_brokers(id) ON DELETE CASCADE,
    target_broker_id INTEGER NOT NULL REFERENCES bridge.bridge_brokers(id) ON DELETE CASCADE,
    source_topic VARCHAR(255) NOT NULL,
    target_topic VARCHAR(255) NOT NULL,
    transformations JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bridge.bridge_user_info (
	user_id varchar(255) NULL,
	first_name varchar(255) NULL,
	last_name varchar(255) NULL,
	personal_email varchar(255) NULL,
	user_type varchar(255) NULL,
	"password" varchar(255) NULL,
	verified int4 NULL,
	verification_token varchar(255) NULL
);
CREATE UNIQUE INDEX bridge_user_info_pkey ON bridge.bridge_user_info USING btree (user_id);


-- Create an index on the name column for faster lookups by name
CREATE INDEX idx_bridge_brokers_name ON bridge.bridge_brokers(id, name);

-- Create an index on the host column for efficient filtering or searching by host
CREATE INDEX idx_bridge_brokers_host ON bridge.bridge_brokers(id, host);

-- Create an index on the port column to optimize queries filtering by port
CREATE INDEX idx_bridge_brokers_port ON bridge.bridge_brokers(id,port);

-- Create a composite index for source_broker_id and source_topic to optimize lookups by source broker and topic
CREATE INDEX idx_broker_mappings_source ON bridge.broker_mappings(source_broker_id, source_topic);

-- Create a composite index for target_broker_id and target_topic to optimize lookups by target broker and topic
CREATE INDEX idx_broker_mappings_target ON bridge.broker_mappings(target_broker_id, target_topic);

-- Create an index on the transformations column for faster queries involving specific JSONB data
CREATE INDEX idx_broker_mappings_transformations ON bridge.broker_mappings USING gin(transformations);

-- Create an index on the created_at column for queries filtering or sorting by timestamp
CREATE INDEX idx_broker_mappings_created_at ON bridge.broker_mappings(created_at);
