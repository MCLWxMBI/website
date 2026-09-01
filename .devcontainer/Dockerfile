FROM node:24-slim

ARG DENO_VERSION=2.2.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        wget \
        patch \
        poppler-utils \
        unzip \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && wget -nv -O /etc/apt/keyrings/githubcli-archive-keyring.gpg \
        https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && mkdir -p -m 755 /etc/apt/sources.list.d \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    # Netlify Edge Functions Dev 1.0.24 requires this Deno CLI behavior.
    && curl -fsSL https://deno.land/install.sh -o /tmp/install-deno.sh \
    && DENO_INSTALL=/usr/local sh /tmp/install-deno.sh "v${DENO_VERSION}" \
    && deno --version \
    && rm /tmp/install-deno.sh \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# The official Node image includes the non-root `node` user.
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:${PATH}

RUN mkdir -p /home/node/.npm-global \
    && chown -R node:node /home/node/.npm-global

USER node
