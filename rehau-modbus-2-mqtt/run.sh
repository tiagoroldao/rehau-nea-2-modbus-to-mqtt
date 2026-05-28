#!/usr/bin/with-contenv bashio

export LOG_LEVEL=$(bashio::config 'log_level')

export MODBUS_HOST=$(bashio::config 'modbus_host')
export MODBUS_PORT=$(bashio::config 'modbus_port')
export MODBUS_UNIT_ID=$(bashio::config 'modbus_unit_id')

export MQTT_HOST=$(bashio::config 'mqtt_host')
export MQTT_PORT=$(bashio::config 'mqtt_port')
export MQTT_PROTOCOL=$(bashio::config 'mqtt_protocol')
export MQTT_USERNAME=$(bashio::config 'mqtt_username')
export MQTT_PASSWORD=$(bashio::config 'mqtt_password')
export MQTT_REJECT_UNAUTHORIZED=$(bashio::config 'mqtt_reject_unauthorized')
export MQTT_ENTITY_PREFIX=$(bashio::config 'mqtt_entity_prefix')
export MQTT_TOPIC=$(bashio::config 'mqtt_topic')

exec node /dist/main.js
