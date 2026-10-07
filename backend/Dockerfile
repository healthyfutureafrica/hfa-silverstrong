FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
	&& apk upgrade --no-cache zlib \
	&& rm -rf /usr/local/lib/node_modules/npm /opt/yarn* \
	&& rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg \
	&& mkdir -p /app/data && chown -R node:node /app
COPY --chown=node:node backend/ ./backend/
USER node
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/app/data/hfa.sqlite
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "backend/server.js"]