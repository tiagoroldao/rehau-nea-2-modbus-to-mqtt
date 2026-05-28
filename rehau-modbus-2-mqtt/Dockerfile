ARG BUILD_FROM
FROM ${BUILD_FROM} AS builder

WORKDIR /build
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# --- runtime ---
FROM ${BUILD_FROM}

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY --from=builder /build/dist ./dist
COPY rehau-modbus-2-mqtt/run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
