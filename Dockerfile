FROM nginx:stable-alpine

LABEL org.opencontainers.image.title="HFA SilverStrong"
LABEL org.opencontainers.image.description="Static healthcare telehealth portal served by Nginx"

RUN rm -rf /usr/share/nginx/html/*

COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
