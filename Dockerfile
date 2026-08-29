FROM busybox:1.36
WORKDIR /www
COPY index.html game.js /www/
COPY vendor /www/vendor
EXPOSE 8080
CMD ["httpd","-f","-v","-p","8080","-h","/www"]
