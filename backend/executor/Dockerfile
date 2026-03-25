FROM node:18-slim

# Install compilers and runtimes
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    default-jdk \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /sandbox

COPY runCode.js /sandbox/runCode.js

CMD ["node", "/sandbox/runCode.js"]
