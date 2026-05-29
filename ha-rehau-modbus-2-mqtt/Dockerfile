ARG BUILD_FROM=ghcr.io/hassio-addons/base:17.1.4
FROM ghcr.io/home-assistant/base:latest

RUN apk add --no-cache nodejs npm bash tini

WORKDIR /app

COPY dist ./dist
COPY package.json ./
COPY run.sh /run.sh
RUN chmod +x /run.sh \
 && npm install --omit=dev --no-audit --no-fund --loglevel=error

CMD ["/run.sh"]
