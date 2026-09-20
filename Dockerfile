FROM nginxinc/nginx-unprivileged:stable-alpine

LABEL org.opencontainers.image.title="HFA SilverStrong"
LABEL org.opencontainers.image.description="Static healthcare telehealth portal served by Nginx"

USER root

RUN rm -rf /usr/share/nginx/html/* \
	&& chown -R 101:101 /usr/share/nginx/html /tmp /var/cache/nginx

COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/
COPY nginx.conf /etc/nginx/nginx.conf

USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
