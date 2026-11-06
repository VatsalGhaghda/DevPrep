FROM node:20-slim

# Compilers and runtimes for the supported languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    default-jdk-headless \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /sandbox
COPY runCode.js /sandbox/runCode.js

# Run as an unprivileged user. The work dir is mounted as a tmpfs at run time
# (see backend/src/utils/runInDocker.js), the rest of the filesystem is read-only.
RUN mkdir -p /sandbox/work && chown node:node /sandbox/work
USER node
ENV WORK_DIR=/sandbox/work

CMD ["node", "/sandbox/runCode.js"]
