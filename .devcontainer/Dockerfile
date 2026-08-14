FROM node:24-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# The official Node image includes the non-root `node` user.
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:${PATH}

RUN mkdir -p /home/node/.npm-global \
    && chown -R node:node /home/node/.npm-global

USER node
