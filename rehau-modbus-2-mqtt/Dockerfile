ARG BUILD_FROM=ghcr.io/hassio-addons/base:17.1.4
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs npm bash tini

WORKDIR /app

COPY dist ./dist
COPY run.sh /run.sh
RUN chmod +x /run.sh \
 && npm install --omit=dev --no-audit --no-fund --loglevel=error

CMD ["/run.sh"]
