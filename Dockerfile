FROM alpine:3.12
WORKDIR /usr/src
USER root
RUN apk add --no-cache git npm && \
    mkdir -p /usr/src && \
    cd /usr/src && \
    git clone https://github.com/markg85/NknMetricTransmitter.git && \
    npm install
    
CMD [ "node", "index.js" ]
