ARG BUILD_FROM=ghcr.io/hassio-addons/base:17.1.4
FROM ${BUILD_FROM}

WORKDIR /app

COPY dist /dist
COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
