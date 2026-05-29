#!/usr/bin/with-contenv bashio

set -euo pipefail

opt() { bashio::config "$1" "${2:-}"; }

export LOG_LEVEL=$(opt 'log_level')

export MODBUS_HOST=$(opt 'modbus_host')
export MODBUS_PORT=$(opt 'modbus_port')
export MODBUS_UNIT_ID=$(opt 'modbus_unit_id')

export MQTT_ENTITY_PREFIX=$(opt 'mqtt_entity_prefix')
export MQTT_TOPIC=$(opt 'mqtt_topic')


# MQTT — prefer explicit overrides, otherwise fall back to the HA "mqtt"
# service announced by the Mosquitto add-on.
MQTT_HOST_OPT=$(opt 'mqtt_host')
MQTT_PORT_OPT=$(opt 'mqtt_port')
MQTT_PROTOCOL_OPT=$(opt 'mqtt_protocol')
MQTT_USERNAME_OPT=$(opt 'mqtt_username')
MQTT_PASSWORD_OPT=$(opt 'mqtt_password')

if [ -n "${MQTT_HOST_OPT}" ]; then
  export MQTT_HOST="${MQTT_HOST_OPT}"
  export MQTT_PORT="${MQTT_PORT_OPT}"
  export MQTT_PROTOCOL="${MQTT_PROTOCOL_OPT}"
  export MQTT_USERNAME="${MQTT_USERNAME_OPT}"
  export MQTT_PASSWORD="${MQTT_PASSWORD_OPT}"
  bashio::log.info "Using explicit MQTT broker: ${MQTT_HOST}:${MQTT_PORT}"
elif bashio::services.available 'mqtt'; then
  export MQTT_HOST="$(bashio::services mqtt 'host')"
  export MQTT_PORT="$(bashio::services mqtt 'port')"
  export MQTT_PROTOCOL="mqtt"
  export MQTT_USERNAME="$(bashio::services mqtt 'username')"
  export MQTT_PASSWORD="$(bashio::services mqtt 'password')"
  bashio::log.info "Using HA-provided MQTT broker: ${MQTT_HOST}:${MQTT_PORT}"
else
  bashio::log.warning "No MQTT broker configured."
  export MQTT_HOST=""
  export MQTT_PORT=""
  export MQTT_PROTOCOL=""
  export MQTT_USERNAME=""
  export MQTT_PASSWORD=""
fi

cd /app
exec node dist/main.js
